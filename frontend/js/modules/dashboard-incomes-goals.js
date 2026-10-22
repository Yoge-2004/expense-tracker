var elements = window.elements || window.DashboardDom?.elements || {};
var userId = window.userId || localStorage.getItem("userId");
function updateCashFlowMetrics(expenses, incomes, savingsGoals) {
    document.querySelectorAll(".grid-4-metrics .metric-card").forEach(card => card.classList.remove("is-loading"));
    // Income excludes reimbursements; money that came back reduces spending instead.
    const totalSpent = window.MoneyFlow.netSpent(expenses || [], incomes || []);
    const totalIncome = window.MoneyFlow.earnedTotal(incomes || []);
    const netCashFlow = totalIncome - totalSpent;
    // The monthly panel always reads the full data set, even when the cards show a filtered view.
    window.DashboardMoneyFlow?.render(allExpenses, allIncomes, allSavingsGoals);
    const recurringIncomes = (incomes || []).filter(i => i.isRecurring || i.recurring).length;
    const savingsRate = totalIncome > 0 ? ((netCashFlow / totalIncome) * 100) : 0;
    const totalSaved = (savingsGoals || []).reduce((acc, curr) => acc + Number(curr.currentAmount || 0), 0);

    const totalIncomeEl = document.getElementById("totalIncomeAmount");
    if (totalIncomeEl) animateNumber(totalIncomeEl, totalIncome, true);

    const incomeCountBadge = document.getElementById("incomeCountBadge");
    if (incomeCountBadge) incomeCountBadge.textContent = `${(incomes || []).length} Inflow${(incomes || []).length === 1 ? "" : "s"}`;

    const recurringIncomeText = document.getElementById("recurringIncomeText");
    if (recurringIncomeText) recurringIncomeText.textContent = `${recurringIncomes} recurring stream${recurringIncomes === 1 ? "" : "s"}`;

    const netCashFlowEl = document.getElementById("netCashFlowAmount");
    if (netCashFlowEl) {
        animateNumber(netCashFlowEl, netCashFlow, true, true);
        netCashFlowEl.style.color = "";
    }

    const netFlowBadge = document.getElementById("netFlowBadge");
    if (netFlowBadge) {
        if (netCashFlow > 0) {
            netFlowBadge.textContent = "Surplus";
            netFlowBadge.className = "status-badge badge-netflow";
        } else if (netCashFlow < 0) {
            netFlowBadge.textContent = "Deficit";
            netFlowBadge.className = "status-badge badge-netflow";
        } else {
            netFlowBadge.textContent = "Balanced";
            netFlowBadge.className = "status-badge badge-netflow";
        }
    }

    const savingsRateEl = document.getElementById("savingsRateValue");
    if (savingsRateEl) {
        animatePercent(savingsRateEl, savingsRate);
        savingsRateEl.style.color = "";
    }

    const savingsGoalBadge = document.getElementById("savingsGoalBadge");
    if (savingsGoalBadge) {
        savingsGoalBadge.textContent = `${(savingsGoals || []).length} Goal${(savingsGoals || []).length === 1 ? "" : "s"}`;
    }

    const totalSavedProgress = document.getElementById("totalSavedProgress");
    if (totalSavedProgress) {
        totalSavedProgress.textContent = `Saved: ${formatCurrency(totalSaved)}`;
    }

    let dailyBurnEl = document.getElementById("dailyBurnRate");
    if (!dailyBurnEl) {
        const burnBadge = document.getElementById("burnRateBadge");
        if (burnBadge) {
            burnBadge.innerHTML = 'Burn: <span id="dailyBurnRate"></span>';
            dailyBurnEl = document.getElementById("dailyBurnRate");
        }
    }
    if (dailyBurnEl && (dailyBurnEl.querySelector(".skeleton") || dailyBurnEl.textContent.trim() === "" || dailyBurnEl.textContent.includes("—"))) {
        const now = new Date();
        const currentDay = Math.max(now.getDate(), 1);
        const currentMonthExpenses = (expenses || []).filter(e => {
            const d = new Date(e.expenseDate);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const currentMonthSpent = currentMonthExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const dailyBurn = currentMonthSpent / currentDay;
        dailyBurnEl.textContent = `${formatCurrency(dailyBurn)} / day`;
    }
}

function formatGoalFrequency(freq, interval) {
    if (!freq) return "Monthly";
    switch ((freq || "").toUpperCase()) {
        case "DAILY": return "Daily";
        case "WEEKLY": return "Weekly";
        case "BI_WEEKLY":
        case "BIWEEKLY": return "Bi-Weekly";
        case "MONTHLY": return "Monthly";
        case "YEARLY": return "Yearly";
        case "CUSTOM": return interval ? `Every ${interval}d` : "Custom";
        default: return "Monthly";
    }
}

function formatIncomeFrequency(freq, interval) {
    if (!freq) return "Monthly";
    switch ((freq || "").toUpperCase()) {
        case "DAILY": return "Daily";
        case "WEEKLY": return "Weekly";
        case "MONTHLY": return "Monthly";
        case "YEARLY": return "Yearly";
        case "CUSTOM": return interval ? `Every ${interval}d` : "Custom";
        default: return "Monthly";
    }
}

let currentIncomeFilter = 'all'; // 'all', 'recurring', 'one-time'

function applyIncomeFilters() {
    const listEl = document.getElementById("incomeList");
    if (!listEl) return;

    if (!allIncomes || allIncomes.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💰</div>
                <div class="empty-state-title">No income records logged yet</div>
                <div class="empty-state-sub">Click <strong>Record Income</strong> above to track your salary, investments, client retainers, or other inflows.</div>
            </div>`;
        return;
    }

    let filtered = [...allIncomes];
    const search = (elements.filterSearch?.value || document.getElementById("incomeSearchInput")?.value || "").toLowerCase().trim();

    const startDate = document.getElementById("incomeFilterStartDate")?.value || "";
    const endDate = document.getElementById("incomeFilterEndDate")?.value || "";
    const frequency = document.getElementById("incomeFilterFrequency")?.value || "all";
    const sort = document.getElementById("incomeFilterSort")?.value || "date-desc";

    if (startDate && endDate && startDate > endDate) {
        showToast("Income start date cannot be after end date.", "error");
        const endInput = document.getElementById("incomeFilterEndDate");
        if (endInput) endInput.value = "";
        return;
    }

    // 1. Search filter
    if (search) {
        filtered = filtered.filter(inc =>
            (inc.source && inc.source.toLowerCase().includes(search)) ||
            (inc.description && inc.description.toLowerCase().includes(search))
        );
    }

    // 2. Type quick pill filter
    if (currentIncomeFilter === 'recurring') {
        filtered = filtered.filter(inc => inc.isRecurring || inc.recurring);
    } else if (currentIncomeFilter === 'one-time') {
        filtered = filtered.filter(inc => !(inc.isRecurring || inc.recurring));
    }

    // 3. Frequency filter
    if (frequency !== 'all') {
        filtered = filtered.filter(inc => {
            if (!(inc.isRecurring || inc.recurring)) return false;
            const incFreq = (inc.frequency || "MONTHLY").toUpperCase();
            return incFreq === frequency;
        });
    }

    // 4. Date range filter
    if (startDate) {
        filtered = filtered.filter(inc => (inc.incomeDate || '').split('T')[0] >= startDate);
    }
    if (endDate) {
        filtered = filtered.filter(inc => (inc.incomeDate || '').split('T')[0] <= endDate);
    }

    // 5. Sorting
    filtered.sort((a, b) => {
        if (sort === 'date-desc') {
            const dDiff = new Date(b.incomeDate) - new Date(a.incomeDate);
            if (dDiff !== 0) return dDiff;
            return (b.id || 0) - (a.id || 0);
        }
        if (sort === 'date-asc') {
            const dDiff = new Date(a.incomeDate) - new Date(b.incomeDate);
            if (dDiff !== 0) return dDiff;
            return (a.id || 0) - (b.id || 0);
        }
        if (sort === 'amount-desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
        if (sort === 'amount-asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
        return 0;
    });

    renderIncomesTableOnly(filtered);
}
window.applyIncomeFilters = applyIncomeFilters;

function getIncomeSourceEmoji(source) {
    const s = (source || '').toLowerCase();
    if (s.includes('salary') || s.includes('paycheck') || s.includes('wage') || s.includes('job') || s.includes('employer')) return '💼';
    if (s.includes('freelance') || s.includes('contract') || s.includes('consult') || s.includes('client') || s.includes('gig')) return '💻';
    if (s.includes('invest') || s.includes('stock') || s.includes('equity') || s.includes('mutual') || s.includes('crypto') || s.includes('trading')) return '📈';
    if (s.includes('dividend') || s.includes('interest') || s.includes('yield') || s.includes('capital gain')) return '💰';
    if (s.includes('rental') || s.includes('rent') || s.includes('real estate') || s.includes('property') || s.includes('tenant') || s.includes('airbnb')) return '🏢';
    if (s.includes('business') || s.includes('sales') || s.includes('revenue') || s.includes('store') || s.includes('commerce') || s.includes('shop')) return '🏬';
    if (s.includes('bonus') || s.includes('commission') || s.includes('incentive') || s.includes('prize') || s.includes('reward')) return '🏆';
    if (s.includes('gift') || s.includes('grant') || s.includes('allowance') || s.includes('scholarship') || s.includes('donation')) return '🎁';
    if (s.includes('refund') || s.includes('reimburse') || s.includes('cashback') || s.includes('tax refund')) return '💳';
    if (s.includes('pension') || s.includes('retirement') || s.includes('social security') || s.includes('401k') || s.includes('ira')) return '🏦';
    return '💵';
}
window.getIncomeSourceEmoji = getIncomeSourceEmoji;

function renderIncomesTableOnly(incomes) {
    const listEl = document.getElementById("incomeList");
    if (!listEl) return;

    if (!incomes || incomes.length === 0) {
        const isFiltered = (allIncomes && allIncomes.length > 0);
        if (isFiltered) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-title">No matching incomes found</div>
                    <div class="empty-state-sub">Try adjusting your search query, cadence filter, or date range.</div>
                    <button type="button" class="btn-icon btn-text-icon u-inl-6422726" onclick="resetIncomeFilters()">
                        <span>Clear Income Filters</span>
                    </button>
                </div>`;
        } else {
            listEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💰</div>
                    <div class="empty-state-title">No income records logged yet</div>
                    <div class="empty-state-sub">Click <strong>Record Income</strong> above to track your salary, investments, client retainers, or other inflows.</div>
                </div>`;
        }
        return;
    }

    listEl.innerHTML = `
        <div class="income-table-container">
            <table class="data-table income-table u-inl-4408d24">
                <thead>
                    <tr class="u-inl-d4446d2">
                        <th class="u-inl-8f3857c">Date</th>
                        <th class="u-inl-8f3857c">Source</th>
                        <th class="u-inl-f5c04ae">Description</th>
                        <th class="u-inl-8f3857c">Type</th>
                        <th class="u-inl-a4ec1d1">Amount</th>
                        <th class="u-inl-67553e5">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${incomes.map((inc, idx) => {
                        const isRec = !!(inc.isRecurring || inc.recurring);
                        const freqLabel = formatIncomeFrequency(inc.frequency, inc.intervalDays);
                        return `
                        <tr class="table-row-stagger" style="animation-delay: ${Math.min(idx * 35, 350)}ms; border-bottom:1px solid var(--border); font-size:13.5px;">
                            <td class="u-inl-f4f1286">${inc.incomeDate || "—"}</td>
                            <td class="u-inl-f401493">
                                <div class="u-inl-8e160d0">
                                    <div class="income-emoji-box" title="${escapeHtml(inc.source || 'Income')}">
                                        <span>${getIncomeSourceEmoji(inc.source)}</span>
                                    </div>
                                    <span class="u-inl-5d51705">${escapeHtml(inc.source || "Income")}</span>
                                    ${incomeClassificationTags(inc)}
                                </div>
                            </td>
                            <td class="income-desc-cell u-inl-40178e1" title="${escapeHtml(inc.description || "")}">${escapeHtml(inc.description || "—")}</td>
                            <td class="u-inl-b2b1904">
                                ${isRec 
                                    ? `<span class="status-badge badge-success u-inl-0a4a93b"><span class="u-inl-6b9c179">⟳</span> Recurring (${freqLabel})</span>` 
                                    : '<span class="status-badge badge-neutral u-inl-0b1d5ce"><span class="u-inl-8b68521">⚡</span> One-Time</span>'}
                            </td>
                            <td class="u-inl-1c44215">
                                +${formatCurrency(inc.amount)}
                            </td>
                            <td class="u-inl-5b21188">
                                <button class="btn-icon edit-income-btn u-inl-3d95a41" data-inc-id="${inc.id}" data-inc-source="${escapeHtml(inc.source || "")}" data-inc-amount="${inc.amount || 0}" data-inc-date="${inc.incomeDate || ""}" data-inc-desc="${escapeHtml(inc.description || "")}" data-inc-recurring="${isRec}" data-inc-freq="${escapeHtml(inc.frequency || "MONTHLY")}" data-inc-interval="${inc.intervalDays || 1}" data-inc-kind="${escapeHtml(inc.kind || "")}" data-inc-month="${escapeHtml(inc.countsTowardMonth || "")}" data-inc-cat="${inc.reimbursedCategoryId || ""}" title="Edit Income">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button class="btn-icon delete-income-btn u-inl-5b795a4" data-income-id="${inc.id}" title="Delete Income">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </td>
                        </tr>
                    `;}).join("")}
                </tbody>
            </table>
        </div>
    `;

    listEl.querySelectorAll(".edit-income-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const modal = document.getElementById("incomeModal");
            if (!modal) return;
            document.getElementById("incomeId").value = btn.getAttribute("data-inc-id") || "";
            document.getElementById("incomeSource").value = btn.getAttribute("data-inc-source") || "";
            document.getElementById("incomeAmount").value = btn.getAttribute("data-inc-amount") || "";
            document.getElementById("incomeDate").value = btn.getAttribute("data-inc-date") || new Date().toISOString().split("T")[0];
            document.getElementById("incomeDesc").value = btn.getAttribute("data-inc-desc") || "";
            setIncomeClassification(btn.getAttribute("data-inc-kind"), btn.getAttribute("data-inc-month"), btn.getAttribute("data-inc-cat"));

            const isRec = btn.getAttribute("data-inc-recurring") === "true";
            const incRecEl = document.getElementById("incomeIsRecurring");
            if (incRecEl) incRecEl.checked = isRec;

            const freq = btn.getAttribute("data-inc-freq") || "MONTHLY";
            const interval = btn.getAttribute("data-inc-interval") || "1";
            const incFreqEl = document.getElementById("incomeRecurringFrequency");
            if (incFreqEl) incFreqEl.value = freq;
            const incIntervalEl = document.getElementById("incomeRecurringIntervalDays");
            if (incIntervalEl) incIntervalEl.value = interval;

            const incRecOptions = document.getElementById("incomeRecurringOptions");
            if (incRecOptions) {
                incRecOptions.hidden = !isRec;
                incRecOptions.style.display = isRec ? "flex" : "none";
            }
            const incCustomWrap = document.getElementById("incomeCustomIntervalWrap");
            if (incCustomWrap) {
                const isCustom = freq === "CUSTOM";
                incCustomWrap.hidden = !(isRec && isCustom);
                incCustomWrap.style.display = (isRec && isCustom) ? "flex" : "none";
            }

            const titleEl = document.getElementById("incomeModalTitle");
            if (titleEl) titleEl.textContent = "Edit Income Stream";
            openModal(modal);
        });
    });

    listEl.querySelectorAll(".delete-income-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const incId = btn.getAttribute("data-income-id");
            if (!(await window.appConfirm("Are you sure you want to delete this income stream?"))) return;
            try {
                setLoading(true, "Deleting income...");
                await apiRequest(`/incomes/${incId}/user/${userId}`, { method: "DELETE" });
                showToast("Income record deleted.", "success");
                await loadDashboard(true);
            } catch (err) {
                showToast(err.message || "Failed to delete income", "error");
            } finally {
                setLoading(false);
            }
        });
    });
}

function openEditSavingsGoal(goalId) {
    const goal = (allSavingsGoals || []).find(g => String(g.id) === String(goalId));
    if (!goal || !savingsGoalModal) return;
    document.getElementById("goalId").value = goal.id;
    document.getElementById("goalName").value = goal.name || "";
    document.getElementById("goalTargetAmount").value = goal.targetAmount || "";
    document.getElementById("goalCurrentAmount").value = goal.currentAmount || "0";
    document.getElementById("goalTargetDate").value = goal.targetDate || "";
    
    const recCheck = document.getElementById("goalIsRecurring");
    const recFields = document.getElementById("goalRecurringFields");
    const isRec = !!goal.isRecurring;
    if (recCheck) recCheck.checked = isRec;
    if (recFields) {
        recFields.style.display = isRec ? "block" : "none";
        recFields.hidden = !isRec;
    }
    const recAmt = document.getElementById("goalRecurringAmount");
    if (recAmt) recAmt.value = goal.recurringAmount || "";
    const goalFreq = document.getElementById("goalFrequency");
    if (goalFreq) {
        goalFreq.value = goal.frequency || "MONTHLY";
        if (window.syncCustomSelect) window.syncCustomSelect(goalFreq);
    }
    const customWrap = document.getElementById("goalCustomIntervalWrap");
    if (customWrap) {
        const isCustom = goal.frequency === "CUSTOM";
        customWrap.style.display = isCustom ? "block" : "none";
        customWrap.hidden = !isCustom;
        const intervalInput = document.getElementById("goalRecurringIntervalDays");
        if (intervalInput) intervalInput.value = goal.intervalDays || 30;
    }
    const title = document.getElementById("savingsGoalModalTitle");
    if (title) title.textContent = "Edit Savings Goal";
    openModal(savingsGoalModal);
}
window.openEditSavingsGoal = openEditSavingsGoal;

function renderIncomes(incomes) {
    allIncomes = Array.isArray(incomes) ? incomes : [];
    applyIncomeFilters();
    updateStreamBadges();
}
window.renderIncomes = renderIncomes;

function renderSavingsSkeleton() {
    const container = document.getElementById("savingsGoalsList");
    if (!container) return;
    container.innerHTML = Array.from({ length: 3 }, () =>
        `<div class="skeleton skeleton-card"></div>`
    ).join('');
}
window.renderSavingsSkeleton = renderSavingsSkeleton;

function renderSavingsGoals(goals) {
    allSavingsGoals = Array.isArray(goals) ? goals : [];
    const container = document.getElementById("savingsGoalsList");
    if (!container) return;
    if (!allSavingsGoals || allSavingsGoals.length === 0) {
        container.innerHTML = `
            <div class="empty-state-compact u-inl-1e0a7c3">
                <p class="u-inl-67e1f85">No savings goals configured yet</p>
                <span class="u-inl-a4edebd">Set targets for emergency reserves, investments, or travel milestones.</span>
                <button type="button" class="btn-primary btn-small u-inl-bae9083" onclick="document.getElementById('addGoalBtn')?.click()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>Create Savings Goal</span>
                </button>
            </div>`;
        return;
    }

    container.innerHTML = goals.map((goal, idx) => {
        const target = Number(goal.targetAmount || 0);
        const current = Number(goal.currentAmount || 0);
        const ratio = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        const isCompleted = current >= target;

        return `
            <div class="card savings-goal-card hover-lift table-row-stagger" style="animation-delay: ${Math.min(idx * 45, 450)}ms; padding:18px; border:1px solid var(--border); border-radius:14px; background:var(--card-bg, rgba(255,255,255,0.03)); width:100%; max-width:100%; box-sizing:border-box;">
                <div class="u-inl-6dca552">
                    <div>
                        <h4 class="u-inl-7952655">${escapeHtml(goal.name || "Savings Goal")}</h4>
                        <span class="u-inl-4b3791b">Target: ${goal.targetDate || "Flexible"}</span>
                        ${goal.isRecurring ? `
                            <div class="u-inl-5c35201">
                                🔁 <strong>${formatCurrency(goal.recurringAmount)}</strong> / ${escapeHtml(formatGoalFrequency(goal.frequency, goal.intervalDays))}
                                ${goal.nextDueDate ? `• Next: ${formatDate(goal.nextDueDate)}` : ''}
                            </div>
                        ` : ''}
                    </div>
                    ${isCompleted 
                        ? '<span class="status-badge badge-success badge-pulse-glow u-inl-8b68521">Completed 🎯</span>'
                        : `<span class="status-badge badge-warning u-inl-8b68521">${ratio}% Achieved</span>`}
                </div>
                
                <div class="u-inl-d3f6a99">
                    <div class="u-inl-5c83735">
                        <span class="u-inl-aee5a7d">${formatCurrency(current)}</span>
                        <span class="u-inl-5b795a4">${formatCurrency(target)}</span>
                    </div>
                    <div class="u-inl-784deb7">
                        <div class="goal-progress-fill u-inl-fdabbe0" data-target-width="${ratio}%"></div>
                    </div>
                </div>

                <div class="u-inl-2137504">
                    <button class="btn-primary btn-small deposit-goal-btn u-inl-03e49a6" data-goal-id="${goal.id}" data-goal-name="${escapeHtml(goal.name)}">
                        + Deposit
                    </button>
                    <div class="u-inl-f84328f">
                        <button class="btn-icon btn-edit edit-goal-btn" data-goal-id="${goal.id}" title="Edit Goal" aria-label="Edit savings goal">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn-icon btn-delete delete-goal-btn" data-goal-id="${goal.id}" title="Delete Goal" aria-label="Delete savings goal">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    requestAnimationFrame(() => {
        container.querySelectorAll(".goal-progress-fill").forEach(fill => {
            const tw = fill.getAttribute("data-target-width");
            if (tw) fill.style.width = tw;
        });
    });

    container.querySelectorAll(".deposit-goal-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const goalId = btn.getAttribute("data-goal-id");
            const goalName = btn.getAttribute("data-goal-name");
            document.getElementById("depositGoalId").value = goalId;
            const depositTitle = document.getElementById("savingsDepositTitle");
            if (depositTitle) {
                depositTitle.textContent = `Contribute to ${goalName}`;
            }
            document.getElementById("depositAmount").value = "";
            openModal(document.getElementById("savingsDepositModal"));
        });
    });

    container.querySelectorAll(".edit-goal-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const goalId = btn.getAttribute("data-goal-id");
            openEditSavingsGoal(goalId);
        });
    });

    container.querySelectorAll(".delete-goal-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const goalId = btn.getAttribute("data-goal-id");
            if (!(await window.appConfirm("Are you sure you want to delete this savings goal?"))) return;
            try {
                setLoading(true, "Deleting savings goal...");
                await apiRequest(`/savings/goals/${goalId}/user/${userId}`, { method: "DELETE" });
                showToast("Savings goal deleted.", "success");
                await loadDashboard(true);
            } catch (err) {
                showToast(err.message || "Failed to delete savings goal", "error");
            } finally {
                setLoading(false);
            }
        });
    });
}

