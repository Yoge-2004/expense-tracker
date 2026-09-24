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

        let loadSequence = 0;

        function renderDashboardData(expenses, categories) {
            const state = getState();
            const safeCategories = Array.isArray(categories) ? categories : [];
            const currentExpenses = Array.isArray(state.allExpenses) ? state.allExpenses : [];
            const incomingExpenses = expenses && expenses.length > 0
                ? expenses
                : ((window.allExpenses && window.allExpenses.length > 0) ? window.allExpenses : currentExpenses);

            // Sort a copy so cached/shared arrays are not mutated in place. This
            // keeps state ownership explicit and prevents one render from changing
            // the order observed by another consumer of the same array.
            const sortedExpenses = [...incomingExpenses].sort((a, b) => {
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

            // Dashboard refreshes can overlap (manual refresh, initial load,
            // filter/page re-entry). A monotonically increasing sequence means
            // stale responses can finish normally without being allowed to
            // overwrite the newest dashboard state.
            const requestSequence = ++loadSequence;

            if (skipCache) {
                if (typeof clearApiCache === "function") clearApiCache();
                try { localStorage.removeItem(getCacheKey()); } catch (_) {}
            }

            const cached = skipCache ? null : loadExpenseCache();
            const renderedFromCache = !!cached;

            if (cached) {
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
                        .catch(err => {
                            console.error("Incomes fetch error:", err);
                            return null;
                        }),
                    apiRequest(`/savings/goals/user/${userId}`, { skipCache })
                        .catch(err => {
                            console.error("Savings fetch error:", err);
                            return null;
                        })
                ]);

                // Only the newest dashboard load is allowed to publish state.
                if (requestSequence !== loadSequence) return;

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

                if (incomes === null) {
                    const incomeListEl = document.getElementById("incomeList");
                    if (incomeListEl) {
                        incomeListEl.innerHTML = `
                            <div class="empty-state connection-error" style="text-align:center; padding:36px 16px;">
                                <div class="empty-state-icon" style="font-size:32px; margin-bottom:8px;">⚠️</div>
                                <div class="empty-state-title" style="font-weight:600; font-size:15px; margin-bottom:6px; color:var(--text-main);">Server Connection Failed</div>
                                <div class="empty-state-sub" style="color:var(--text-muted); font-size:13px; max-width:340px; margin:0 auto 16px;">
                                    Could not reach the server to load your income records.
                                </div>
                                <button type="button" class="btn-primary btn-sm" onclick="location.reload()" style="padding:8px 18px; font-size:13px; border-radius:8px;">
                                    Retry Connection
                                </button>
                            </div>`;
                    }
                } else {
                    renderIncomes(allIncomes);
                }

                if (savingsGoals === null) {
                    const savingsGoalsEl = document.getElementById("savingsGoalsList");
                    if (savingsGoalsEl) {
                        savingsGoalsEl.innerHTML = `
                            <div class="empty-state-compact connection-error" style="grid-column:1/-1; text-align:center; padding:32px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                                <div style="font-size:24px; margin-bottom:6px;">⚠️</div>
                                <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">Server Connection Failed</p>
                                <span style="font-size:12.5px; display:block; margin-bottom:12px;">Could not reach the server to load your savings goals.</span>
                                <button type="button" class="btn-primary btn-small" onclick="location.reload()" style="display:inline-flex; align-items:center; gap:6px; margin:0 auto; background:#F59E0B; border-color:#F59E0B; color:#fff;">
                                    <span>Retry Connection</span>
                                </button>
                            </div>`;
                    }
                } else {
                    renderSavingsGoals(allSavingsGoals);
                }

                updateCashFlowMetrics(expenses || [], allIncomes, allSavingsGoals);
                saveExpenseCache(expenses, categories);
            } catch (error) {
                // An older failed request must not surface an error after a newer
                // refresh has already taken ownership of the dashboard state.
                if (requestSequence !== loadSequence) return;

                console.error("Critical Error:", error);
                if (error?.message?.includes("User not found")) {
                    localStorage.clear();
                    window.location.href = "index.html";
                    return;
                }

                const state = getState();
                if (renderedFromCache) {
                    showToast("Couldn't reach the server — showing your last saved data.", "error");
                    renderIncomes(Array.isArray(state.allIncomes) ? state.allIncomes : []);
                    renderSavingsGoals(Array.isArray(state.allSavingsGoals) ? state.allSavingsGoals : []);
                } else {
                    showToast("Couldn't connect to the server. Check your connection or server status.", "error");
                    renderDashboardData([], []);
                    updateCashFlowMetrics([], [], []);
                    const expenseListEl = document.getElementById("expenseList");
                    if (expenseListEl) {
                        expenseListEl.innerHTML = `
                            <div class="empty-state connection-error" style="text-align:center; padding:36px 16px;">
                                <div class="empty-state-icon" style="font-size:32px; margin-bottom:8px;">⚠️</div>
                                <div class="empty-state-title" style="font-weight:600; font-size:15px; margin-bottom:6px; color:var(--text-main);">Server Connection Failed</div>
                                <div class="empty-state-sub" style="color:var(--text-muted); font-size:13px; max-width:340px; margin:0 auto 16px;">
                                    Could not reach the server to load your transactions.
                                </div>
                                <button type="button" class="btn-primary btn-sm" onclick="location.reload()" style="padding:8px 18px; font-size:13px; border-radius:8px;">
                                    Retry Connection
                                </button>
                            </div>`;
                    }
                    const incomeListEl = document.getElementById("incomeList");
                    if (incomeListEl) {
                        incomeListEl.innerHTML = `
                            <div class="empty-state connection-error" style="text-align:center; padding:36px 16px;">
                                <div class="empty-state-icon" style="font-size:32px; margin-bottom:8px;">⚠️</div>
                                <div class="empty-state-title" style="font-weight:600; font-size:15px; margin-bottom:6px; color:var(--text-main);">Server Connection Failed</div>
                                <div class="empty-state-sub" style="color:var(--text-muted); font-size:13px; max-width:340px; margin:0 auto 16px;">
                                    Could not reach the server to load your income records.
                                </div>
                                <button type="button" class="btn-primary btn-sm" onclick="location.reload()" style="padding:8px 18px; font-size:13px; border-radius:8px;">
                                    Retry Connection
                                </button>
                            </div>`;
                    }
                    const savingsGoalsEl = document.getElementById("savingsGoalsList");
                    if (savingsGoalsEl) {
                        savingsGoalsEl.innerHTML = `
                            <div class="empty-state-compact connection-error" style="grid-column:1/-1; text-align:center; padding:32px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                                <div style="font-size:24px; margin-bottom:6px;">⚠️</div>
                                <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">Server Connection Failed</p>
                                <span style="font-size:12.5px; display:block; margin-bottom:12px;">Could not reach the server to load your savings goals.</span>
                                <button type="button" class="btn-primary btn-small" onclick="location.reload()" style="display:inline-flex; align-items:center; gap:6px; margin:0 auto; background:#F59E0B; border-color:#F59E0B; color:#fff;">
                                    <span>Retry Connection</span>
                                </button>
                            </div>`;
                    }
                }
            }
        }

        return Object.freeze({ renderDashboardData, loadDashboard });
    }

    window.DashboardData = Object.freeze({ createController });
})();
