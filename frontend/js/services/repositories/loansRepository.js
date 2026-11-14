/**
 * Loans & Debt Adjustments Repository (Dependency Inversion Principle - DIP)
 * Abstracts lent/borrowed adjustments and settlement toggling.
 */
(function(global) {
    "use strict";

    const LoansRepository = {
        /**
         * Fetch all loans/adjustments for a user.
         * @param {number|string} userId
         * @returns {Promise<Array>}
         */
        async getLoans(userId) {
            const uid = userId || global.getUserId?.();
            if (!uid) throw new Error("userId is required to fetch loans");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/loans/user/${uid}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to fetch loans: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Create a new loan or debt adjustment.
         * @param {Object} loanData
         * @param {number|string} userId
         * @returns {Promise<Object>}
         */
        async createLoan(loanData, userId) {
            const uid = userId || loanData.userId || global.getUserId?.();
            if (!uid) throw new Error("User context required to create loan");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/loans/user/${uid}`, {
                method: "POST",
                body: JSON.stringify(loanData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to create loan: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Toggle loan settlement status.
         * @param {number|string} loanId
         * @param {number|string} userId
         * @returns {Promise<Object>}
         */
        async toggleSettlement(loanId, userId) {
            const uid = userId || global.getUserId?.();
            if (!loanId) throw new Error("loanId is required to toggle settlement");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/loans/${loanId}/settle/user/${uid}`, {
                method: "POST"
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to toggle settlement: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Delete a loan record.
         * @param {number|string} loanId
         * @param {number|string} userId
         * @returns {Promise<boolean>}
         */
        async deleteLoan(loanId, userId) {
            const uid = userId || global.getUserId?.();
            if (!loanId) throw new Error("loanId is required to delete loan");
            const res = await global.fetchWithAuth(`${global.API_BASE_URL}/loans/${loanId}/user/${uid}`, {
                method: "DELETE"
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to delete loan: HTTP ${res.status}`);
            }
            return true;
        }
    };

    global.LoansRepository = LoansRepository;
})(typeof window !== "undefined" ? window : globalThis);