// Income Modal & Form
const incomeModal = document.getElementById("incomeModal");
const incomeForm = document.getElementById("incomeForm");
const openIncomeModalBtn = document.getElementById("openIncomeModalBtn");
const addIncomeTableBtn = document.getElementById("addIncomeTableBtn");
const closeIncomeModalBtn = document.getElementById("closeIncomeModalBtn");

function openNewIncomeModal() {
    const modal = document.getElementById("incomeModal") || incomeModal;
    if (!modal) return;
    const form = document.getElementById("incomeForm") || incomeForm;
    if (form) form.reset();
    const idEl = document.getElementById("incomeId");
    if (idEl) idEl.value = "";
    const srcEl = document.getElementById("incomeSource");
    if (srcEl) srcEl.value = "";
    const amtEl = document.getElementById("incomeAmount");
    if (amtEl) amtEl.value = "";
    const dateEl = document.getElementById("incomeDate");
    if (dateEl) dateEl.value = new Date().toISOString().split("T")[0];
    const descEl = document.getElementById("incomeDesc");
    if (descEl) descEl.value = "";
    setIncomeClassification("", "", "");
    const recEl = document.getElementById("incomeIsRecurring");
    if (recEl) recEl.checked = false;
    const incFreqEl = document.getElementById("incomeRecurringFrequency");
    if (incFreqEl) incFreqEl.value = "MONTHLY";
    const incIntervalEl = document.getElementById("incomeRecurringIntervalDays");
    if (incIntervalEl) incIntervalEl.value = "1";
    updateIncomeRecurrenceUI();
    const titleEl = document.getElementById("incomeModalTitle");
    if (titleEl) titleEl.textContent = "Record Income";
    openModal(modal);
}
window.openNewIncomeModal = openNewIncomeModal;

