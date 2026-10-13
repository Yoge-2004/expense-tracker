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

    /** SALARY, OTHER or REIMBURSEMENT. Older records have no kind: "salary" in the source means salary. */
    function kindOf(income) {
        const raw = String((income && income.kind) || "").toUpperCase();
        if (raw === "SALARY" || raw === "OTHER" || raw === "REIMBURSEMENT") return raw;
        return /salary/i.test((income && income.source) || "") ? "SALARY" : "OTHER";
    }

    /** The month an income counts toward. */
    function effectiveMonth(income) {
        const stored = income && income.countsTowardMonth;
        if (typeof stored === "string" && MONTH_RE.test(stored)) return stored;
        return monthKey(income && income.incomeDate);
    }

    function earnedTotal(incomes) {
        return sum((incomes || []).filter((i) => kindOf(i) !== "REIMBURSEMENT"), (i) => i.amount);
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

        const credited = (incomes || []).filter((i) => kindOf(i) !== "REIMBURSEMENT");
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

    window.MoneyFlow = Object.freeze({
        monthKey, shiftMonth, monthLabel, kindOf, effectiveMonth,
        earnedTotal, reimbursedTotal, netSpent, summarize,
    });
})();
