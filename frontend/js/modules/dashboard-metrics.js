/* Dashboard metric calculations and recurring summary state. */
(function () {
    "use strict";

    const elements = window.DashboardDom.elements;
    const { formatCurrency } = window.DashboardUtils;
    const { animateNumber } = window.DashboardEffects;
    const userId = localStorage.getItem("userId");

    async function updateProMetrics(expenses, incomes) {
        if (!Array.isArray(expenses)) return;

        // Total Spent & Count. Money that came back (reimbursements) reduces what was spent.
        const totalSpent = window.MoneyFlow ? window.MoneyFlow.netSpent(expenses, incomes) : expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const count = expenses.length;
        
        if (elements.totalAmount) animateNumber(elements.totalAmount, totalSpent, true);
        const countEl = document.getElementById("expenseCountText");
        if (countEl) countEl.textContent = `${count} transaction${count === 1 ? '' : 's'} recorded`;

        // Daily Burn Rate & Month End Forecast
        const now = new Date();
        const currentDay = Math.max(now.getDate(), 1);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        
        // Filter expenses for current month
        const currentMonthExpenses = expenses.filter(e => {
            const d = new Date(e.expenseDate);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const currentMonthSpent = currentMonthExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const dailyBurn = currentMonthSpent / currentDay;
        const projectedSpent = dailyBurn * daysInMonth;

        let dailyBurnEl = document.getElementById("dailyBurnRate");
        if (!dailyBurnEl) {
            const burnBadge = document.getElementById("burnRateBadge");
            if (burnBadge) {
                burnBadge.innerHTML = 'Burn: <span id="dailyBurnRate"></span>';
                dailyBurnEl = document.getElementById("dailyBurnRate");
            }
        }
        if (dailyBurnEl) dailyBurnEl.textContent = `${formatCurrency(dailyBurn)} / day`;
        const forecastEl = document.getElementById("monthForecast");
        if (forecastEl) forecastEl.textContent = `Projected: ${formatCurrency(projectedSpent)}`;

        // Top Category
        const catMap = {};
        expenses.forEach(e => {
            const cat = e.categoryName || 'Other';
            catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0);
        });

        let topCat = 'None';
        let maxAmt = 0;
        Object.entries(catMap).forEach(([cat, amt]) => {
            if (amt > maxAmt) {
                maxAmt = amt;
                topCat = cat;
            }
        });

        const topCatNameEl = document.getElementById("topCategoryName");
        if (topCatNameEl) topCatNameEl.textContent = topCat;
        const topCatAmtEl = document.getElementById("topCategoryAmount");
        if (topCatAmtEl) topCatAmtEl.textContent = `${formatCurrency(maxAmt)} spent`;

        // Subscriptions Fetch
        let monthlyTotal = 0;
        try {
            const subs = await apiRequest(`/expenses/recurring/user/${userId}`);
            const safeSubs = Array.isArray(subs) ? subs : [];
            const activeSubs = safeSubs;
            monthlyTotal = activeSubs.reduce((acc, s) => acc + Number(s.amount || 0), 0);

            const subsBadge = document.getElementById("subsCountBadge");
            if (subsBadge) subsBadge.textContent = `${activeSubs.length} Active`;
            const subsTotal = document.getElementById("subsMonthlyTotal");
            if (subsTotal) animateNumber(subsTotal, monthlyTotal, true, false, " / mo");
        } catch (err) {
            console.error("Subs fetch error", err);
            const subsBadge = document.getElementById("subsCountBadge");
            if (subsBadge) subsBadge.textContent = "0 Active";
            const subsTotal = document.getElementById("subsMonthlyTotal");
            if (subsTotal) subsTotal.textContent = `${formatCurrency(0)} / mo`;
        }

        // Safe-to-Spend Allowance Calculation
        try {
            const safeDailyEl = document.getElementById("safeDailySpend");
            const safeBadge = document.getElementById("safeDailySpendBadge");

            if (expenses.length === 0 && (!incomes || incomes.length === 0)) {
                if (safeDailyEl) safeDailyEl.textContent = "--";
                if (safeBadge) {
                    safeBadge.className = "status-badge badge-neutral";
                    safeBadge.title = "No data available";
                }
            } else {
                const daysLeftInMonth = Math.max(1, daysInMonth - currentDay + 1);
                let monthlyBudgetLimit = 0;
                try {
                    const cachedBudgets = (window.DashboardData && typeof window.DashboardData.getCachedBudgets === 'function')
                        ? window.DashboardData.getCachedBudgets()
                        : [];
                    if (Array.isArray(cachedBudgets) && cachedBudgets.length) {
                        monthlyBudgetLimit = cachedBudgets.reduce((sum, b) => sum + Number(b.limit || 0), 0);
                    }
                } catch (_) {}

                let safeDaily = 0;
                if (monthlyBudgetLimit > 0) {
                    const budgetRemaining = Math.max(0, monthlyBudgetLimit - currentMonthSpent);
                    safeDaily = budgetRemaining / daysLeftInMonth;
                } else {
                    const currentMonthIncomes = Array.isArray(incomes) ? incomes.filter(i => {
                        const d = new Date(i.incomeDate || i.date);
                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    }) : [];
                    const currentMonthIncome = currentMonthIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
                    if (currentMonthIncome > 0) {
                        const incomeRemaining = Math.max(0, currentMonthIncome - currentMonthSpent);
                        safeDaily = incomeRemaining / daysLeftInMonth;
                    } else {
                        safeDaily = Math.max(0, dailyBurn * 0.85);
                    }
                }

                if (safeDailyEl) {
                    safeDailyEl.textContent = formatCurrency(safeDaily);
                }
                if (safeBadge) {
                    if (safeDaily <= 0) {
                        safeBadge.className = "status-badge badge-danger";
                        safeBadge.title = `Monthly budget exhausted! ${formatCurrency(0)} safe allowance`;
                    } else if (safeDaily < dailyBurn) {
                        safeBadge.className = "status-badge badge-warning";
                        safeBadge.title = "Pacing high - lower daily spend recommended";
                    } else {
                        safeBadge.className = "status-badge badge-success";
                        safeBadge.title = "Healthy pace - safe daily spending allowance";
                    }
                }
            }
        } catch (e) {
            console.warn("Safe-to-spend calculation error:", e);
        }

        // No-Spend Day Streak Calculation & Calendar Milestones
        try {
            const streakCountEl = document.getElementById("noSpendStreakCount");
            const streakBadge = document.getElementById("noSpendStreakBadge");

            if (!expenses || expenses.length === 0) {
                if (streakCountEl) streakCountEl.textContent = "--";
                if (streakBadge) {
                    streakBadge.title = "No transactions recorded yet";
                    streakBadge.className = "status-badge badge-neutral";
                }
                return;
            }

            const spendByDate = new Map();
            expenses.forEach(e => {
                if (!e.expenseDate) return;
                const dStr = typeof e.expenseDate === 'string' ? e.expenseDate.split('T')[0] : '';
                if (dStr) {
                    spendByDate.set(dStr, (spendByDate.get(dStr) || 0) + Number(e.amount || 0));
                }
            });

            const formatDateStr = (d) => {
                const yr = d.getFullYear();
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const da = String(d.getDate()).padStart(2, '0');
                return `${yr}-${mo}-${da}`;
            };

            let streak = 0;
            const checkDate = new Date();
            const todayStr = formatDateStr(checkDate);
            const todaySpend = spendByDate.get(todayStr) || 0;

            if (todaySpend === 0) {
                streak = 1;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                checkDate.setDate(checkDate.getDate() - 1);
            }

            for (let i = 0; i < 365; i++) {
                const dStr = formatDateStr(checkDate);
                const spend = spendByDate.get(dStr) || 0;
                if (spend === 0) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }

            if (streakCountEl) {
                streakCountEl.textContent = `${streak}d streak`;
            }
            if (streakBadge) {
                streakBadge.className = "status-badge badge-warning";
                streakBadge.title = `${streak} consecutive day${streak === 1 ? '' : 's'} with ${formatCurrency(0)} recorded non-recurring expenses`;
            }

            const noSpendSet = new Set();
            const calIterDate = new Date();
            for (let i = 0; i < 90; i++) {
                const dStr = formatDateStr(calIterDate);
                if ((spendByDate.get(dStr) || 0) === 0) {
                    noSpendSet.add(dStr);
                }
                calIterDate.setDate(calIterDate.getDate() - 1);
            }
            window.__noSpendDatesSet = noSpendSet;
        } catch (e) {
            console.warn("No-spend streak error:", e);
        }
    }

    window.DashboardMetrics = Object.freeze({
        updateProMetrics
    });
    window.updateProMetrics = updateProMetrics;
})();