openIncomeModalBtn?.addEventListener("click", openNewIncomeModal);
addIncomeTableBtn?.addEventListener("click", openNewIncomeModal);
closeIncomeModalBtn?.addEventListener("click", () => closeModal(incomeModal));
incomeModal?.addEventListener("click", (e) => {
    if (e.target === incomeModal) closeModal(incomeModal);
});

// Income recurrence visibility toggles
const incomeIsRecurringEl = document.getElementById("incomeIsRecurring");
const incomeRecurringOptionsEl = document.getElementById("incomeRecurringOptions");
const incomeRecurringFrequencyEl = document.getElementById("incomeRecurringFrequency");
const incomeCustomIntervalWrapEl = document.getElementById("incomeCustomIntervalWrap");

function syncIncomeRecurringIntervalVisibility() {
    if (!incomeCustomIntervalWrapEl) return;
    const isChecked = incomeIsRecurringEl ? incomeIsRecurringEl.checked : false;
    const isCustom = incomeRecurringFrequencyEl ? (incomeRecurringFrequencyEl.value === "CUSTOM") : false;
    const shouldShow = isChecked && isCustom;
    incomeCustomIntervalWrapEl.hidden = !shouldShow;
    incomeCustomIntervalWrapEl.style.display = shouldShow ? "flex" : "none";
}

