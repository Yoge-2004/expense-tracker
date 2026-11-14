/**
 * Income Repository (Dependency Inversion Principle - DIP)
 * Abstracts all HTTP communications and data transformations for Incomes.
 */
(function(global) {
    "use strict";

    const IncomeRepository = {
        /**
         * Fetch all incomes for a user.
         * @param {number|string} userId
         * @returns {Promise<Array>}
         */
        async getIncomes(userId) {
            if (!userId) throw new Error("userId is required to fetch incomes");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/incomes/user/${userId}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to fetch incomes: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Create a new income stream.
         * @param {Object} incomeData
         * @param {number|string} userId
         * @returns {Promise<Object>}
         */
        async createIncome(incomeData, userId) {
            const uid = userId || incomeData.userId || global.getUserId?.();
            if (!uid) throw new Error("User context required to create income");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/incomes/user/${uid}`, {
                method: "POST",
                body: JSON.stringify(incomeData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to create income: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Update an existing income stream.
         * @param {number|string} incomeId
         * @param {Object} incomeData
         * @returns {Promise<Object>}
         */
        async updateIncome(incomeId, incomeData) {
            if (!incomeId) throw new Error("incomeId is required to update income");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/incomes/${incomeId}`, {
                method: "PUT",
                body: JSON.stringify(incomeData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to update income: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Delete an income stream.
         * @param {number|string} incomeId
         * @returns {Promise<boolean>}
         */
        async deleteIncome(incomeId) {
            if (!incomeId) throw new Error("incomeId is required to delete income");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/incomes/${incomeId}`, {
                method: "DELETE"
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to delete income: HTTP ${res.status}`);
            }
            return true;
        }
    };

    global.IncomeRepository = IncomeRepository;
})(typeof window !== "undefined" ? window : globalThis);
