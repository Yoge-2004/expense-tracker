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
            openModal,
            closeModal,
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
                            <div class="empty-state-compact u-inl-ebb486a">
                                <p class="u-inl-67e1f85">No budget limits configured</p>
                                <span class="u-inl-a4edebd">Establish category spending ceilings to monitor outflows effectively.</span>
                                <button type="button" class="btn-primary btn-small u-inl-48cfbfc" onclick="document.getElementById('addBudgetBtn')?.click()">
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
                        const barColor = usage > 100 ? 'var(--danger)' : usage > 80 ? 'var(--warning)' : 'var(--primary)';
                        const catColor = getCategoryColor(b.categoryName);
                        const periodLabel = b.period ? b.period.toUpperCase() : 'MONTHLY';
                        const startStr = b.startDate || '';
                        const endStr = b.endDate || '';
                        const safeName = jsAttrEscape(b.categoryName || 'Budget');

                        return `
                        <div class="budget-item">
                            <div class="u-inl-52003ac">
                                <div class="u-inl-f090d9f">
                                    <div style="width:36px; height:36px; border-radius:10px; background:${catColor.bg}; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">${getCategoryEmoji(b.categoryName)}</div>
                                    <div class="u-inl-4475a64">
                                        <div class="u-inl-9aded71">
                                            <span class="u-inl-69bf7cd">${escapeHtml(b.categoryName)}</span>
                                            <span class="status-badge badge-neutral u-inl-30299e8">${periodLabel}</span>
                                        </div>
                                        <div class="u-inl-8443f26">
                                            ${formatCurrency(b.spent)} <span class="u-inl-72cd808">of</span> ${formatCurrency(b.limit)}
                                        </div>
                                    </div>
                                </div>
                                <div class="u-inl-7a1f644">
                                    <span style="font-size:13px; font-weight:800; color:${barColor}; margin-right:2px;">${usage.toFixed(0)}%</span>
                                    <button onclick="openEditBudget(${b.budgetId || 0}, ${b.categoryId || 0}, '${safeName}', ${b.limit || 0}, '${periodLabel}', '${startStr}', '${endStr}', ${b.intervalDays || 30})" class="btn-edit u-inl-7bd8847" title="Edit Budget Limit">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button onclick="deleteBudgetLimit(${b.budgetId || 0}, ${b.categoryId || 0}, event)" class="btn-delete u-inl-7bd8847" title="Delete Budget Limit">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            </div>
                            <div class="budget-status-row">
                                <span>${formatCurrency(b.spent)} of ${formatCurrency(b.limit)}</span>
                                <strong class="budget-status-value" style="color:${barColor};">${Math.round(usage)}% used</strong>
                            </div>
                            <div class="budget-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(Math.max(usage, 0), 100)}" aria-label="${escapeHtml(b.categoryName || b.category?.name || 'Budget')} utilization">
                                <div class="budget-bar-fill" style="width:${pct}%; background:${barColor};"></div>
                            </div>
                        </div>`;
                    }).join("");
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
                            <div class="empty-state-compact connection-error u-inl-ebb486a">
                                <div class="u-inl-4d84691">⚠️</div>
                                <p class="u-inl-67e1f85">Server Connection Failed</p>
                                <span class="u-inl-a4edebd">Could not reach the server to load your budget limits.</span>
                                <button type="button" class="btn-primary btn-small u-inl-48cfbfc" onclick="window.loadBudgets ? window.loadBudgets() : location.reload()">
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

        return Object.freeze({ loadBudgets, deleteBudgetLimit });
    }

    window.DashboardBudget = Object.freeze({ createController });
})();
