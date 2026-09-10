/* Dashboard cache: stale-while-revalidate persistence for expense state. */
(function () {
    "use strict";

    const CACHE_VERSION = 1;

    function getCacheKey() {
        const userId = localStorage.getItem("userId") || "anonymous";
        return `expenseCache_${userId}`;
    }

    function saveExpenseCache(expenses, categories) {
        try {
            localStorage.setItem(getCacheKey(), JSON.stringify({
                v: CACHE_VERSION,
                savedAt: Date.now(),
                expenses,
                categories
            }));
        } catch (error) {
            console.warn("Could not save expense cache:", error);
        }
    }

    function loadExpenseCache() {
        try {
            const raw = localStorage.getItem(getCacheKey());
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed.v !== CACHE_VERSION || !Array.isArray(parsed.expenses)) return null;
            return parsed;
        } catch (_) {
            return null;
        }
    }

    window.getCacheKey = getCacheKey;
    window.saveExpenseCache = saveExpenseCache;
    window.loadExpenseCache = loadExpenseCache;
})();
