/**
 * Dashboard State Store (State Encapsulation & Observer Pattern)
 * Centralizes application state management, eliminates accidental mutations,
 * and notifies subscribers on state transitions.
 */
(function(global) {
    "use strict";

    const initialState = {
        userId: null,
        user: null,
        expenses: [],
        incomes: [],
        budgets: [],
        savingsGoals: [],
        categories: [],
        loans: [],
        filters: {
            searchQuery: "",
            category: "ALL",
            dateRange: "all",
            startDate: null,
            endDate: null
        },
        stealthMode: false,
        currency: "INR",
        isLoading: false,
        serverOnline: true
    };

    let state = { ...initialState };
    const listeners = new Set();

    const DashboardStore = {
        /**
         * Get a frozen snapshot of current state to prevent direct external mutation.
         * @returns {Object}
         */
        getState() {
            return Object.freeze({ ...state });
        },

        /**
         * Update state and notify subscribers.
         * @param {Object|Function} updater
         */
        setState(updater) {
            const nextPartial = typeof updater === "function" ? updater(state) : updater;
            if (!nextPartial || typeof nextPartial !== "object") return;

            const prevState = state;
            state = { ...state, ...nextPartial };

            // Deep protect collections
            if (nextPartial.expenses) state.expenses = [...nextPartial.expenses];
            if (nextPartial.incomes) state.incomes = [...nextPartial.incomes];
            if (nextPartial.budgets) state.budgets = [...nextPartial.budgets];
            if (nextPartial.savingsGoals) state.savingsGoals = [...nextPartial.savingsGoals];
            if (nextPartial.categories) state.categories = [...nextPartial.categories];
            if (nextPartial.loans) state.loans = [...nextPartial.loans];

            const frozen = Object.freeze({ ...state });
            listeners.forEach(fn => {
                try {
                    fn(frozen, prevState);
                } catch (err) {
                    console.error("[DashboardStore] Subscriber error:", err);
                }
            });
        },

        /**
         * Subscribe to state changes. Returns an unsubscribe function.
         * @param {Function} listener
         * @returns {Function} unsubscribe
         */
        subscribe(listener) {
            if (typeof listener !== "function") return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        /**
         * Reset store to initial state.
         */
        reset() {
            this.setState({ ...initialState });
        }
    };

    global.DashboardStore = DashboardStore;
})(typeof window !== "undefined" ? window : globalThis);
