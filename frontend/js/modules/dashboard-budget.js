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
            formatCurrency,
            renderBudgetVsActualChart,
            renderFinancialInsights,
            showToast,
            appConfirm,
            openModal,
            closeModal,
            getCachedBudgets,
            setCachedBudgets
        } = deps;

        async function loadBudgets() {
            const usageBadge = document.getElementById("budgetUsageBadge");
            try {
                const budgets = await apiRequest(`/expenses/budget/status/user/${userId}`);
                const normalizedBudgets = Array.isArray(budgets) ? budgets : [];
                setCachedBudgets(normalizedBudgets);

                if (!normalizedBudgets.length) {
                    if (elements.budgetList) {
                        elements.budgetList.innerHTML = `
                            <div class="empty-state-compact" style="grid-column:1/-1; text-align:center; padding:28px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                                <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">No budget limits configured</p>
                                <span style="font-size:12.5px;">Click <strong>+ New Budget</strong> above to establish category spending ceilings.</span>
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
                        const safeName = escapeHtml(b.categoryName || 'Budget').replace(/'/g, "\\'");

                        return `
                        <div class="budget-item">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:8px;">
                                <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                                    <div style="width:36px; height:36px; border-radius:10px; background:${catColor.bg}; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">${getCategoryEmoji(b.categoryName)}</div>
                                    <div style="min-width:0; flex:1;">
                                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                            <span style="font-size:14px; font-weight:700; color:var(--text-main); line-height:1.2;">${escapeHtml(b.categoryName)}</span>
                                            <span class="status-badge badge-neutral" style="font-size:9px; padding:2px 7px; font-weight:700; letter-spacing:0.5px; line-height:1.2; text-transform:uppercase;">${periodLabel}</span>
                                        </div>
                                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px; font-variant-numeric:tabular-nums; line-height:1.3;">
                                            ${formatCurrency(b.spent)} <span style="opacity:0.7;">of</span> ${formatCurrency(b.limit)}
                                        </div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                                    <span style="font-size:13px; font-weight:800; color:${barColor}; margin-right:2px;">${usage.toFixed(0)}%</span>
                                    <button onclick="openEditBudget(${b.budgetId || 0}, ${b.categoryId || 0}, '${safeName}', ${b.limit || 0}, '${periodLabel}', '${startStr}', '${endStr}', ${b.intervalDays || 30})" class="btn-edit" title="Edit Budget Limit" style="height:28px; width:28px; padding:0; flex-shrink:0;">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button onclick="deleteBudgetLimit(${b.budgetId || 0}, ${b.categoryId || 0}, event)" class="btn-delete" title="Delete Budget Limit" style="height:28px; width:28px; padding:0; flex-shrink:0;">
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
                renderFinancialInsights(window.allExpenses || []);
            } catch (error) {
                console.error("Budget Error", error);
                if (elements.budgetList) {
                    elements.budgetList.innerHTML = `
                        <div class="empty-state-compact" style="grid-column:1/-1; text-align:center; padding:28px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                            <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">No budget limits configured</p>
                            <span style="font-size:12.5px;">Click <strong>+ New Budget</strong> above to establish category spending ceilings.</span>
                        </div>`;
                }
                if (usageBadge) {
                    usageBadge.textContent = "No Budget Set";
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