function updateIncomeRecurrenceUI() {
    const isChecked = incomeIsRecurringEl ? incomeIsRecurringEl.checked : false;
    if (incomeRecurringOptionsEl) {
        incomeRecurringOptionsEl.hidden = !isChecked;
        incomeRecurringOptionsEl.style.display = isChecked ? "flex" : "none";
    }
    syncIncomeRecurringIntervalVisibility();
}

// ---- Income classification: type, which month it counts toward, and what a reimbursement pays back
function refreshIncomeMonthOptions(selected) {
    const select = document.getElementById("incomeCountsToward");
    if (!select) return;
    const MoneyFlow = window.MoneyFlow;
    const base = MoneyFlow.monthKey(document.getElementById("incomeDate")?.value) || MoneyFlow.monthKey(new Date());
    const keep = selected !== undefined ? selected : select.value;
    const options = [
        ["", `Same month it is received (${MoneyFlow.monthLabel(base)})`],
        [MoneyFlow.shiftMonth(base, 1), `Next month (${MoneyFlow.monthLabel(MoneyFlow.shiftMonth(base, 1))})`],
        [MoneyFlow.shiftMonth(base, -1), `Previous month (${MoneyFlow.monthLabel(MoneyFlow.shiftMonth(base, -1))})`]
    ];
    if (keep && !options.some(([value]) => value === keep)) options.push([keep, MoneyFlow.monthLabel(keep)]);
    select.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    select.value = options.some(([value]) => value === keep) ? keep : "";
    if (window.syncCustomSelect) window.syncCustomSelect(select);
}

