/**
 * Expense Repository (Dependency Inversion Principle - DIP)
 * Abstracts all HTTP communications and data transformations for Expenses.
 */
(function(global) {
    "use strict";

    const ExpenseRepository = {
        /**
         * Fetch all expenses for a user.
         * @param {number|string} userId
         * @returns {Promise<Array>}
         */
        async getExpenses(userId) {
            if (!userId) throw new Error("userId is required to fetch expenses");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/expenses/user/${userId}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to fetch expenses: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Create a new expense.
         * @param {Object} expenseData
         * @param {number|string} userId
         * @returns {Promise<Object>}
         */
        async createExpense(expenseData, userId) {
            const uid = userId || expenseData.userId || global.getUserId?.();
            if (!uid) throw new Error("User context required to create expense");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/expenses/user/${uid}`, {
                method: "POST",
                body: JSON.stringify(expenseData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to create expense: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Update an existing expense.
         * @param {number|string} expenseId
         * @param {Object} expenseData
         * @returns {Promise<Object>}
         */
        async updateExpense(expenseId, expenseData) {
            if (!expenseId) throw new Error("expenseId is required to update expense");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/expenses/${expenseId}`, {
                method: "PUT",
                body: JSON.stringify(expenseData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to update expense: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Delete an expense.
         * @param {number|string} expenseId
         * @returns {Promise<boolean>}
         */
        async deleteExpense(expenseId) {
            if (!expenseId) throw new Error("expenseId is required to delete expense");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/expenses/${expenseId}`, {
                method: "DELETE"
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to delete expense: HTTP ${res.status}`);
            }
            return true;
        }
    };

    global.ExpenseRepository = ExpenseRepository;
})(typeof window !== "undefined" ? window : globalThis);
