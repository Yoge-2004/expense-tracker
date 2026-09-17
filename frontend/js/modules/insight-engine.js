/* ==========================================================================
   INSIGHT ENGINE — pure analysis, no DOM
   ==========================================================================

   Every export here is a pure function over plain transaction arrays. No
   document access, no rendering, no globals beyond the namespace assignment
   at the bottom. That is deliberate: the same logic has to run unchanged in
   the React Native app, and the previous implementation could not be reused
   because computation and DOM rendering were interleaved in one function.

   Design rules, in priority order:

   1. NEVER assert more certainty than the data supports. This is a money
      app. Every projection is phrased as a pace, not a prophecy, and every
      insight carries an explicit `confidence` the renderer can reflect.

   2. STAY SILENT ON THIN DATA. Each generator declares a minimum-evidence
      bar and returns null below it. A confident-sounding trend drawn from
      four days of history is worse than no trend at all.

   3. NO FABRICATED PRECISION. Percentages round to integers, money is left
      raw for the caller's locale formatter. We do not invent decimal places
      the underlying data cannot support.
   ========================================================================== */

(function (global) {
    "use strict";

    /* ---------------------------------------------------------------
       Date handling.
       "2026-03-04" passed to new Date() parses as UTC midnight, which in
       any timezone behind UTC renders as the 3rd. That silently shifts
       transactions across month boundaries and corrupts every monthly
       bucket. Parse date-only strings as local instead.
       --------------------------------------------------------------- */
    function parseLocalDate(value) {
        if (value instanceof Date) return value;
        if (value == null) return null;
        const str = String(value);
        const dateOnly = str.split("T")[0];
        const parts = dateOnly.split("-");
        if (parts.length === 3) {
            const y = Number(parts[0]);
            const m = Number(parts[1]);
            const d = Number(parts[2]);
            if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
                return new Date(y, m - 1, d);
            }
        }
        const fallback = new Date(str);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
    }

    function monthKey(date) {
        if (!date) return null;
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    function amountOf(tx) {
        const n = Number(tx && tx.amount);
        return Number.isFinite(n) ? n : 0;
    }

    function dateOf(tx, field) {
        return parseLocalDate(tx && tx[field]);
    }

    function sum(values) {
        return values.reduce((a, b) => a + b, 0);
    }

    function mean(values) {
        return values.length ? sum(values) / values.length : 0;
    }

    function stdDev(values) {
        if (values.length < 2) return 0;
        const m = mean(values);
        return Math.sqrt(sum(values.map((v) => (v - m) ** 2)) / (values.length - 1));
    }

    function pctChange(current, previous) {
        if (!previous) return null;
        return Math.round(((current - previous) / Math.abs(previous)) * 100);
    }

    /* Group transactions into { "YYYY-MM": total } plus per-month arrays. */
    function bucketByMonth(transactions, dateField) {
        const totals = new Map();
        const items = new Map();
        for (const tx of transactions) {
            const d = dateOf(tx, dateField);
            const key = monthKey(d);
            if (!key) continue;
            totals.set(key, (totals.get(key) || 0) + amountOf(tx));
            if (!items.has(key)) items.set(key, []);
            items.get(key).push(tx);
        }
        return { totals, items };
    }

    /* Ordered month keys, oldest first, excluding the current month. */
    function completedMonthKeys(totals, now) {
        const current = monthKey(now);
        return [...totals.keys()].filter((k) => k < current).sort();
    }

    /* ==============================================================
       I1 — Month-over-month vs trailing baseline
       Minimum evidence: 2 completed months.
       ============================================================== */
    function monthOverMonth(expenses, now = new Date()) {
        const { totals } = bucketByMonth(expenses, "expenseDate");
        const completed = completedMonthKeys(totals, now);
        if (completed.length < 2) return null;

        const baselineKeys = completed.slice(-3);
        const baseline = mean(baselineKeys.map((k) => totals.get(k) || 0));
        if (baseline <= 0) return null;

        const currentSpend = totals.get(monthKey(now)) || 0;

        /* Compare like with like: a partial month against a full-month mean
           always looks low. Scale the baseline to the elapsed fraction. */
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const elapsed = Math.min(now.getDate(), daysInMonth);
        const proRatedBaseline = baseline * (elapsed / daysInMonth);
        const delta = pctChange(currentSpend, proRatedBaseline);
        if (delta === null) return null;

        return {
            id: "month-over-month",
            kind: delta > 0 ? "caution" : "positive",
            confidence: baselineKeys.length >= 3 ? "high" : "moderate",
            magnitude: Math.abs(delta),
            monthsOfHistory: baselineKeys.length,
            currentSpend,
            baseline: proRatedBaseline,
            fullMonthBaseline: baseline,
            direction: delta > 0 ? "up" : "down",
            /* Phrased as pace, and explicitly says what it is compared against
               so the number is never a bare unexplained claim. */
            summary:
                Math.abs(delta) < 5
                    ? `Spending is tracking in line with your ${baselineKeys.length}-month average.`
                    : `Spending is running ${Math.abs(delta)}% ${delta > 0 ? "above" : "below"} your ${baselineKeys.length}-month average for this point in the month.`
        };
    }

    /* ==============================================================
       I2 — Per-category trend
       Minimum evidence: 3 completed months with data in that category.
       ============================================================== */
    function categoryTrends(expenses, now = new Date(), limit = 3) {
        const byCategory = new Map();
        for (const tx of expenses) {
            const name = (tx && tx.categoryName) || "Uncategorized";
            if (!byCategory.has(name)) byCategory.set(name, []);
            byCategory.get(name).push(tx);
        }

        const results = [];
        for (const [name, txs] of byCategory) {
            const { totals } = bucketByMonth(txs, "expenseDate");
            const completed = completedMonthKeys(totals, now);
            if (completed.length < 3) continue;

            const series = completed.slice(-6).map((k) => totals.get(k) || 0);
            const avg = mean(series);
            if (avg <= 0) continue;

            /* Least-squares slope over the month series, expressed as a
               percentage of the category's own average so categories of
               very different sizes stay comparable. */
            const n = series.length;
            const xMean = (n - 1) / 2;
            let num = 0;
            let den = 0;
            series.forEach((y, x) => {
                num += (x - xMean) * (y - avg);
                den += (x - xMean) ** 2;
            });
            if (den === 0) continue;
            const slopePerMonth = num / den;
            const slopePct = Math.round((slopePerMonth / avg) * 100);

            /* Ignore noise: under 8% per month is not a trend worth naming. */
            if (Math.abs(slopePct) < 8) continue;

            results.push({
                id: `category-trend:${name}`,
                kind: slopePct > 0 ? "caution" : "positive",
                confidence: n >= 5 ? "high" : "moderate",
                category: name,
                slopePctPerMonth: slopePct,
                monthsOfHistory: n,
                averagePerMonth: avg,
                magnitude: Math.abs(slopePct),
                summary: `${name} is trending ${slopePct > 0 ? "up" : "down"} about ${Math.abs(slopePct)}% per month across your last ${n} months.`
            });
        }

        return results.sort((a, b) => b.magnitude - a.magnitude).slice(0, limit);
    }

    /* ==============================================================
       I3 — Anomaly detection against the user's own category baseline
       Minimum evidence: 5 prior transactions in that category.
       ============================================================== */
    function anomalies(expenses, now = new Date(), options = {}) {
        const sigmaThreshold = options.sigma || 2;
        const lookbackDays = options.lookbackDays || 30;
        const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - lookbackDays);

        const byCategory = new Map();
        for (const tx of expenses) {
            const name = (tx && tx.categoryName) || "Uncategorized";
            if (!byCategory.has(name)) byCategory.set(name, []);
            byCategory.get(name).push(tx);
        }

        const found = [];
        for (const [name, txs] of byCategory) {
            if (txs.length < 6) continue;

            const amounts = txs.map(amountOf).filter((a) => a > 0);
            if (amounts.length < 6) continue;

            const m = mean(amounts);
            const sd = stdDev(amounts);
            /* A near-constant category (a fixed subscription) has ~zero
               deviation; every tiny wobble would read as a 5-sigma event.
               Require meaningful spread before calling anything unusual. */
            if (sd <= 0 || sd / m < 0.15) continue;

            for (const tx of txs) {
                const d = dateOf(tx, "expenseDate");
                if (!d || d < cutoff || d > now) continue;
                const amt = amountOf(tx);
                const z = (amt - m) / sd;
                if (z < sigmaThreshold) continue;

                found.push({
                    id: `anomaly:${name}:${tx.expenseDate}:${amt}`,
                    kind: "caution",
                    confidence: amounts.length >= 12 ? "high" : "moderate",
                    category: name,
                    amount: amt,
                    categoryMean: m,
                    sigma: Math.round(z * 10) / 10,
                    date: tx.expenseDate,
                    description: tx.description || null,
                    magnitude: z,
                    summary: `A ${name} charge came in well above your usual for that category (typically around ${Math.round(m)}).`
                });
            }
        }

        return found.sort((a, b) => b.magnitude - a.magnitude).slice(0, options.limit || 3);
    }

    /* ==============================================================
       I4 — Recurring-charge detection
       Finds repeat charges the user never flagged as recurring, by
       looking for a stable description with a regular interval and a
       near-constant amount.
       Minimum evidence: 3 occurrences.
       ============================================================== */
    function normalizeDescription(text) {
        return String(text || "")
            .toLowerCase()
            .replace(/[0-9]+/g, "")           // strip invoice/order numbers
            .replace(/[^a-z\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function detectRecurring(expenses, now = new Date(), limit = 3) {
        const groups = new Map();
        for (const tx of expenses) {
            const key = normalizeDescription(tx && tx.description);
            if (key.length < 3) continue;        // too generic to cluster on
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(tx);
        }

        const results = [];
        for (const [key, txs] of groups) {
            if (txs.length < 3) continue;
            /* Already flagged by the user — nothing to surface. */
            if (txs.some((t) => t.isRecurring || t.recurring)) continue;

            const dated = txs
                .map((t) => ({ tx: t, date: dateOf(t, "expenseDate") }))
                .filter((x) => x.date)
                .sort((a, b) => a.date - b.date);
            if (dated.length < 3) continue;

            const gaps = [];
            for (let i = 1; i < dated.length; i++) {
                gaps.push((dated[i].date - dated[i - 1].date) / 86400000);
            }
            const gapMean = mean(gaps);
            const gapSd = stdDev(gaps);
            /* Regular cadence: intervals cluster tightly, and land in a
               plausible billing range (weekly through quarterly). */
            if (gapMean < 6 || gapMean > 95) continue;
            if (gapMean > 0 && gapSd / gapMean > 0.25) continue;

            const amounts = dated.map((x) => amountOf(x.tx));
            const amtMean = mean(amounts);
            const amtSd = stdDev(amounts);
            if (amtMean <= 0) continue;
            if (amtSd / amtMean > 0.12) continue;   // amount must be near-constant

            const cadence =
                gapMean < 10 ? "weekly"
                : gapMean < 18 ? "fortnightly"
                : gapMean < 45 ? "monthly"
                : "quarterly";

            const last = dated[dated.length - 1].date;
            const nextDue = new Date(last.getTime() + gapMean * 86400000);

            results.push({
                id: `recurring:${key}`,
                kind: "informational",
                confidence: dated.length >= 5 ? "high" : "moderate",
                label: dated[dated.length - 1].tx.description || key,
                occurrences: dated.length,
                cadence,
                averageAmount: amtMean,
                intervalDays: Math.round(gapMean),
                estimatedNextDate: nextDue,
                magnitude: amtMean,
                summary: `"${dated[dated.length - 1].tx.description || key}" looks like a ${cadence} charge you haven't marked as recurring — ${dated.length} occurrences so far.`
            });
        }

        return results.sort((a, b) => b.magnitude - a.magnitude).slice(0, limit);
    }

    /* ==============================================================
       I5 — Pacing-aware month-end projection
       Replaces naive (spent / dayOfMonth) * daysInMonth, which
       over-predicts early in the month and is wrong for anyone whose
       spending clusters on particular weekdays.
       Minimum evidence: 1 completed month for weekday weighting;
       falls back to linear pacing below that.
       ============================================================== */
    function projection(expenses, now = new Date()) {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const today = Math.min(now.getDate(), daysInMonth);
        const currentKey = monthKey(now);

        const { totals, items } = bucketByMonth(expenses, "expenseDate");
        const spentSoFar = totals.get(currentKey) || 0;
        const completed = completedMonthKeys(totals, now);

        const linear = today > 0 ? (spentSoFar / today) * daysInMonth : 0;

        if (completed.length < 1) {
            return {
                id: "projection",
                kind: "informational",
                confidence: "low",
                method: "linear",
                spentSoFar,
                projected: linear,
                summary: "Not enough history yet for a weighted forecast — this is a simple straight-line pace."
            };
        }

        /* Build a day-of-week spending weight from completed months. */
        const dowTotals = new Array(7).fill(0);
        let historyTotal = 0;
        for (const key of completed.slice(-6)) {
            for (const tx of items.get(key) || []) {
                const d = dateOf(tx, "expenseDate");
                if (!d) continue;
                const amt = amountOf(tx);
                dowTotals[d.getDay()] += amt;
                historyTotal += amt;
            }
        }
        if (historyTotal <= 0) {
            return {
                id: "projection",
                kind: "informational",
                confidence: "low",
                method: "linear",
                spentSoFar,
                projected: linear,
                summary: "Not enough history yet for a weighted forecast — this is a simple straight-line pace."
            };
        }

        const dowWeight = dowTotals.map((t) => (t / historyTotal) * 7);

        /* Weight of the month elapsed vs the whole month, by weekday mix. */
        let elapsedWeight = 0;
        let totalWeight = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const dow = new Date(now.getFullYear(), now.getMonth(), day).getDay();
            const w = dowWeight[dow] || 1;
            totalWeight += w;
            if (day <= today) elapsedWeight += w;
        }

        const projected = elapsedWeight > 0 ? spentSoFar * (totalWeight / elapsedWeight) : linear;

        return {
            id: "projection",
            kind: "informational",
            confidence: completed.length >= 3 ? "high" : "moderate",
            method: "weekday-weighted",
            spentSoFar,
            projected,
            linearComparison: linear,
            monthsOfHistory: Math.min(completed.length, 6),
            summary: `On your current pace, this month lands near ${Math.round(projected)} — weighted by which days you actually tend to spend on.`
        };
    }

    /* ==============================================================
       I6 — Temporal pattern (day-of-week concentration)
       Minimum evidence: 20 transactions.
       ============================================================== */
    const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    function temporalPattern(expenses) {
        const dated = expenses
            .map((t) => ({ amt: amountOf(t), date: dateOf(t, "expenseDate") }))
            .filter((x) => x.date && x.amt > 0);
        if (dated.length < 20) return null;

        const dow = new Array(7).fill(0);
        for (const x of dated) dow[x.date.getDay()] += x.amt;
        const total = sum(dow);
        if (total <= 0) return null;

        const weekend = dow[0] + dow[6];
        const weekendShare = Math.round((weekend / total) * 100);

        let peakDay = 0;
        for (let i = 1; i < 7; i++) if (dow[i] > dow[peakDay]) peakDay = i;
        const peakShare = Math.round((dow[peakDay] / total) * 100);

        /* An even split is ~14% per day and ~29% weekend. Only speak up
           when the concentration is genuinely beyond chance. */
        if (peakShare < 22 && weekendShare < 40) return null;

        return {
            id: "temporal-pattern",
            kind: "informational",
            confidence: dated.length >= 60 ? "high" : "moderate",
            peakDay: DAY_NAMES[peakDay],
            peakSharePct: peakShare,
            weekendSharePct: weekendShare,
            transactionCount: dated.length,
            magnitude: peakShare,
            summary:
                weekendShare >= 40
                    ? `Weekends account for ${weekendShare}% of your spending.`
                    : `${DAY_NAMES[peakDay]} is consistently your heaviest spending day, at ${peakShare}% of total.`
        };
    }

    /* ==============================================================
       I7 — Savings-goal feasibility from realized savings rate
       Minimum evidence: 2 completed months of both income and expense.
       ============================================================== */
    function goalFeasibility(goals, expenses, incomes, now = new Date(), limit = 2) {
        if (!Array.isArray(goals) || goals.length === 0) return [];

        const exp = bucketByMonth(expenses, "expenseDate").totals;
        const inc = bucketByMonth(incomes, "incomeDate").totals;
        const months = completedMonthKeys(exp, now).filter((k) => inc.has(k));
        if (months.length < 2) return [];

        const recent = months.slice(-3);
        const monthlySurplus = mean(recent.map((k) => (inc.get(k) || 0) - (exp.get(k) || 0)));

        const results = [];
        for (const goal of goals) {
            const target = Number(goal && goal.targetAmount);
            const current = Number(goal && goal.currentAmount) || 0;
            if (!Number.isFinite(target) || target <= 0) continue;
            const remaining = target - current;
            if (remaining <= 0) continue;

            if (monthlySurplus <= 0) {
                results.push({
                    id: `goal:${goal.name}`,
                    kind: "caution",
                    confidence: recent.length >= 3 ? "high" : "moderate",
                    goal: goal.name,
                    remaining,
                    monthsToGoal: null,
                    magnitude: remaining,
                    summary: `"${goal.name}" isn't currently funded — recent months averaged no surplus to put toward it.`
                });
                continue;
            }

            const monthsToGoal = Math.ceil(remaining / monthlySurplus);
            results.push({
                id: `goal:${goal.name}`,
                kind: monthsToGoal <= 12 ? "positive" : "informational",
                confidence: recent.length >= 3 ? "high" : "moderate",
                goal: goal.name,
                remaining,
                monthlySurplus,
                monthsToGoal,
                magnitude: -monthsToGoal,
                summary: `At your recent average surplus, "${goal.name}" is roughly ${monthsToGoal} ${monthsToGoal === 1 ? "month" : "months"} away.`
            });
        }

        return results.sort((a, b) => b.magnitude - a.magnitude).slice(0, limit);
    }

    /* ==============================================================
       Aggregate
       ============================================================== */
    function generateInsights(data, now = new Date()) {
        const expenses = Array.isArray(data && data.expenses) ? data.expenses : [];
        const incomes = Array.isArray(data && data.incomes) ? data.incomes : [];
        const goals = Array.isArray(data && data.goals) ? data.goals : [];

        const out = [];
        const push = (v) => {
            if (!v) return;
            if (Array.isArray(v)) out.push(...v.filter(Boolean));
            else out.push(v);
        };

        push(monthOverMonth(expenses, now));
        push(projection(expenses, now));
        push(categoryTrends(expenses, now));
        push(anomalies(expenses, now));
        push(detectRecurring(expenses, now));
        push(temporalPattern(expenses));
        push(goalFeasibility(goals, expenses, incomes, now));

        return out;
    }

    const api = {
        parseLocalDate,
        monthKey,
        bucketByMonth,
        monthOverMonth,
        categoryTrends,
        anomalies,
        detectRecurring,
        projection,
        temporalPattern,
        goalFeasibility,
        generateInsights
    };

    /* Browser global for the existing script-tag architecture; CommonJS
       export so the mobile app and Jest can import the identical file. */
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (global) {
        global.InsightEngine = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
