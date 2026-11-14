/**
 * Unified Repository Registry
 * Exposes all domain repositories under window.Repositories and individual globals.
 */
(function(global) {
    "use strict";

    global.Repositories = {
        expense: global.ExpenseRepository,
        income: global.IncomeRepository,
        budget: global.BudgetRepository,
        savingsGoal: global.SavingsGoalRepository,
        category: global.CategoryRepository,
        loans: global.LoansRepository
    };
})(typeof window !== "undefined" ? window : globalThis);
