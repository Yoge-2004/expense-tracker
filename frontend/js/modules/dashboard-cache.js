/* Dashboard cache: comprehensive stale-while-revalidate persistence for all dashboard financial state. */
(function () {
    "use strict";

    const CACHE_VERSION = 2;

    function getCacheKey() {
        const userId = localStorage.getItem("userId") || "anonymous";
        return `expenseCache_v2_${userId}`;
    }

    function saveDashboardCache({ expenses, categories, incomes, savingsGoals, budgets }) {
        try {
            const key = getCacheKey();
            const payload = {
                v: CACHE_VERSION,
                savedAt: Date.now(),
                expenses: Array.isArray(expenses) ? expenses : [],
                categories: Array.isArray(categories) ? categories : [],
                incomes: Array.isArray(incomes) ? incomes : [],
                savingsGoals: Array.isArray(savingsGoals) ? savingsGoals : [],
                budgets: Array.isArray(budgets) ? budgets : []
            };
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (error) {
            console.warn("[DashboardCache] Could not persist dashboard cache:", error);
        }
    }

    function loadDashboardCache() {
        try {
            const key = getCacheKey();
            let raw = localStorage.getItem(key);
            if (!raw) {
                // Fallback to v1 cache if available
                const oldUserId = localStorage.getItem("userId") || "anonymous";
                raw = localStorage.getItem(`expenseCache_${oldUserId}`);
            }
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.expenses)) return null;
            return parsed;
        } catch (_) {
            return null;
        }
    }

    // Backwards-compatible aliases
    function saveExpenseCache(expenses, categories, extra = {}) {
        saveDashboardCache({
            expenses,
            categories,
            incomes: extra.incomes || (window.allIncomes || []),
            savingsGoals: extra.savingsGoals || (window.allSavingsGoals || []),
            budgets: extra.budgets || (window.cachedBudgets || [])
        });
    }

    function loadExpenseCache() {
        return loadDashboardCache();
    }

    window.getCacheKey = getCacheKey;
    window.saveDashboardCache = saveDashboardCache;
    window.loadDashboardCache = loadDashboardCache;
    window.saveExpenseCache = saveExpenseCache;
    window.loadExpenseCache = loadExpenseCache;
})();
