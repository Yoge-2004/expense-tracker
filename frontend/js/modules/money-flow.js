/*
 * Money-flow calculations shared by the dashboard cards and the monthly panel.
 * Pure functions: no DOM, no network, no globals read. Mirrors the backend rules in
 * IncomeRules.java so the website, the monthly report and the mobile app agree.
 *
 *  - An income belongs to the month it COUNTS TOWARD (income.countsTowardMonth, "YYYY-MM"),
 *    which is the month of its date unless it was assigned elsewhere (next month's salary
 *    credited on the 30th).
 *  - A REIMBURSEMENT is money handed back for something already paid. It is not income:
 *    it reduces what was spent.
 *  - BORROWED money and peer settlements are excluded from personal earned revenue.
 */
(function () {
    "use strict";

    const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

    function num(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function sum(list, pick) {
        return list.reduce((total, item) => total + num(pick(item)), 0);
    }

    /** "YYYY-MM" for a Date or a "YYYY-MM-DD…" string; "" when there is nothing usable. */
    function monthKey(value) {
        if (!value) return "";
        if (value instanceof Date) {
            return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
        }
        const text = String(value).slice(0, 7);
        return MONTH_RE.test(text) ? text : "";
    }

    function shiftMonth(month, delta) {
        const [y, m] = month.split("-").map(Number);
        return monthKey(new Date(y, m - 1 + delta, 1));
    }

    function monthLabel(month, locale) {
        const [y, m] = month.split("-").map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString(locale || undefined, { month: "long", year: "numeric" });
    }

    /** SALARY, OTHER, REIMBURSEMENT, BORROWED or SETTLEMENT. Older records have no kind: "salary" in the source means salary. */
    function kindOf(income) {
        const raw = String((income && income.kind) || "").toUpperCase();
        if (raw === "SALARY" || raw === "OTHER" || raw === "REIMBURSEMENT" || raw === "BORROWED" || raw === "SETTLEMENT") return raw;
        return /salary/i.test((income && income.source) || "") ? "SALARY" : "OTHER";
    }

    /** The month an income counts toward. */
    function effectiveMonth(income) {
        const stored = income && income.countsTowardMonth;
        if (typeof stored === "string" && MONTH_RE.test(stored)) return stored;
        return monthKey(income && income.incomeDate);
    }

    function earnedTotal(incomes) {
        return sum((incomes || []).filter((i) => {
            const k = kindOf(i);
            return k !== "REIMBURSEMENT" && k !== "BORROWED" && k !== "SETTLEMENT";
        }), (i) => i.amount);
    }

    function reimbursedTotal(incomes) {
        return sum((incomes || []).filter((i) => kindOf(i) === "REIMBURSEMENT"), (i) => i.amount);
    }

    /** Spending net of money that came back. A refund bigger than the spending never makes it negative. */
    function netSpent(expenses, incomes) {
        return Math.max(0, sum(expenses || [], (e) => e.amount) - reimbursedTotal(incomes));
    }

    /** Everything the monthly panel shows, for one "YYYY-MM". */
    function summarize(expenses, incomes, goals, month) {
        const monthExpenses = (expenses || []).filter((e) => monthKey(e.expenseDate) === month);
        const monthIncomes = (incomes || []).filter((i) => effectiveMonth(i) === month);

        const salary = sum(monthIncomes.filter((i) => kindOf(i) === "SALARY"), (i) => i.amount);
        const otherIncome = sum(monthIncomes.filter((i) => kindOf(i) === "OTHER"), (i) => i.amount);
        const reimbursed = sum(monthIncomes.filter((i) => kindOf(i) === "REIMBURSEMENT"), (i) => i.amount);
        const earned = salary + otherIncome;
        const grossSpent = sum(monthExpenses, (e) => e.amount);
        const spent = Math.max(0, grossSpent - reimbursed);
        const leftOver = earned - spent;

        const credited = (incomes || []).filter((i) => {
            const k = kindOf(i);
            return k !== "REIMBURSEMENT" && k !== "BORROWED" && k !== "SETTLEMENT";
        });
        // Credited in this calendar month but counted toward a different one.
        const creditedForOtherMonths = credited
            .filter((i) => monthKey(i.incomeDate) === month && effectiveMonth(i) !== month)
            .map((i) => ({ amount: num(i.amount), toMonth: effectiveMonth(i) }));
        // Counted toward this month but credited in a different one.
        const countedFromOtherMonths = credited
            .filter((i) => effectiveMonth(i) === month && monthKey(i.incomeDate) !== month)
            .map((i) => ({ amount: num(i.amount), fromMonth: monthKey(i.incomeDate) }));

        return {
            month,
            salary,
            otherIncome,
            earned,
            grossSpent,
            reimbursed,
            spent,
            leftOver,
            savingsRate: earned > 0 ? (leftOver / earned) * 100 : 0,
            savedInGoals: sum(goals || [], (g) => g.currentAmount),
            hasActivity: monthExpenses.length > 0 || monthIncomes.length > 0,
            creditedForOtherMonths,
            countedFromOtherMonths,
        };
    }

    /* ---- Subscriptions (recurring expenses) ------------------------------------------
     * Charges that are already due become real "(Auto)" expenses (RecurringExpenseScheduler),
     * so they are in the totals. These helpers cover the rest: a subscription's monthly
     * run-rate, and the charges still to come this month. Mirrors mobile/utils/subscriptionPlan.ts. */

    function toMonthlyRate(amount, frequency, intervalDays) {
        const amt = Math.max(0, num(amount));
        const freq = String(frequency || "MONTHLY").toUpperCase();
        if (freq === "DAILY") return amt * 30;
        if (freq === "WEEKLY") return amt * 4.33;
        if (freq === "BI_WEEKLY" || freq === "BIWEEKLY") return amt * 2.16;
        if (freq === "YEARLY") return amt / 12;
        if (freq === "CUSTOM" && Number(intervalDays) > 0) return (amt / Number(intervalDays)) * 30;
        return amt;
    }

    function parseDay(value) {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
        return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    }

    function nextOccurrence(date, frequency, intervalDays) {
        const d = new Date(date.getTime());
        switch (String(frequency || "MONTHLY").toUpperCase()) {
            case "DAILY": d.setDate(d.getDate() + 1); break;
            case "WEEKLY": d.setDate(d.getDate() + 7); break;
            case "BI_WEEKLY":
            case "BIWEEKLY": d.setDate(d.getDate() + 14); break;
            case "YEARLY": d.setFullYear(d.getFullYear() + 1); break;
            case "CUSTOM": d.setDate(d.getDate() + (Number(intervalDays) > 0 ? Number(intervalDays) : 30)); break;
            default: d.setMonth(d.getMonth() + 1);
        }
        return d;
    }

    /** Subscription charges still to come after today and up to the end of today's month. */
    function upcomingSubscriptionCharges(subscriptions, today) {
        const now = today instanceof Date ? today : new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        let total = 0;
        let count = 0;
        (subscriptions || []).forEach((sub) => {
            let due = parseDay(sub && sub.nextDueDate);
            const amount = Math.max(0, num(sub && sub.amount));
            if (!due || amount <= 0) return;
            for (let guard = 0; due <= monthEnd && guard < 400; guard++) {
                if (due > startOfToday) { total += amount; count++; }
                const next = nextOccurrence(due, sub.frequency, sub.intervalDays);
                if (next <= due) break;
                due = next;
            }
        });
        return { total, count };
    }

    /** True for expenses that came from a subscription (flagged, or auto-created by the scheduler). */
    function isSubscriptionExpense(expense) {
        return !!(expense && (expense.recurring || expense.isRecurring || /\(Auto\)\s*$/.test(String(expense.description || ""))));
    }

    /**
     * Month-end forecast: what is spent so far, plus everyday spending at the current pace for the
     * days left, plus the subscription charges still due. Subscriptions are kept out of the pace
     * so they are not extrapolated (and not counted twice).
     */
    function forecastMonth(monthExpenses, spentSoFar, subscriptions, today) {
        const now = today instanceof Date ? today : new Date();
        const day = Math.max(now.getDate(), 1);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const subsSoFar = sum((monthExpenses || []).filter(isSubscriptionExpense), (e) => e.amount);
        const everydayPace = Math.max(0, spentSoFar - subsSoFar) / day;
        const upcoming = upcomingSubscriptionCharges(subscriptions, now);
        return {
            forecast: spentSoFar + everydayPace * (daysInMonth - day) + upcoming.total,
            upcomingSubscriptions: upcoming.total,
            upcomingCount: upcoming.count,
            everydayPace,
        };
    }

    window.MoneyFlow = Object.freeze({
        monthKey, shiftMonth, monthLabel, kindOf, effectiveMonth,
        earnedTotal, reimbursedTotal, netSpent, summarize,
        toMonthlyRate, upcomingSubscriptionCharges, isSubscriptionExpense, forecastMonth,
    });
})();