function populateReimbursedCategories(selectedId) {
    const select = document.getElementById("incomeReimbursedCategory");
    if (!select) return;
    const options = (allCategories || [])
        .map(c => `<option value="${c.id}">${escapeHtml(c.name || "")}</option>`)
        .join("");
    select.innerHTML = `<option value="">The month as a whole</option>${options}`;
    select.value = selectedId ? String(selectedId) : "";
    if (window.syncCustomSelect) window.syncCustomSelect(select);
}

function syncIncomeKindUI() {
    const isReimbursement = document.getElementById("incomeKind")?.value === "REIMBURSEMENT";
    const categoryGroup = document.getElementById("incomeReimbursedGroup");
    if (categoryGroup) categoryGroup.hidden = !isReimbursement;
    // Money coming back is a one-off, never a recurring stream.
    const recurringWrap = incomeIsRecurringEl?.closest("label")?.parentElement;
    if (recurringWrap) recurringWrap.hidden = isReimbursement;
    if (isReimbursement && incomeIsRecurringEl?.checked) {
        incomeIsRecurringEl.checked = false;
        updateIncomeRecurrenceUI();
    }
}

/** Fill the three classification fields. The API reports the month a record counts toward even when it
 *  is simply the month of its date, so that case is shown as "same month". */
function setIncomeClassification(kind, countsTowardMonth, reimbursedCategoryId) {
    const kindEl = document.getElementById("incomeKind");
    if (kindEl) {
        kindEl.value = kind || "";
        if (window.syncCustomSelect) window.syncCustomSelect(kindEl);
    }
    const dateMonth = window.MoneyFlow.monthKey(document.getElementById("incomeDate")?.value);
    refreshIncomeMonthOptions(countsTowardMonth && countsTowardMonth !== dateMonth ? countsTowardMonth : "");
    populateReimbursedCategories(reimbursedCategoryId);
    syncIncomeKindUI();
}

