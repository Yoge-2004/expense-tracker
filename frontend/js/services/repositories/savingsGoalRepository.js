/**
 * Savings Goal Repository (Dependency Inversion Principle - DIP)
 * Abstracts all HTTP communications for Savings Goals and contributions.
 */
(function(global) {
    "use strict";

    const SavingsGoalRepository = {
        /**
         * Fetch all savings goals for a user.
         * @param {number|string} userId
         * @returns {Promise<Array>}
         */
        async getSavingsGoals(userId) {
            if (!userId) throw new Error("userId is required to fetch savings goals");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/savings/goals/user/${userId}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to fetch savings goals: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Create a new savings goal.
         * @param {Object} goalData
         * @param {number|string} userId
         * @returns {Promise<Object>}
         */
        async createSavingsGoal(goalData, userId) {
            const uid = userId || goalData.userId || global.getUserId?.();
            if (!uid) throw new Error("User context required to create savings goal");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/savings/goals/user/${uid}`, {
                method: "POST",
                body: JSON.stringify(goalData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to create savings goal: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Deposit funds into a savings goal.
         * @param {number|string} goalId
         * @param {number} amount
         * @param {number|string} userId
         * @returns {Promise<Object>}
         */
        async deposit(goalId, amount, userId) {
            const uid = userId || global.getUserId?.();
            if (!goalId) throw new Error("goalId is required for deposit");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/savings/goals/${goalId}/deposit/user/${uid}`, {
                method: "POST",
                body: JSON.stringify({ amount: Number(amount) })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to deposit to savings goal: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Delete a savings goal.
         * @param {number|string} goalId
         * @param {number|string} userId
         * @returns {Promise<boolean>}
         */
        async deleteSavingsGoal(goalId, userId) {
            const uid = userId || global.getUserId?.();
            if (!goalId) throw new Error("goalId is required to delete savings goal");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/savings/goals/${goalId}/user/${uid}`, {
                method: "DELETE"
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to delete savings goal: HTTP ${res.status}`);
            }
            return true;
        }
    };

    global.SavingsGoalRepository = SavingsGoalRepository;
})(typeof window !== "undefined" ? window : globalThis);
