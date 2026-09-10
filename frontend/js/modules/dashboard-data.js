/* Dashboard data loading and state synchronization controller. */
(function () {
    "use strict";

    function createController(deps) {
        const {
            getState,
            setState,
            getUserId,
            apiRequest,
            getCacheKey,
            loadExpenseCache,
            saveExpenseCache,
            showSkeletonLoading,
            renderCategoryData,
            renderIncomes,
            renderSavingsGoals,
            updateCashFlowMetrics,
            renderFinancialData,
            showToast,
            clearApiCache
        } = deps;

        function renderDashboardData(expenses, categories) {
            const state = getState();
            const safeCategories = Array.isArray(categories) ? categories : [];
            const currentExpenses = Array.isArray(state.allExpenses) ? state.allExpenses : [];
            const incomingExpenses = expenses && expenses.length > 0
                ? expenses
                : ((window.allExpenses && window.allExpenses.length > 0) ? window.allExpenses : currentExpenses);

            const sortedExpenses = incomingExpenses.sort((a, b) => {
                const dDiff = new Date(b.expenseDate) - new Date(a.expenseDate);
                if (dDiff !== 0) return dDiff;
                if (b.createdAt && a.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
                return (b.id || 0) - (a.id || 0);
            });

            setState({
                allCategories: safeCategories,
                allExpenses: sortedExpenses
            });

            renderCategoryData(safeCategories, sortedExpenses);
            renderFinancialData(sortedExpenses);
        }

        async function loadDashboard(skipCache = false) {
            const userId = getUserId();
            if (!userId) return;

            if (skipCache) {
                if (typeof clearApiCache === "function") clearApiCache();
                try { localStorage.removeItem(getCacheKey()); } catch (_) {}
            }

            const cached = skipCache ? null : loadExpenseCache();
            const renderedFromCache = !!cached;

            if (cached) {
                setState({
                    allExpenses: cached.expenses || [],
                    allCategories: cached.categories || []
                });
                renderDashboardData(cached.expenses, cached.categories);
            } else {
                showSkeletonLoading();
            }

            try {
                console.log("Loading Dashboard Data...");

                const [expenses, globalCats, userCats, incomes, savingsGoals] = await Promise.all([
                    apiRequest(`/expenses/user/${userId}`, { skipCache }),
                    apiRequest(`/categories/global`, { skipCache }),
                    apiRequest(`/categories/user/${userId}`, { skipCache }),
                    apiRequest(`/incomes/user/${userId}`, { skipCache })
                        .catch(err => { console.warn("Incomes fetch error:", err); return []; }),
                    apiRequest(`/savings/goals/user/${userId}`, { skipCache })
                        .catch(err => { console.warn("Savings fetch error:", err); return []; })
                ]);

                const allIncomes = Array.isArray(incomes) ? incomes : [];
                const allSavingsGoals = Array.isArray(savingsGoals) ? savingsGoals : [];
                const safeGlobal = Array.isArray(globalCats) ? globalCats : [];
                const safeUser = Array.isArray(userCats) ? userCats : [];
                const categories = [...safeGlobal, ...safeUser];

                setState({
                    allIncomes,
                    allSavingsGoals,
                    userOnlyCategories: safeUser
                });

                renderDashboardData(expenses, categories);
                renderIncomes(allIncomes);
                renderSavingsGoals(allSavingsGoals);
                updateCashFlowMetrics(expenses || [], allIncomes, allSavingsGoals);
                saveExpenseCache(expenses, categories);
            } catch (error) {
                console.error("Critical Error:", error);
                if (error?.message?.includes("User not found")) {
                    localStorage.clear();
                    window.location.href = "index.html";
                    return;
                }

                const state = getState();
                if (renderedFromCache) {
                    showToast("Couldn't reach the server — showing your last saved data.", "error");
                } else {
                    showToast("Couldn't load your data. Check your connection and try again.", "error");
                    renderDashboardData([], []);
                }
                renderIncomes(Array.isArray(state.allIncomes) ? state.allIncomes : []);
                renderSavingsGoals(Array.isArray(state.allSavingsGoals) ? state.allSavingsGoals : []);
            }
        }

        return Object.freeze({ renderDashboardData, loadDashboard });
    }

    window.DashboardData = Object.freeze({ createController });
})();
