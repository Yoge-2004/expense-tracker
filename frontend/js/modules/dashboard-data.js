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
            const incomingExpenses = expenses && expenses.length > 0 ? expenses : currentExpenses;

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
            }

            const cached = (typeof loadDashboardCache === "function" ? loadDashboardCache() : null) || (typeof loadExpenseCache === "function" ? loadExpenseCache() : null);
            const renderedFromCache = !!cached;

            if (cached) {
                if (cached.expenses && cached.categories) {
                    renderDashboardData(cached.expenses, cached.categories);
                }
                if (Array.isArray(cached.incomes) && cached.incomes.length > 0) {
                    renderIncomes(cached.incomes);
                }
                if (Array.isArray(cached.savingsGoals) && cached.savingsGoals.length > 0) {
                    renderSavingsGoals(cached.savingsGoals);
                }
                if (Array.isArray(cached.budgets) && cached.budgets.length > 0 && typeof window.renderBudgets === "function") {
                    window.renderBudgets(cached.budgets);
                }
                if (cached.expenses && cached.incomes && cached.savingsGoals) {
                    updateCashFlowMetrics(cached.expenses, cached.incomes, cached.savingsGoals);
                }
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
                if (window.LoansManager && typeof window.LoansManager.fetchLoans === "function") {
                    window.LoansManager.fetchLoans();
                }

                if (incomes === null) {
                    const incomeListEl = document.getElementById("incomeList");
                    if (incomeListEl) {
                        incomeListEl.innerHTML = `
                            <div class="empty-state connection-error" style="text-align:center; padding:36px 16px;">
                                <div class="empty-state-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:8px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
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
                    const budgetListEl = document.getElementById("budgetList");
                    if (budgetListEl) {
                        budgetListEl.innerHTML = `
                            <div class="empty-state-compact connection-error" style="grid-column:1/-1; text-align:center; padding:32px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                                <div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                                <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">Server Connection Failed</p>
                                <span style="font-size:12.5px; display:block; margin-bottom:12px;">Could not reach the server to load your budget limits.</span>
                                <button type="button" class="btn-primary btn-small" onclick="window.loadBudgets ? window.loadBudgets() : location.reload()" style="display:inline-flex; align-items:center; gap:6px; margin:0 auto;">
                                    <span>Retry Connection</span>
                                </button>
                            </div>`;
                    }
                    const savingsGoalsEl = document.getElementById("savingsGoalsList");
                    if (savingsGoalsEl) {
                        savingsGoalsEl.innerHTML = `
                            <div class="empty-state-compact connection-error" style="grid-column:1/-1; text-align:center; padding:32px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                                <div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
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
                if (typeof saveDashboardCache === "function") {
                    saveDashboardCache({
                        expenses,
                        categories,
                        incomes: allIncomes,
                        savingsGoals: allSavingsGoals,
                        budgets: window.cachedBudgets || []
                    });
                } else {
                    saveExpenseCache(expenses, categories);
                }
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
                    if (typeof window.loadBudgets === "function") {
                        window.loadBudgets().catch(() => {});
                    }
                } else {
                    showToast("Couldn't connect to the server. Check your connection or server status.", "error");
                    document.querySelectorAll(".metric-card, .grid-4-metrics .metric-card").forEach(c => {
                        c.classList.remove("is-loading");
                        const val = c.querySelector(".metric-value");
                        if (val) val.innerHTML = '<span style="font-size:15px; color:var(--text-muted); font-weight:500;">Unavailable</span>';
                        const badge = c.querySelector(".status-badge");
                        if (badge) {
                            badge.textContent = "Offline";
                            badge.className = "status-badge badge-warning";
                        }
                        const recIncome = c.querySelector("#recurringIncomeText");
                        if (recIncome) recIncome.textContent = "Offline";
                        const expCount = c.querySelector("#expenseCountText");
                        if (expCount) expCount.textContent = "Offline";
                        const burnRate = c.querySelector("#burnRateBadge");
                        if (burnRate) burnRate.innerHTML = 'Burn: <span id="dailyBurnRate">Offline</span>';
                        const totalSaved = c.querySelector("#totalSavedProgress");
                        if (totalSaved) totalSaved.textContent = "Offline";

                        c.querySelectorAll(".skeleton").forEach(sk => {
                            if (sk.parentElement) sk.parentElement.textContent = "Offline";
                            else sk.remove();
                        });
                    });
                    const subsTotal = document.getElementById("subsMonthlyTotal");
                    if (subsTotal) subsTotal.innerHTML = '<span style="font-size:15px; color:var(--text-muted); font-weight:500;">Unavailable</span>';

                    const budgetListEl = document.getElementById("budgetList");
                    if (budgetListEl) {
                        budgetListEl.innerHTML = `
                            <div class="empty-state-compact connection-error" style="grid-column:1/-1; text-align:center; padding:32px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                                <div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                                <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">Server Connection Failed</p>
                                <span style="font-size:12.5px; display:block; margin-bottom:12px;">Could not reach the server to load your budget limits.</span>
                                <button type="button" class="btn-primary btn-small" onclick="window.loadBudgets ? window.loadBudgets() : location.reload()" style="display:inline-flex; align-items:center; gap:6px; margin:0 auto;">
                                    <span>Retry Connection</span>
                                </button>
                            </div>`;
                    }
                    const budgetUsageBadge = document.getElementById("budgetUsageBadge");
                    if (budgetUsageBadge) {
                        budgetUsageBadge.textContent = "Offline";
                        budgetUsageBadge.className = "status-badge badge-warning";
                    }
                    const healthBadge = document.getElementById("insightsHealthScoreText");
                    if (healthBadge) {
                        healthBadge.textContent = "Offline";
                    }
                    const lentEl = document.getElementById("loansTotalLent");
                    if (lentEl) lentEl.textContent = "--";
                    const borrowedEl = document.getElementById("loansTotalBorrowed");
                    if (borrowedEl) borrowedEl.textContent = "--";
                    const netEl = document.getElementById("loansNetBalance");
                    if (netEl) {
                        netEl.textContent = "--";
                        netEl.style.color = "var(--text-muted)";
                    }
                    const netStatusEl = document.getElementById("loansNetStatus");
                    if (netStatusEl) netStatusEl.textContent = "Offline";
                    const pendingCountEl = document.getElementById("loansPendingCount");
                    if (pendingCountEl) pendingCountEl.textContent = "--";
                    const settledCountEl = document.getElementById("loansSettledCount");
                    if (settledCountEl) settledCountEl.textContent = "--";
                    const lentPendingSubEl = document.getElementById("loansLentPendingCount");
                    if (lentPendingSubEl) lentPendingSubEl.textContent = "--";
                    const borrowedPendingSubEl = document.getElementById("loansBorrowedPendingCount");
                    if (borrowedPendingSubEl) borrowedPendingSubEl.textContent = "--";
                    const streakCountEl = document.getElementById("noSpendStreakCount");
                    if (streakCountEl) streakCountEl.textContent = "--";
                    const streakBadge = document.getElementById("noSpendStreakBadge");
                    if (streakBadge) {
                        streakBadge.className = "status-badge badge-neutral";
                        streakBadge.title = "Streak unavailable (Server offline)";
                    }
                    const safeDailyEl = document.getElementById("safeDailySpend");
                    if (safeDailyEl) safeDailyEl.textContent = "--";
                    const safeBadge = document.getElementById("safeDailySpendBadge");
                    if (safeBadge) {
                        safeBadge.className = "status-badge badge-neutral";
                        safeBadge.title = "Safe spend allowance unavailable (Server offline)";
                    }
                    const expenseListEl = document.getElementById("expenseList");
                    if (expenseListEl) {
                        expenseListEl.innerHTML = `
                            <div class="empty-state connection-error" style="text-align:center; padding:36px 16px;">
                                <div class="empty-state-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:8px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
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
                                <div class="empty-state-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:8px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
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
                                <div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                                <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">Server Connection Failed</p>
                                <span style="font-size:12.5px; display:block; margin-bottom:12px;">Could not reach the server to load your savings goals.</span>
                                <button type="button" class="btn-primary btn-small" onclick="location.reload()" style="display:inline-flex; align-items:center; gap:6px; margin:0 auto; background:#F59E0B; border-color:#F59E0B; color:#fff;">
                                    <span>Retry Connection</span>
                                </button>
                            </div>`;
                    }
                    const moneyFlowBody = document.getElementById("moneyFlowBody");
                    if (moneyFlowBody) {
                        moneyFlowBody.innerHTML = `
                            <div class="empty-state-compact connection-error" style="text-align:center; padding:24px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                                <div><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                                <p style="font-size:13px; font-weight:600; margin:0 0 4px; color:var(--text-main);">Server Connection Failed</p>
                                <span style="font-size:11.5px; display:block; margin-bottom:10px;">Could not reach the server to compute monthly cash flow.</span>
                                <button type="button" class="btn-primary btn-small" onclick="location.reload()" style="display:inline-flex; align-items:center; gap:6px; margin:0 auto; padding:6px 14px; font-size:12px;">
                                    <span>Retry Connection</span>
                                </button>
                            </div>`;
                    }
                    const insightsGrid = document.getElementById("insightsCardsGrid");
                    if (insightsGrid) {
                        insightsGrid.innerHTML = `
                            <div class="empty-state-compact connection-error" style="grid-column:1/-1; text-align:center; padding:24px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                                <div><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                                <p style="font-size:13px; font-weight:600; margin:0 0 4px; color:var(--text-main);">Smart Intelligence Unavailable</p>
                                <span style="font-size:11.5px; display:block; margin-bottom:10px;">Financial intelligence requires connection to your ledger.</span>
                                <button type="button" class="btn-primary btn-small" onclick="location.reload()" style="display:inline-flex; align-items:center; gap:6px; margin:0 auto; padding:6px 14px; font-size:12px;">
                                    <span>Retry Connection</span>
                                </button>
                            </div>`;
                    }
                    if (window.LoansManager && typeof window.LoansManager.renderOfflineState === "function") {
                        window.LoansManager.renderOfflineState();
                    } else {
                        const loansContainer = document.getElementById("loansListContainer");
                        if (loansContainer) {
                            loansContainer.innerHTML = `
                                <div class="empty-state-compact connection-error" style="text-align:center; padding:32px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                                    <div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                                    <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">Server Connection Failed</p>
                                    <span style="font-size:12.5px; display:block; margin-bottom:12px;">Could not reach the server to load your peer loan adjustments.</span>
                                    <button type="button" class="btn-primary btn-small" onclick="window.LoansManager ? window.LoansManager.fetchLoans() : location.reload()" style="display:inline-flex; align-items:center; gap:6px; margin:0 auto; background:#8B5CF6; border-color:#8B5CF6; color:#fff;">
                                        <span>Retry Connection</span>
                                    </button>
                                </div>`;
                        }
                    }
                    if (typeof window.renderChartEmptyStates === "function") {
                        window.renderChartEmptyStates(true);
                    }
                }
            }
        }

        return Object.freeze({ renderDashboardData, loadDashboard });
    }

    window.DashboardData = Object.freeze({ createController });
})();