/** Small tags on an income row: "Money back" and, when it was assigned elsewhere, the month it counts toward. */
function incomeClassificationTags(inc) {
    const MoneyFlow = window.MoneyFlow;
    const tags = [];
    if (MoneyFlow.kindOf(inc) === "REIMBURSEMENT") tags.push('<span class="income-tag income-tag--back">Money back</span>');
    const counted = MoneyFlow.effectiveMonth(inc);
    if (counted && counted !== MoneyFlow.monthKey(inc.incomeDate)) {
        tags.push(`<span class="income-tag income-tag--moved">Counts toward ${MoneyFlow.monthLabel(counted)}</span>`);
    }
    return tags.length ? `<span class="income-tags">${tags.join("")}</span>` : "";
}

document.getElementById("incomeKind")?.addEventListener("change", syncIncomeKindUI);
document.getElementById("incomeDate")?.addEventListener("change", () => refreshIncomeMonthOptions());

incomeIsRecurringEl?.addEventListener("change", updateIncomeRecurrenceUI);
incomeRecurringFrequencyEl?.addEventListener("change", syncIncomeRecurringIntervalVisibility);

// Income filters UI listeners
const toggleIncomeFiltersBtn = document.getElementById("toggleIncomeFiltersBtn");
const incomeFilterPanel = document.getElementById("incomeFilterPanel");
toggleIncomeFiltersBtn?.addEventListener("click", () => {
    if (!incomeFilterPanel) return;
    const isOpen = incomeFilterPanel.classList.toggle("active");
    toggleIncomeFiltersBtn.style.color = isOpen ? "#10B981" : "";
    toggleIncomeFiltersBtn.style.borderColor = isOpen ? "rgba(16, 185, 129, 0.4)" : "";
});

const incomePillsBar = document.getElementById("incomePillsBar");
incomePillsBar?.querySelectorAll(".pill-chip").forEach(pill => {
    pill.addEventListener("click", () => {
        incomePillsBar.querySelectorAll(".pill-chip").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        currentIncomeFilter = pill.getAttribute("data-income-filter") || "all";
        applyIncomeFilters();
    });
});

document.getElementById("incomeSearchInput")?.addEventListener("input", debounce(applyIncomeFilters, 250));
document.getElementById("incomeFilterStartDate")?.addEventListener("change", applyIncomeFilters);
document.getElementById("incomeFilterEndDate")?.addEventListener("change", applyIncomeFilters);
document.getElementById("incomeFilterFrequency")?.addEventListener("change", applyIncomeFilters);
document.getElementById("incomeFilterSort")?.addEventListener("change", applyIncomeFilters);

