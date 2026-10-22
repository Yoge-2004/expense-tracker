/* Interactive Wealth & Runway Simulator + Health Telemetry Sub-Scores */
(function () {
    "use strict";
    const utils = window.DashboardUtils;
    if (!utils) return;
    const { formatCurrency, escapeHtml } = utils;

    function computeLocalTelemetry(expenses, incomes, goals, budgets) {
        const safeExp = Array.isArray(expenses) ? expenses : [];
        const safeInc = Array.isArray(incomes) ? incomes : [];
        const safeGoals = Array.isArray(goals) ? goals : [];
        const safeBudgets = Array.isArray(budgets) ? budgets : [];

        const MoneyFlow = window.MoneyFlow;
        const now = new Date();
        const ym = MoneyFlow ? MoneyFlow.monthKey(now) : "";
        const mExp = ym ? safeExp.filter(e => MoneyFlow.monthKey(e.expenseDate) === ym) : safeExp;
        const mInc = ym ? safeInc.filter(i => MoneyFlow.effectiveMonth(i) === ym) : safeInc;

        const mInflow = MoneyFlow ? MoneyFlow.earnedTotal(mInc) : safeInc.reduce((s, i) => s + Number(i.amount || 0), 0);
        const mOutflow = MoneyFlow ? MoneyFlow.netSpent(mExp, mInc) : safeExp.reduce((s, e) => s + Number(e.amount || 0), 0);

        const activeInflow = (mInflow > 0 || mOutflow > 0) ? mInflow : (MoneyFlow ? MoneyFlow.earnedTotal(safeInc) : 0);
        const activeOutflow = (mInflow > 0 || mOutflow > 0) ? mOutflow : (MoneyFlow ? MoneyFlow.netSpent(safeExp, safeInc) : 0);
        const netSurplus = activeInflow - activeOutflow;
        const savingsRate = activeInflow > 0 ? Math.round((netSurplus / activeInflow) * 100) : 0;

        const totalLimit = safeBudgets.reduce((s, b) => s + Number(b.limit || b.limitAmount || 0), 0);
        const recOutflow = safeExp.filter(e => e.isRecurring || e.recurring).reduce((s, e) => s + Number(e.amount || 0), 0);

        const savingsScore = activeInflow <= 0 ? 68 : (savingsRate >= 30 ? 96 : savingsRate >= 20 ? 88 : savingsRate >= 10 ? 75 : savingsRate >= 0 ? 60 : 38);
        const budgetScore = totalLimit <= 0 ? 80 : (activeOutflow <= totalLimit * 0.8 ? 94 : activeOutflow <= totalLimit ? 82 : 48);
        const subScore = activeInflow <= 0 ? 85 : ((recOutflow / activeInflow) <= 0.15 ? 92 : (recOutflow / activeInflow) <= 0.3 ? 78 : 55);
        const goalTarget = safeGoals.reduce((s, g) => s + Number(g.targetAmount || 0), 0);
        const goalCurrent = safeGoals.reduce((s, g) => s + Number(g.currentAmount || 0), 0);
        const runwayScore = goalTarget > 0 ? Math.min(98, Math.round(62 + (goalCurrent / goalTarget) * 36)) : 76;

        return {
            activeInflow,
            activeOutflow,
            netSurplus,
            savingsRate,
            remainingGoals: Math.max(0, goalTarget - goalCurrent),
            subScores: [
                { label: "Savings Retention", score: savingsScore },
                { label: "Budget Velocity", score: budgetScore },
                { label: "Subscription Load", score: subScore },
                { label: "Goal Runway", score: runwayScore }
            ]
        };
    }

    function renderTelemetryStrip(telemetry) {
        const strip = document.getElementById("healthTelemetryStrip");
        if (!strip) return;
        strip.innerHTML = telemetry.subScores.map(item => `
            <div class="health-telemetry-pill">
                <div class="health-telemetry-top">
                    <span>${escapeHtml(item.label)}</span>
                    <span class="health-telemetry-score">${item.score}/100</span>
                </div>
                <div class="health-telemetry-bar">
                    <div class="health-telemetry-fill" data-score="${item.score}"></div>
                </div>
            </div>
        `).join("");
        strip.querySelectorAll(".health-telemetry-fill").forEach(el => {
            el.style.setProperty("--score-pct", `${el.getAttribute("data-score") || 75}%`);
        });
    }

    function updateSimulationOutput() {
        const cutSlider = document.getElementById("simExpenseCutSlider");
        const incSlider = document.getElementById("simExtraIncomeSlider");
        const sipSlider = document.getElementById("simExtraSipSlider");
        const horizonSelect = document.getElementById("simHorizonSelect");
        if (!cutSlider || !incSlider || !sipSlider) return;

        const cutVal = Number(cutSlider.value || 0);
        const incVal = Number(incSlider.value || 0);
        const sipVal = Number(sipSlider.value || 0);
        const horizon = Number(horizonSelect?.value || 12);

        const cutLabel = document.getElementById("simExpenseCutVal");
        const incLabel = document.getElementById("simExtraIncomeVal");
        const sipLabel = document.getElementById("simExtraSipVal");
        if (cutLabel) cutLabel.textContent = formatCurrency(cutVal);
        if (incLabel) incLabel.textContent = formatCurrency(incVal);
        if (sipLabel) sipLabel.textContent = formatCurrency(sipVal);

        const expenses = window.allExpenses || [];
        const incomes = [];
        const goals = [];
        const budgets = window.cachedBudgets || [];

        const t = computeLocalTelemetry(expenses, incomes, goals, budgets);
        const simMonthly = t.netSurplus + cutVal + incVal + sipVal;
        const simHorizonWealth = simMonthly * horizon;
        const deltaWealth = (cutVal + incVal + sipVal) * horizon;
        const newInflow = t.activeInflow + incVal;
        const simRate = newInflow > 0 ? Math.min(95, Math.round((simMonthly / newInflow) * 100)) : 0;

        const kpiSurplus = document.getElementById("simKpiMonthlySurplus");
        const kpiHorizon = document.getElementById("simKpiHorizonWealth");
        const kpiDelta = document.getElementById("simKpiDeltaGain");
        const kpiRate = document.getElementById("simKpiSavingsRate");
        const narrative = document.getElementById("simNarrativeBox");

        if (kpiSurplus) kpiSurplus.textContent = `${formatCurrency(simMonthly)}/mo`;
        if (kpiHorizon) kpiHorizon.textContent = formatCurrency(simHorizonWealth);
        if (kpiDelta) kpiDelta.textContent = `+${formatCurrency(deltaWealth)}`;
        if (kpiRate) kpiRate.textContent = `${simRate}%`;

        if (narrative) {
            narrative.innerHTML = `Over <strong>${horizon} months</strong>, trimming <strong>${formatCurrency(cutVal)}/mo</strong> in discretionary spend, adding <strong>${formatCurrency(incVal)}/mo</strong> in inflow, and allocating <strong>${formatCurrency(sipVal)}/mo</strong> to SIPs unlocks <strong>+${formatCurrency(deltaWealth)}</strong> in incremental wealth.`;
        }
    }

    function initWealthSimulator() {
        const toggleBtn = document.getElementById("openWealthSimulatorBtn");
        const drawer = document.getElementById("wealthSimulatorPanel");
        if (toggleBtn && drawer) {
            toggleBtn.addEventListener("click", () => {
                const isHidden = drawer.hasAttribute("hidden");
                if (isHidden) {
                    drawer.removeAttribute("hidden");
                    toggleBtn.setAttribute("aria-expanded", "true");
                    updateSimulationOutput();
                } else {
                    drawer.setAttribute("hidden", "");
                    toggleBtn.setAttribute("aria-expanded", "false");
                }
            });
        }
        ["simExpenseCutSlider", "simExtraIncomeSlider", "simExtraSipSlider", "simHorizonSelect"].forEach(id => {
            document.getElementById(id)?.addEventListener("input", updateSimulationOutput);
            document.getElementById(id)?.addEventListener("change", updateSimulationOutput);
        });
    }

    function refreshAll(expenses, incomes, goals) {
        const t = computeLocalTelemetry(expenses, incomes, goals, window.cachedBudgets || []);
        renderTelemetryStrip(t);
        updateSimulationOutput();
    }

    window.WealthSimulator = Object.freeze({
        refresh: refreshAll,
        open: () => {
            const drawer = document.getElementById("wealthSimulatorPanel");
            const toggleBtn = document.getElementById("openWealthSimulatorBtn");
            if (drawer) {
                drawer.removeAttribute("hidden");
                toggleBtn?.setAttribute("aria-expanded", "true");
                updateSimulationOutput();
                drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initWealthSimulator, { once: true });
    } else {
        initWealthSimulator();
    }
})();
