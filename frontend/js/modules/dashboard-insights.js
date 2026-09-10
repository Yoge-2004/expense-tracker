/* Financial intelligence renderer for the dashboard. */
(function () {
    "use strict";

    const { formatCurrency, escapeHtml } = window.DashboardUtils;

    function renderFinancialInsights(expenses, incomes, goals) {
    
        const grid = document.getElementById("insightsCardsGrid");
        const healthBadge = document.getElementById("insightsHealthScoreText");
        if (!grid) return;
    
        const safeExpenses = Array.isArray(expenses) ? expenses : [];
        const safeIncomes = Array.isArray(incomes) ? incomes : [];
        const safeGoals = Array.isArray(goals) ? goals : [];
    
        if (safeExpenses.length === 0 && safeIncomes.length === 0 && safeGoals.length === 0) {
            grid.innerHTML = `
                <div class="insight-card-item" style="grid-column: 1 / -1; width: 100%; max-width: 100%; box-sizing: border-box; text-align: center; padding: 20px 16px;">
                    <p class="text-muted" style="margin: 0; font-size: 13.5px; line-height: 1.5; word-break: break-word;">No transactions, incomes, or savings goals recorded. Add entries to generate real-time financial intelligence.</p>
                </div>
            `;
            if (healthBadge) healthBadge.textContent = "100% Financial Health";
            return;
        }
    
        const now = new Date();
        const currentDay = Math.max(now.getDate(), 1);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
    
        // 1. Current month expenses and daily burn
        const currentMonthExpenses = safeExpenses.filter(e => {
            const d = new Date(e.expenseDate);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const currentMonthSpent = currentMonthExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const totalAllExpenses = safeExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const activeOutflow = currentMonthSpent > 0 ? currentMonthSpent : totalAllExpenses;
        const dailyBurn = currentDay > 0 ? (currentMonthSpent / currentDay) : 0;
        const projectedSpent = dailyBurn * daysInMonth;
    
        // 2. Current month incomes & active inflow
        const currentMonthIncomes = safeIncomes.filter(i => {
            const d = new Date(i.incomeDate);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const currentMonthInflow = currentMonthIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const totalAllInflow = safeIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const activeInflow = currentMonthInflow > 0 ? currentMonthInflow : totalAllInflow;
    
        // 3. Synthesis: Net Cash Flow & Savings Rate (Inflows vs Outflows)
        const netCashflow = activeInflow - activeOutflow;
        const savingsRate = activeInflow > 0 ? Math.round((netCashflow / activeInflow) * 100) : 0;
    
        let cashflowInsight = "";
        if (activeInflow > 0) {
            if (savingsRate >= 20) {
                cashflowInsight = `Retaining <strong>${savingsRate}%</strong> of income. Net monthly surplus is <strong>+${formatCurrency(netCashflow)}</strong>, exceeding wealth accumulation benchmarks.`;
            } else if (netCashflow >= 0) {
                cashflowInsight = `Retaining <strong>${savingsRate}%</strong> of income (+<strong>${formatCurrency(netCashflow)}</strong> surplus). Strive for ≥20% to accelerate goal funding.`;
            } else {
                cashflowInsight = `⚠️ Net deficit of <strong>-${formatCurrency(Math.abs(netCashflow))}</strong> this period. Outflows exceed inflows by <strong>${Math.round((activeOutflow / activeInflow) * 100)}%</strong>.`;
            }
        } else {
            cashflowInsight = `Total spend is <strong>${formatCurrency(activeOutflow)}</strong>. Record your income streams in Cash Inflow to calculate your net savings rate.`;
        }
    
        // 4. Synthesis: Savings Goals Trajectory (Goals vs Net Cash Flow)
        const totalGoalsTarget = safeGoals.reduce((acc, g) => acc + Number(g.targetAmount || 0), 0);
        const totalGoalsCurrent = safeGoals.reduce((acc, g) => acc + Number(g.currentAmount || 0), 0);
        const remainingGoalsNeeded = Math.max(0, totalGoalsTarget - totalGoalsCurrent);
        const goalsOverallPct = totalGoalsTarget > 0 ? Math.round((totalGoalsCurrent / totalGoalsTarget) * 100) : 0;
    
        let goalsInsight = "";
        if (safeGoals.length === 0) {
            goalsInsight = `No active savings goals. Establish reserve targets (e.g. Emergency Fund, Investments) to project funding velocity.`;
        } else if (remainingGoalsNeeded <= 0 && totalGoalsTarget > 0) {
            goalsInsight = `🎉 All active savings milestones are <strong>100% funded</strong> (${formatCurrency(totalGoalsCurrent)} saved). Ready for new financial horizons.`;
        } else if (netCashflow > 0) {
            const monthsToFund = Math.max(1, Math.ceil(remainingGoalsNeeded / netCashflow));
            goalsInsight = `At current net surplus of <strong>${formatCurrency(netCashflow)}/mo</strong>, remaining targets (<strong>${formatCurrency(remainingGoalsNeeded)}</strong>) will be reached in ~<strong>${monthsToFund} month${monthsToFund === 1 ? '' : 's'}</strong> (${goalsOverallPct}% achieved).`;
        } else {
            goalsInsight = `<strong>${goalsOverallPct}% achieved</strong> (${formatCurrency(totalGoalsCurrent)} of ${formatCurrency(totalGoalsTarget)}). Boost monthly surplus or reduce discretionary drain to accelerate funding.`;
        }
    
        // 5. Synthesis: Recurring Baseline Coverage (Recurring Incomes vs Subscriptions)
        const recurringIncomes = safeIncomes.filter(i => !!(i.isRecurring || i.recurring));
        const recurringExpenses = safeExpenses.filter(e => !!(e.isRecurring || e.recurring));
    
        const monthlyRecInflow = recurringIncomes.reduce((acc, i) => {
            const amt = Number(i.amount || 0);
            const freq = (i.frequency || "MONTHLY").toUpperCase();
            if (freq === "WEEKLY") return acc + (amt * 52 / 12);
            if (freq === "DAILY") return acc + (amt * 365 / 12);
            return acc + amt;
        }, 0);
    
        const monthlyRecOutflow = recurringExpenses.reduce((acc, e) => {
            const amt = Number(e.amount || 0);
            const freq = (e.frequency || "MONTHLY").toUpperCase();
            if (freq === "WEEKLY") return acc + (amt * 52 / 12);
            if (freq === "DAILY") return acc + (amt * 365 / 12);
            return acc + amt;
        }, 0);
    
        let recurringInsight = "";
        if (monthlyRecInflow > 0 && monthlyRecOutflow > 0) {
            const covPct = Math.round((monthlyRecInflow / monthlyRecOutflow) * 100);
            const netRec = monthlyRecInflow - monthlyRecOutflow;
            recurringInsight = `Recurring inflow (<strong>${formatCurrency(monthlyRecInflow)}/mo</strong>) covers <strong>${covPct}%</strong> of recurring subscriptions (<strong>${formatCurrency(monthlyRecOutflow)}/mo</strong>), leaving a <strong>${netRec >= 0 ? '+' : ''}${formatCurrency(netRec)}/mo</strong> baseline buffer.`;
        } else if (monthlyRecInflow > 0) {
            recurringInsight = `Guaranteed recurring inflow of <strong>${formatCurrency(monthlyRecInflow)}/mo</strong> with zero fixed subscriptions recorded.`;
        } else if (monthlyRecOutflow > 0) {
            recurringInsight = `Fixed subscriptions total <strong>${formatCurrency(monthlyRecOutflow)}/mo</strong>. Tag steady income streams as Recurring to safeguard baseline obligations.`;
        } else {
            recurringInsight = `No recurring subscriptions or income streams detected. Tag salary or SaaS renewals as Recurring for baseline tracking.`;
        }
    
        // 6. Category Concentration & Top Outflow
        const catMap = {};
        let totalCategorized = 0;
        safeExpenses.forEach(e => {
            const amt = Number(e.amount || 0);
            const cat = e.categoryName || "Other";
            catMap[cat] = (catMap[cat] || 0) + amt;
            totalCategorized += amt;
        });
    
        let topCat = "None";
        let topCatAmt = 0;
        Object.entries(catMap).forEach(([cat, amt]) => {
            if (amt > topCatAmt) {
                topCatAmt = amt;
                topCat = cat;
            }
        });
        const topCatPct = totalCategorized > 0 ? ((topCatAmt / totalCategorized) * 100).toFixed(1) : "0";
    
        // 7. Budget Governance & Adherence
        let budgetHealthScore = 35;
        let budgetInsightText = "All categories operating smoothly within limits.";
        const safeBudgets = (typeof cachedBudgets !== 'undefined' && Array.isArray(cachedBudgets)) ? cachedBudgets : (window.cachedBudgets || []);
        if (safeBudgets && safeBudgets.length > 0) {
            let exceededCount = 0;
            let warningCount = 0;
            safeBudgets.forEach(b => {
                const limit = Number(b.limit || b.amount || 0);
                const spent = Number(b.spent || 0);
                if (limit > 0) {
                    const ratio = spent / limit;
                    if (ratio > 1.0) exceededCount++;
                    else if (ratio >= 0.8) warningCount++;
                }
            });
            const penalty = (exceededCount * 18) + (warningCount * 8);
            budgetHealthScore = Math.max(0, 35 - penalty);
            if (exceededCount > 0) {
                budgetInsightText = `⚠️ <strong>${exceededCount} budget(s) exceeded</strong>. Review high-spend categories immediately.`;
            } else if (warningCount > 0) {
                budgetInsightText = `🟡 <strong>${warningCount} budget(s) nearing limit</strong> (>80% capacity utilized).`;
            } else {
                budgetInsightText = `🟢 <strong>${safeBudgets.length} of ${safeBudgets.length}</strong> categories strictly on target.`;
            }
        }
    
        // 8. Holistic Synthesized Financial Health Score (0-100%)
        let cashflowScore = 20;
        if (activeInflow > 0) {
            if (savingsRate >= 25) cashflowScore = 35;
            else if (savingsRate >= 15) cashflowScore = 30;
            else if (savingsRate >= 0) cashflowScore = 22;
            else if (savingsRate >= -15) cashflowScore = 10;
            else cashflowScore = 0;
        }
    
        let resilienceScore = 20;
        if (safeGoals.length > 0 || recurringIncomes.length > 0) {
            let goalPts = (goalsOverallPct >= 50 ? 15 : 10);
            let recPts = (monthlyRecInflow >= monthlyRecOutflow ? 15 : 5);
            resilienceScore = Math.min(30, goalPts + recPts);
        }
    
        const holisticScore = Math.min(100, Math.max(10, Math.round(budgetHealthScore + cashflowScore + resilienceScore)));
    
        if (healthBadge) {
            healthBadge.textContent = `${holisticScore}% Financial Health`;
        }
    
        grid.innerHTML = `
            <div class="insight-card-item">
                <div class="insight-card-item-header">
                    <div class="insight-icon-box" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">⚖️</div>
                    <span class="insight-card-label">Net Cash Flow & Savings Rate</span>
                </div>
                <div class="insight-card-content">
                    ${cashflowInsight}
                </div>
            </div>
    
            <div class="insight-card-item">
                <div class="insight-card-item-header">
                    <div class="insight-icon-box" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B;">🎯</div>
                    <span class="insight-card-label">Savings Goals Trajectory</span>
                </div>
                <div class="insight-card-content">
                    ${goalsInsight}
                </div>
            </div>
    
            <div class="insight-card-item">
                <div class="insight-card-item-header">
                    <div class="insight-icon-box" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6;">🔄</div>
                    <span class="insight-card-label">Recurring Baseline Coverage</span>
                </div>
                <div class="insight-card-content">
                    ${recurringInsight}
                </div>
            </div>
    
            <div class="insight-card-item">
                <div class="insight-card-item-header">
                    <div class="insight-icon-box" style="background: rgba(199, 154, 62, 0.15); color: #C79A3E;">🔥</div>
                    <span class="insight-card-label">Burn Velocity & Runway</span>
                </div>
                <div class="insight-card-content">
                    Averaging <strong>${formatCurrency(dailyBurn)}/day</strong> this month. Projected month-end outflow is <strong>${formatCurrency(projectedSpent)}</strong>.
                </div>
            </div>
    
            <div class="insight-card-item">
                <div class="insight-card-item-header">
                    <div class="insight-icon-box" style="background: rgba(76, 122, 120, 0.15); color: #4C7A78;">📊</div>
                    <span class="insight-card-label">Category Concentration</span>
                </div>
                <div class="insight-card-content">
                    <strong>${escapeHtml(topCat)}</strong> is your primary driver, taking <strong>${topCatPct}%</strong> (<strong>${formatCurrency(topCatAmt)}</strong>) of all recorded spend.
                </div>
            </div>
    
            <div class="insight-card-item">
                <div class="insight-card-item-header">
                    <div class="insight-icon-box" style="background: rgba(162, 62, 50, 0.15); color: #A23E32;">🛡️</div>
                    <span class="insight-card-label">Budget Governance</span>
                </div>
                <div class="insight-card-content">
                    ${budgetInsightText}
                </div>
            </div>
        `;
    }

    window.DashboardInsights = Object.freeze({ renderFinancialInsights });
})();