function resetIncomeFilters() {
    const searchInput = document.getElementById("incomeSearchInput");
    if (searchInput) searchInput.value = "";
    const startDate = document.getElementById("incomeFilterStartDate");
    if (startDate) startDate.value = "";
    const endDate = document.getElementById("incomeFilterEndDate");
    if (endDate) endDate.value = "";
    const freq = document.getElementById("incomeFilterFrequency");
    if (freq) {
        freq.value = "all";
        if (window.syncCustomSelect) window.syncCustomSelect(freq);
    }
    const sort = document.getElementById("incomeFilterSort");
    if (sort) {
        sort.value = "date-desc";
        if (window.syncCustomSelect) window.syncCustomSelect(sort);
    }

    incomePillsBar?.querySelectorAll(".pill-chip").forEach(p => {
        p.classList.toggle("active", p.getAttribute("data-income-filter") === "all");
    });
    currentIncomeFilter = "all";
    applyIncomeFilters();
}
window.resetIncomeFilters = resetIncomeFilters;
document.getElementById("resetIncomeFiltersBtn")?.addEventListener("click", resetIncomeFilters);

incomeForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    // FIXED: previously these getElementById calls had no null guards. If any form field
    // was missing (e.g. a future refactor removes one), the handler would throw and the
    // form would silently fail to submit. Now we cache the element references once and
    // null-guard each one. We also validate amount is a positive number before sending.
    const idEl = document.getElementById("incomeId");
    const isRecurringEl = document.getElementById("incomeIsRecurring");
    const sourceEl = document.getElementById("incomeSource");
    const amountEl = document.getElementById("incomeAmount");
    const dateEl = document.getElementById("incomeDate");
    const descEl = document.getElementById("incomeDesc");
    if (!sourceEl || !amountEl || !dateEl) {
        showToast("Income form is missing required fields. Please reload the page.", "error");
        return;
    }
    const id = idEl?.value || "";
    const isRecurring = isRecurringEl?.checked || false;
    const frequency = isRecurring ? (document.getElementById("incomeRecurringFrequency")?.value || "MONTHLY") : null;
    const intervalDays = (isRecurring && frequency === "CUSTOM")
        ? (parseInt(document.getElementById("incomeRecurringIntervalDays")?.value, 10) || 1)
        : null;

    const amountVal = parseFloat(amountEl.value);
    if (!Number.isFinite(amountVal) || amountVal <= 0) {
        showToast("Please enter a valid positive amount.", "error");
        amountEl.classList.add("is-invalid");
        return;
    }
    const dateVal = dateEl.value;
    if (!dateVal) {
        showToast("Please pick an income date.", "error");
        dateEl.classList.add("is-invalid");
        return;
    }
    const sourceVal = sourceEl.value.trim();
    if (!sourceVal) {
        showToast("Please enter an income source.", "error");
        sourceEl.classList.add("is-invalid");
        return;
    }

    const payload = {
        source: sourceVal,
        amount: amountVal,
        incomeDate: dateVal,
        description: (descEl?.value || "").trim(),
        isRecurring: isRecurring,
        frequency: frequency,
        intervalDays: intervalDays,
        kind: document.getElementById("incomeKind")?.value || "",
        countsTowardMonth: document.getElementById("incomeCountsToward")?.value || "",
        reimbursedCategoryId: document.getElementById("incomeKind")?.value === "REIMBURSEMENT"
            ? (Number(document.getElementById("incomeReimbursedCategory")?.value) || 0)
            : 0
    };

    try {
        setLoading(true, id ? "Updating income..." : "Recording income...");
        if (id) {
            await apiRequest(`/incomes/${id}/user/${userId}`, {
                method: "PUT",
                body: JSON.stringify(payload)
            });
            showToast("Income updated successfully.", "success");
        } else {
            await apiRequest(`/incomes/user/${userId}`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            celebrateSuccess(e.clientX, e.clientY);
            showToast("Income recorded successfully!", "success");
            // Confirm every NEW credit with its amount (edits do not notify).
            window.DashboardNotifications?.notifyTransactionRecorded({
                kind: "CREDIT",
                amount: payload.amount,
                label: payload.source,
                detail: payload.description
            });
        }
        closeModal(incomeModal);
        await loadDashboard(true);
    } catch (err) {
        showToast(err.message || "Failed to save income", "error");
    } finally {
        setLoading(false);
    }
});

// Savings Goal Modal & Form
const savingsGoalModal = document.getElementById("savingsGoalModal");
const savingsGoalForm = document.getElementById("savingsGoalForm");
const addGoalBtn = document.getElementById("addGoalBtn");
const closeSavingsGoalModalBtn = document.getElementById("closeSavingsGoalModalBtn");

addGoalBtn?.addEventListener("click", () => {
    if (!savingsGoalModal) return;
    document.getElementById("goalId").value = "";
    document.getElementById("goalName").value = "";
    document.getElementById("goalTargetAmount").value = "";
    document.getElementById("goalCurrentAmount").value = "0";
    const targetD = new Date();
    targetD.setMonth(targetD.getMonth() + 6);
    document.getElementById("goalTargetDate").value = targetD.toISOString().split("T")[0];
    const recCheck = document.getElementById("goalIsRecurring");
    if (recCheck) recCheck.checked = false;
    const recFields = document.getElementById("goalRecurringFields");
    if (recFields) {
        recFields.style.display = "none";
        recFields.hidden = true;
    }
    const recAmt = document.getElementById("goalRecurringAmount");
    if (recAmt) recAmt.value = "";
    const goalFreq = document.getElementById("goalFrequency");
    if (goalFreq) {
        goalFreq.value = "MONTHLY";
        if (window.syncCustomSelect) window.syncCustomSelect(goalFreq);
    }
    const customWrap = document.getElementById("goalCustomIntervalWrap");
    if (customWrap) {
        customWrap.style.display = "none";
        customWrap.hidden = true;
    }
    const intervalInput = document.getElementById("goalRecurringIntervalDays");
    if (intervalInput) intervalInput.value = "30";
    document.getElementById("savingsGoalModalTitle").textContent = "New Savings Goal";
    openModal(savingsGoalModal);
});

