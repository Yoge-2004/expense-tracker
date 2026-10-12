/* Monthly money-flow panel: salary and other income in, spending out (net of money that came back), what is left. */
(function () {
    "use strict";

    const { formatCurrency } = window.DashboardUtils;
    const MoneyFlow = window.MoneyFlow;

    let viewMonth = MoneyFlow.monthKey(new Date());
    const data = { expenses: [], incomes: [], goals: [] };

    const byId = (id) => document.getElementById(id);

    function row(label, value, modifier) {
        return `<div class="money-flow-row${modifier ? ` money-flow-row--${modifier}` : ""}"><dt>${label}</dt><dd>${value}</dd></div>`;
    }

    function groupByMonth(items, key) {
        const totals = new Map();
        items.forEach((item) => totals.set(item[key], (totals.get(item[key]) || 0) + item.amount));
        return [...totals.entries()];
    }

    function notesFor(summary) {
        const notes = [];
        groupByMonth(summary.creditedForOtherMonths, "toMonth").forEach(([month, amount]) => {
            notes.push(`${formatCurrency(amount)} credited in ${MoneyFlow.monthLabel(summary.month)} counts toward ${MoneyFlow.monthLabel(month)}.`);
        });
        groupByMonth(summary.countedFromOtherMonths, "fromMonth").forEach(([month, amount]) => {
            notes.push(`${formatCurrency(amount)} credited in ${MoneyFlow.monthLabel(month)} counts toward this month.`);
        });
        return notes;
    }

    function render(expenses, incomes, goals) {
        if (Array.isArray(expenses)) data.expenses = expenses;
        if (Array.isArray(incomes)) data.incomes = incomes;
        if (Array.isArray(goals)) data.goals = goals;

        const body = byId("moneyFlowBody");
        if (!body) return;

        const summary = MoneyFlow.summarize(data.expenses, data.incomes, data.goals, viewMonth);
        const monthEl = byId("moneyFlowMonth");
        if (monthEl) monthEl.textContent = MoneyFlow.monthLabel(viewMonth);

        if (!summary.hasActivity) {
            body.innerHTML = `<p class="money-flow-empty">Nothing recorded for ${MoneyFlow.monthLabel(viewMonth)} yet.</p>`;
        } else {
            const rows = [];
            rows.push(row("Salary", `+${formatCurrency(summary.salary)}`, "in"));
            if (summary.otherIncome > 0) rows.push(row("Other income", `+${formatCurrency(summary.otherIncome)}`, "in"));
            rows.push(row("Total income", formatCurrency(summary.earned), "total"));
            rows.push(row("Spent", `−${formatCurrency(summary.grossSpent)}`, "out"));
            if (summary.reimbursed > 0) rows.push(row("Money back", `+${formatCurrency(summary.reimbursed)}`, "in"));
            rows.push(row("Net spent", formatCurrency(summary.spent), "total"));
            rows.push(row(
                "Left over",
                `${formatCurrency(summary.leftOver)} <small>${summary.savingsRate.toFixed(1)}% of income</small>`,
                summary.leftOver < 0 ? "negative" : "positive"
            ));
            if (summary.savedInGoals > 0) rows.push(row("Saved in goals so far", formatCurrency(summary.savedInGoals)));

            const now = new Date();
            if (viewMonth === MoneyFlow.monthKey(now) && summary.leftOver > 0) {
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
                rows.push(row(`You can spend about (${daysLeft} day${daysLeft === 1 ? "" : "s"} left)`, `${formatCurrency(summary.leftOver / daysLeft)} / day`));
            }
            body.innerHTML = `<dl class="money-flow-rows">${rows.join("")}</dl>`;
        }

        const noteEl = byId("moneyFlowNote");
        if (noteEl) {
            const notes = notesFor(summary);
            noteEl.hidden = notes.length === 0;
            noteEl.textContent = notes.join(" ");
        }
    }

    function move(delta) {
        viewMonth = MoneyFlow.shiftMonth(viewMonth, delta);
        render();
    }

    byId("moneyFlowPrev")?.addEventListener("click", () => move(-1));
    byId("moneyFlowNext")?.addEventListener("click", () => move(1));

    window.DashboardMoneyFlow = Object.freeze({ render });
})();
