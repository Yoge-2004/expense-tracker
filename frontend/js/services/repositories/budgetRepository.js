/**
 * Budget Repository (Dependency Inversion Principle - DIP)
 * Abstracts all HTTP communications for Budget caps and periods.
 */
(function(global) {
    "use strict";

    const BudgetRepository = {
        /**
         * Fetch all budget statuses for a user.
         * @param {number|string} userId
         * @returns {Promise<Array>}
         */
        async getBudgets(userId) {
            if (!userId) throw new Error("userId is required to fetch budgets");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/budgets/user/${userId}/status`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to fetch budgets: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Set or update a budget limit.
         * @param {Object} budgetData
         * @param {number|string} userId
         * @returns {Promise<Object>}
         */
        async setBudget(budgetData, userId) {
            const uid = userId || budgetData.userId || global.getUserId?.();
            if (!uid) throw new Error("User context required to set budget");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/budgets/user/${uid}`, {
                method: "POST",
                body: JSON.stringify(budgetData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to set budget: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Delete a budget by ID.
         * @param {number|string} budgetId
         * @returns {Promise<boolean>}
         */
        async deleteBudget(budgetId) {
            if (!budgetId) throw new Error("budgetId is required to delete budget");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/budgets/${budgetId}`, {
                method: "DELETE"
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to delete budget: HTTP ${res.status}`);
            }
            return true;
        }
    };

    global.BudgetRepository = BudgetRepository;
})(typeof window !== "undefined" ? window : globalThis);