document.getElementById("goalIsRecurring")?.addEventListener("change", (e) => {
    const fields = document.getElementById("goalRecurringFields");
    if (fields) {
        fields.style.display = e.target.checked ? "block" : "none";
        fields.hidden = !e.target.checked;
        if (e.target.checked) {
            const targetVal = parseFloat(document.getElementById("goalTargetAmount")?.value || 0);
            const recAmt = document.getElementById("goalRecurringAmount");
            if (recAmt && !recAmt.value && targetVal > 0) {
                recAmt.value = Math.round(targetVal / 12);
            }
            const freqVal = document.getElementById("goalFrequency")?.value;
            const customWrap = document.getElementById("goalCustomIntervalWrap");
            if (customWrap) {
                const isCustom = freqVal === "CUSTOM";
                customWrap.style.display = isCustom ? "block" : "none";
                customWrap.hidden = !isCustom;
            }
        }
    }
});

document.getElementById("goalFrequency")?.addEventListener("change", (e) => {
    const wrap = document.getElementById("goalCustomIntervalWrap");
    if (wrap) {
        const isCustom = e.target.value === "CUSTOM";
        wrap.style.display = isCustom ? "block" : "none";
        wrap.hidden = !isCustom;
    }
});

closeSavingsGoalModalBtn?.addEventListener("click", () => closeModal(savingsGoalModal));

savingsGoalForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("goalId").value;
    const isRec = document.getElementById("goalIsRecurring")?.checked || false;
    const recAmount = isRec ? parseFloat(document.getElementById("goalRecurringAmount")?.value || 0) : null;
    const recFreq = isRec ? (document.getElementById("goalFrequency")?.value || "MONTHLY") : null;
    const intervalDays = (isRec && recFreq === "CUSTOM")
        ? (parseInt(document.getElementById("goalRecurringIntervalDays")?.value, 10) || 30)
        : null;

    const payload = {
        name: document.getElementById("goalName").value.trim(),
        targetAmount: parseFloat(document.getElementById("goalTargetAmount").value),
        currentAmount: parseFloat(document.getElementById("goalCurrentAmount").value || 0),
        targetDate: document.getElementById("goalTargetDate").value,
        isRecurring: isRec,
        recurringAmount: recAmount,
        frequency: recFreq,
        intervalDays: intervalDays,
        nextDueDate: isRec ? new Date().toISOString().split("T")[0] : null
    };

    try {
        setLoading(true, id ? "Updating goal..." : "Creating savings goal...");
        if (id) {
            await apiRequest(`/savings/goals/${id}/user/${userId}`, {
                method: "PUT",
                body: JSON.stringify(payload)
            });
            showToast("Savings goal updated.", "success");
        } else {
            await apiRequest(`/savings/goals/user/${userId}`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            celebrateSuccess(e.clientX, e.clientY);
            showToast("Savings goal created!", "success");
        }
        closeModal(savingsGoalModal);
        await loadDashboard(true);
    } catch (err) {
        showToast(err.message || "Failed to save savings goal", "error");
    } finally {
        setLoading(false);
    }
});

// Savings Deposit Modal & Form
const savingsDepositModal = document.getElementById("savingsDepositModal");
const savingsDepositForm = document.getElementById("savingsDepositForm");
const closeDepositModalBtn = document.getElementById("closeSavingsDepositModalBtn") || document.getElementById("closeDepositModalBtn");

closeDepositModalBtn?.addEventListener("click", () => closeModal(savingsDepositModal));
savingsDepositModal?.addEventListener("click", (e) => {
    if (e.target === savingsDepositModal) closeModal(savingsDepositModal);
});
savingsGoalModal?.addEventListener("click", (e) => {
    if (e.target === savingsGoalModal) closeModal(savingsGoalModal);
});

savingsDepositForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const goalId = document.getElementById("depositGoalId").value;
    const amount = parseFloat(document.getElementById("depositAmount").value);

    try {
        setLoading(true, "Recording contribution...");
        await apiRequest(`/savings/goals/${goalId}/deposit/user/${userId}`, {
            method: "POST",
            body: JSON.stringify({ amount })
        });
        celebrateSuccess(e.clientX, e.clientY);
        showToast("Deposit contributed successfully! 🎯", "success");
        closeModal(savingsDepositModal);
        await loadDashboard(true);
    } catch (err) {
        showToast(err.message || "Deposit failed", "error");
    } finally {
        setLoading(false);
    }
});

// Initialize luxury custom calendar picker and custom select controls
function bindDatePickerAutoPopups() {
    if (window.initCustomCalendarDatePicker) {
        window.initCustomCalendarDatePicker();
    }
    if (window.initAllCustomSelects) {
        window.initAllCustomSelects();
    }
}
document.addEventListener("DOMContentLoaded", bindDatePickerAutoPopups);
bindDatePickerAutoPopups();
window.updateCashFlowMetrics = updateCashFlowMetrics;
window.renderIncomes = renderIncomes;
window.renderSavingsGoals = renderSavingsGoals;
window.openNewIncomeModal = openNewIncomeModal;
window.openEditSavingsGoal = openEditSavingsGoal;
