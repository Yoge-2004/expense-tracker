/**
 * Category Repository (Dependency Inversion Principle - DIP)
 * Abstracts category retrieval and custom category creation.
 */
(function(global) {
    "use strict";

    const CategoryRepository = {
        /**
         * Fetch all categories (default + user-defined).
         * @param {number|string} [userId]
         * @returns {Promise<Array>}
         */
        async getCategories(userId) {
            const uid = userId || global.getUserId?.();
            const endpoint = uid ? `${global.API_BASE_URL}/categories/user/${uid}` : `${global.API_BASE_URL}/categories`;
            const res = await global.fetchWithAuth(endpoint);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to fetch categories: HTTP ${res.status}`);
            }
            return await res.json();
        },

        /**
         * Create a custom category.
         * @param {Object} categoryData
         * @param {number|string} userId
         * @returns {Promise<Object>}
         */
        async createCategory(categoryData, userId) {
            const uid = userId || global.getUserId?.();
            const endpoint = uid ? `${global.API_BASE_URL}/categories/user/${uid}` : `${global.API_BASE_URL}/categories`;
            const res = await global.fetchWithAuth(endpoint, {
                method: "POST",
                body: JSON.stringify(categoryData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to create category: HTTP ${res.status}`);
            }
            return await res.json();
        }
    };

    global.CategoryRepository = CategoryRepository;
})(typeof window !== "undefined" ? window : globalThis);
