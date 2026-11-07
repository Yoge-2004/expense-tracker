/* Dashboard budget data, rendering, and mutation controller. */
(function () {
    "use strict";

    function createController(deps) {
        const {
            elements,
            userId,
            apiRequest,
            getCategoryColor,
            getCategoryEmoji,
            escapeHtml,
            jsAttrEscape,
            formatCurrency,
            renderBudgetVsActualChart,
            renderFinancialInsights,
            showToast,
            appConfirm,
            getExpenses,
            getCachedBudgets,
            setCachedBudgets
        } = deps;

        function renderBudgetSkeleton() {
            if (!elements.budgetList) return;
            elements.budgetList.innerHTML = Array.from({ length: 3 }, () =>
                `<div class="skeleton skeleton-card"></div>`
            ).join('');
        }
        window.renderBudgetSkeleton = renderBudgetSkeleton;

        async function loadBudgets() {
            const usageBadge = document.getElementById("budgetUsageBadge");
            const cached = typeof getCachedBudgets === "function" ? getCachedBudgets() : null;
            if ((!cached || !cached.length) && elements.budgetList && !elements.budgetList.querySelector('.skeleton')) {
                renderBudgetSkeleton();
            }
            try {
                const budgets = await apiRequest(`/expenses/budget/status/user/${userId}`);
                const normalizedBudgets = Array.isArray(budgets) ? budgets : [];
                setCachedBudgets(normalizedBudgets);

                if (!normalizedBudgets.length) {
                    if (elements.budgetList) {
                        elements.budgetList.innerHTML = `
                            <div class="empty-state-compact empty-state-compact-connection grid-col-all">
                                <p class="empty-state-title">No budget limits configured</p>
                                <span class="empty-state-desc">Establish category spending ceilings to monitor outflows effectively.</span>
                                <button type="button" class="btn-primary btn-small" data-action="open-add-budget">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    <span>Configure Budget</span>
                                </button>
                            </div>`;
                    }
                    if (usageBadge) {
                        usageBadge.textContent = "No Budget Set";
                        usageBadge.className = "status-badge badge-outflow";
                    }
                    renderBudgetVsActualChart([]);
                    return;
                }

                const totalLimit = normalizedBudgets.reduce((acc, b) => acc + Number(b.limit || 0), 0);
                const totalSpent = normalizedBudgets.reduce((acc, b) => acc + Number(b.spent || 0), 0);
                const overallPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

                if (usageBadge) {
                    usageBadge.textContent = `${overallPct.toFixed(0)}% Used`;
                    usageBadge.className = "status-badge badge-outflow";
                }

                if (elements.budgetList) {
                    elements.budgetList.innerHTML = normalizedBudgets.map(b => {
                        const pct = Math.min(Number(b.percentage || 0), 100);
                        const usage = Number(b.percentage || 0);
                        const catColor = getCategoryColor(b.categoryName);
                        const barColor = usage > 100 ? 'var(--danger)' : usage > 80 ? 'var(--warning)' : (catColor?.color || 'var(--primary)');
                        const periodLabel = b.period ? b.period.toUpperCase() : 'MONTHLY';
                        const startStr = b.startDate || '';
                        const endStr = b.endDate || '';
                        const safeName = jsAttrEscape(b.categoryName || 'Budget');

                        return `
                        <div class="budget-item">
                            <div class="budget-item-top">
                                <div class="budget-item-meta">
                                    <div class="budget-cat-icon" data-cat-bg="${catColor.bg}">${getCategoryEmoji(b.categoryName)}</div>
                                    <div class="budget-cat-details">
                                        <div class="budget-cat-title-row">
                                            <span class="budget-cat-title">${escapeHtml(b.categoryName)}</span>
                                            <span class="status-badge badge-neutral budget-period-badge">${periodLabel}</span>
                                        </div>
                                        <div class="budget-cat-sub">
                                            ${formatCurrency(b.spent)} <span class="text-opacity-70">of</span> ${formatCurrency(b.limit)}
                                        </div>
                                    </div>
                                </div>
                                <div class="budget-item-actions">
                                    <span class="budget-usage-badge" data-bar-color="${barColor}">${usage.toFixed(0)}%</span>
                                    <button type="button" class="btn-edit btn-budget-action" data-action="edit-budget" data-budget-id="${b.budgetId || 0}" data-cat-id="${b.categoryId || 0}" data-cat-name="${safeName}" data-limit="${b.limit || 0}" data-period="${periodLabel}" data-start="${startStr}" data-end="${endStr}" data-interval="${b.intervalDays || 30}" title="Edit Budget Limit">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button type="button" class="btn-delete btn-budget-action" data-action="delete-budget" data-budget-id="${b.budgetId || 0}" data-cat-id="${b.categoryId || 0}" title="Delete Budget Limit">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            </div>
                            <div class="budget-status-row">
                                <span>${formatCurrency(b.spent)} of ${formatCurrency(b.limit)}</span>
                                <strong class="budget-status-value" data-bar-color="${barColor}">${Math.round(usage)}% used</strong>
                            </div>
                            <div class="budget-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(Math.max(usage, 0), 100)}" aria-label="${escapeHtml(b.categoryName || b.category?.name || 'Budget')} utilization">
                                <div class="budget-bar-fill" data-pct="${pct}" data-bar-color="${barColor}"></div>
                            </div>
                        </div>`;
                    }).join("");

                    elements.budgetList.querySelectorAll("[data-cat-bg]").forEach(el => {
                        el.style.backgroundColor = el.dataset.catBg;
                    });
                    elements.budgetList.querySelectorAll("[data-bar-color]").forEach(el => {
                        if (el.classList.contains("budget-bar-fill")) {
                            el.style.backgroundColor = el.dataset.barColor;
                        } else {
                            el.style.color = el.dataset.barColor;
                        }
                    });
                    elements.budgetList.querySelectorAll(".budget-bar-fill[data-pct]").forEach(el => {
                        el.style.width = el.dataset.pct + "%";
                    });
                }

                renderBudgetVsActualChart(normalizedBudgets);
                // `allExpenses` is a script-scoped `let` in dashboard.js, NOT a property of
                // `window`, so the previous `window.allExpenses || []` was always `[]` and
                // re-rendered the whole Smart Intelligence panel with zero expenses every
                // time budgets finished loading. Read it through the injected accessor.
                renderFinancialInsights(getExpenses());
            } catch (error) {
                console.error("Budget Error", error);
                if (elements.budgetList) {
                    elements.budgetList.innerHTML = `
                            <div class="empty-state-compact connection-error empty-state-compact-connection grid-col-all">
                                <div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                                <p class="empty-state-title">Server Connection Failed</p>
                                <span class="empty-state-desc">Could not reach the server to load your budget limits.</span>
                                <button type="button" class="btn-primary btn-small" data-action="retry-budgets">
                                    <span>Retry Connection</span>
                                </button>
                            </div>`;
                }
                if (usageBadge) {
                    usageBadge.textContent = "Offline";
                    usageBadge.className = "status-badge badge-neutral";
                }
            }
        }

        async function deleteBudgetLimit(budgetId, categoryId, event) {
            if (!(await appConfirm("Are you sure you want to delete this budget limit?"))) return;
            try {
                if (budgetId && budgetId > 0) {
                    await apiRequest(`/expenses/budget/${budgetId}`, { method: "DELETE" });
                } else if (categoryId && categoryId > 0) {
                    await apiRequest(`/expenses/budget/user/${userId}/category/${categoryId}`, { method: "DELETE" });
                }
                showToast("Budget limit deleted.", "success");
                await loadBudgets();
            } catch (error) {
                showToast(error.message, "error");
                const btn = event?.target?.closest(".btn-delete");
                if (btn) {
                    btn.classList.add("shake");
                    setTimeout(() => btn.classList.remove("shake"), 400);
                }
            }
        }

        
        if (elements.budgetList && !elements.budgetList.dataset.actionsBound) {
            elements.budgetList.dataset.actionsBound = "true";
            elements.budgetList.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-action]");
                if (!btn) return;
                const action = btn.dataset.action;
                if (action === "open-add-budget") {
                    document.getElementById("addBudgetBtn")?.click();
                } else if (action === "retry-budgets") {
                    if (typeof window.loadBudgets === "function") window.loadBudgets();
                    else location.reload();
                } else if (action === "edit-budget") {
                    const budgetId = Number(btn.dataset.budgetId || 0);
                    const categoryId = Number(btn.dataset.catId || 0);
                    const categoryName = btn.dataset.catName || "";
                    const limit = Number(btn.dataset.limit || 0);
                    const period = btn.dataset.period || "MONTHLY";
                    const startStr = btn.dataset.start || "";
                    const endStr = btn.dataset.end || "";
                    const intervalDays = Number(btn.dataset.interval || 30);
                    if (typeof window.openEditBudget === "function") {
                        window.openEditBudget(budgetId, categoryId, categoryName, limit, period, startStr, endStr, intervalDays);
                    }
                } else if (action === "delete-budget") {
                    const budgetId = Number(btn.dataset.budgetId || 0);
                    const categoryId = Number(btn.dataset.catId || 0);
                    deleteBudgetLimit(budgetId, categoryId, e);
                }
            });
        }

        return Object.freeze({ loadBudgets, deleteBudgetLimit });
    }

    window.DashboardBudget = Object.freeze({ createController });
})();
