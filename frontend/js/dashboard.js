var token = localStorage.getItem("token");
var userId = localStorage.getItem("userId");
var userName = localStorage.getItem("userName") || "User";

if (!token || !userId) {
    window.location.href = "index.html";
    throw new Error("Redirecting to login: missing auth session");
}

// UI Setup (guarded against missing elements)
const topBarP = document.querySelector(".top-bar p");
if (topBarP) topBarP.textContent = `Welcome back, ${userName}`;
function renderDashboardAvatar(name, photoUrl) {
    const avatarEl = document.querySelector(".avatar");
    if (!avatarEl) return;
    const initial = (name || "U").charAt(0).toUpperCase();
    const photo = photoUrl || localStorage.getItem("userProfilePicture");
    if (photo && photo.trim().length > 0) {
        avatarEl.innerHTML = `<img src="${photo}" alt="${initial}" class="avatar-img" onerror="this.onerror=null; this.parentElement.textContent='${initial}';" />`;
    } else {
        avatarEl.textContent = initial;
    }
}
renderDashboardAvatar(userName, localStorage.getItem("userProfilePicture"));
if (userId && typeof apiRequest === "function") {
    apiRequest(`/users/${userId}`).then(profile => {
        if (profile?.profilePictureUrl) {
            localStorage.setItem("userProfilePicture", profile.profilePictureUrl);
            renderDashboardAvatar(profile.name || userName, profile.profilePictureUrl);
        }
    }).catch(() => {});
}

// Shared dashboard utilities are loaded from js/modules/dashboard-utils.js.
const { getLocalDateString, parseLocalDate, escapeHtml, jsAttrEscape, formatCurrency, formatDate, getCategoryColor, getCategoryEmoji, debounce } = window.DashboardUtils;
var elements = window.DashboardDom.elements;
window.elements = elements;
window.token = token;
window.userId = userId;
window.userName = userName;

// Safe bridge functions to forward calls across sub-modules without TDZ, recursion or global shadow issues
const updateCashFlowMetrics = (...args) => {
    if (typeof window.updateCashFlowMetrics === "function") {
        return window.updateCashFlowMetrics(...args);
    }
};
const renderIncomes = (...args) => {
    if (typeof window.renderIncomes === "function") {
        return window.renderIncomes(...args);
    }
};
const renderSavingsGoals = (...args) => {
    if (typeof window.renderSavingsGoals === "function") {
        return window.renderSavingsGoals(...args);
    }
};
const loadBudgets = (...args) => {
    if (typeof window.loadBudgets === "function") {
        return window.loadBudgets(...args);
    }
};
const applyFilters = (...args) => {
    if (typeof window.applyFilters === "function") {
        return window.applyFilters(...args);
    }
};
const { animateNumber, animatePercent, celebrateSuccess, updateStats } = window.DashboardEffects;

// Global State
let allExpenses = [];
Object.defineProperty(window, 'allExpenses', {
    configurable: true,
    get: () => allExpenses,
    set: (v) => {
        allExpenses = v;
        if (window.LoansManager && typeof window.LoansManager.populateExpenseDropdown === 'function') {
            window.LoansManager.populateExpenseDropdown();
        }
    }
});
let allCategories = [];
let userOnlyCategories = []; // subset of allCategories actually deletable (excludes global/seeded ones)
let allIncomes = [];
let allSavingsGoals = [];
let cachedBudgets = [];
Object.defineProperty(window, 'cachedBudgets', {
    configurable: true,
    get: () => cachedBudgets,
    set: (v) => { cachedBudgets = v; }
});
const chartState = window.DashboardChartState;
const updateProMetrics = window.DashboardMetrics.updateProMetrics;



// Immediate synchronization of metric cards with active currency

// --- 1. INITIALIZATION ---

const dashboardDataController = window.DashboardData.createController({
    getState: () => ({
        allExpenses,
        allCategories,
        allIncomes,
        allSavingsGoals,
        userOnlyCategories
    }),
    setState: (next) => {
        if (Object.prototype.hasOwnProperty.call(next, "allExpenses")) allExpenses = next.allExpenses;
        if (Object.prototype.hasOwnProperty.call(next, "allCategories")) allCategories = next.allCategories;
        if (Object.prototype.hasOwnProperty.call(next, "allIncomes")) allIncomes = next.allIncomes;
        if (Object.prototype.hasOwnProperty.call(next, "allSavingsGoals")) allSavingsGoals = next.allSavingsGoals;
        if (Object.prototype.hasOwnProperty.call(next, "userOnlyCategories")) userOnlyCategories = next.userOnlyCategories;
    },
    getUserId: () => userId,
    apiRequest,
    getCacheKey: window.getCacheKey,
    loadExpenseCache: window.loadExpenseCache,
    saveExpenseCache: window.saveExpenseCache,
    showSkeletonLoading: window.DashboardDom.showSkeletonLoading,
    renderCategoryData: (categories, expenses) => {
        populateCategoryDropdown(categories);
        populateFilterDropdowns(categories, expenses);
        renderCategoryPills(categories);
        applyFilters();
    },
    renderIncomes: (...args) => window.renderIncomes && window.renderIncomes(...args),
    renderSavingsGoals: (...args) => window.renderSavingsGoals && window.renderSavingsGoals(...args),
    updateCashFlowMetrics: (...args) => window.updateCashFlowMetrics && window.updateCashFlowMetrics(...args),
    renderFinancialData: (expenses) => {
        loadBudgets();
        updateProMetrics(expenses, allIncomes);
    },
    showToast,
    clearApiCache: window.clearApiCache
});

const renderDashboardData = dashboardDataController.renderDashboardData;
const loadDashboard = dashboardDataController.loadDashboard;
window.renderDashboardData = renderDashboardData;
window.loadDashboard = loadDashboard;

// --- PRO METRICS CALCULATION ---


/**
 * Computes and renders real-time financial insights into the Smart Intelligence panel.
 */
function renderFinancialInsights(expenses, incomes = allIncomes, goals = allSavingsGoals) {
    // The filter controller passes the already-filtered incomes alongside the
    // filtered expenses. Defaulting (instead of ignoring the parameters) keeps
    // single-argument callers working while stopping a month/year filter from
    // pairing filtered outflow with all-time inflow.
    return window.DashboardInsights.renderFinancialInsights(expenses, incomes, goals);
}

window.renderFinancialInsights = renderFinancialInsights;

// --- 2. BUDGET LOGIC ---
const dashboardBudgetController = window.DashboardBudget.createController({
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
    appConfirm: window.appConfirm,
    openModal,
    closeModal,
    getExpenses: () => allExpenses,
    getCachedBudgets: () => cachedBudgets,
    setCachedBudgets: (next) => {
        cachedBudgets = Array.isArray(next) ? next : [];
    }
});

window.loadBudgets = dashboardBudgetController.loadBudgets;
window.deleteBudgetLimit = dashboardBudgetController.deleteBudgetLimit;

const setBudgetModal = document.getElementById("budgetModal");
const setBudgetForm = document.getElementById("addBudgetForm");
const budgetCategorySelect = document.getElementById("budgetCategorySelect");
const budgetPeriod = document.getElementById("budgetPeriod");
const customBudgetDates = document.getElementById("customBudgetDates");

function syncBudgetPeriodVisibility() {
    if (!customBudgetDates || !budgetPeriod) return;
    const isCustom = budgetPeriod.value === "CUSTOM";
    customBudgetDates.hidden = !isCustom;
    customBudgetDates.style.display = isCustom ? "block" : "none";
}

elements.addBudgetBtn.addEventListener("click", () => {
    budgetCategorySelect.innerHTML = allCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    if (window.syncCustomSelect) window.syncCustomSelect(budgetCategorySelect);
    setBudgetForm.reset();
    if (budgetPeriod) {
        budgetPeriod.value = "MONTHLY";
        if (window.syncCustomSelect) window.syncCustomSelect(budgetPeriod);
    }
    syncBudgetPeriodVisibility();
    const daysEl = document.getElementById("budgetIntervalDays");
    if (daysEl) daysEl.value = 30;
    openModal(setBudgetModal);
});

// Edit Budget — pre-fill the budget modal with existing values and re-open it
window.openEditBudget = (budgetId, categoryId, categoryName, limit, period, startDate, endDate, intervalDays = 30) => {
    // Rebuild category list with the target selected
    budgetCategorySelect.innerHTML = allCategories.map(c =>
        `<option value="${c.id}"${c.id === categoryId ? ' selected' : ''}>${c.name}</option>`
    ).join("");
    if (window.syncCustomSelect) window.syncCustomSelect(budgetCategorySelect);

    // Pre-fill limit, period, interval days and dates
    const limitInput = document.getElementById("budgetLimit") || document.getElementById("budgetLimitAmount");
    if (limitInput) limitInput.value = limit;
    if (budgetPeriod) {
        budgetPeriod.value = period || "MONTHLY";
        if (window.syncCustomSelect) window.syncCustomSelect(budgetPeriod);
        syncBudgetPeriodVisibility();
    }
    const daysEl  = document.getElementById("budgetIntervalDays");
    if (daysEl) daysEl.value = intervalDays || 30;
    const startEl = document.getElementById("budgetStartDate");
    const endEl   = document.getElementById("budgetEndDate");
    if (startEl) startEl.value = startDate || "";
    if (endEl)   endEl.value   = endDate   || "";

    openModal(setBudgetModal);
};

document.getElementById("closeBudgetModalBtn")?.addEventListener("click", () => {
    closeModal(setBudgetModal);
});
setBudgetModal?.addEventListener("click", (e) => {
    if (e.target === setBudgetModal) closeModal(setBudgetModal);
});

budgetPeriod?.addEventListener("change", syncBudgetPeriodVisibility);

setBudgetForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = setBudgetForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return; // a submission is already in flight

    const catId = parseInt(budgetCategorySelect.value);
    const limit = parseFloat((document.getElementById("budgetLimit") || document.getElementById("budgetLimitAmount")).value);
    const period = budgetPeriod.value;
    const intervalDays = period === "CUSTOM" ? (parseInt(document.getElementById("budgetIntervalDays")?.value) || 30) : null;
    const startDate = document.getElementById("budgetStartDate").value || null;
    const endDate = document.getElementById("budgetEndDate").value || null;

    if (isNaN(limit) || limit <= 0) return showToast("Limit amount must be greater than 0", "error");

    submitBtn.disabled = true;
    try {
        await apiRequest(`/expenses/budget/user/${userId}`, {
            method: "POST",
            body: JSON.stringify({
                categoryId: catId,
                limitAmount: limit,
                period: period,
                intervalDays: intervalDays,
                startDate: startDate,
                endDate: endDate
            })
        });
        showToast("Budget limit saved.", "success");
        // Same fix as the expense form: go through closeModal() so
        // body's scroll-lock class actually gets cleared.
        closeModal(setBudgetModal);
        loadBudgets();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        submitBtn.disabled = false;
    }
});


// --- 3. CHARTS ---


/**
 * Renders a horizontal 2-segment bar comparing total recurring (subscription)
 * spend against total one-time spend — answers "how much of my spending is
 * actually locked in vs. discretionary," which neither the category pie nor
 * the daily trend line can show, since both mix the two together.
 */

/**
 * Renders a bar chart of total spend grouped by day of the week — a
 * behavioral insight none of the other charts surface: WHEN spending
 * happens, not just how much or on what. Reveals patterns like weekend
 * overspending that a category or time-trend view can't show on its own.
 */

/**
 * Renders a grouped bar chart comparing each budgeted category's limit
 * against what was actually spent — the one chart on this dashboard that
 * answers "am I on track," not just "where did money go." Bars for
 * categories currently over budget render in the danger color so overages
 * are visible at a glance without reading numbers.
 */








// --- 4. FILTERING ---
const dashboardFilterController = window.DashboardFilters.createController({
    elements,
    getExpenses: () => allExpenses,
    getIncomes: () => allIncomes,
    getSavingsGoals: () => allSavingsGoals,
    parseLocalDate,
    getLocalDateString,
    debounce,
    showToast,
    updateStats,
    updateCashFlowMetrics: (...args) => updateCashFlowMetrics(...args),
    renderPieChart,
    renderList,
    renderTrendChart,
    renderRecurringSplitChart,
    renderDayOfWeekChart,
    renderFinancialInsights,
    syncCategoryPillSelection,
    applyIncomeFilters: () => typeof window.applyIncomeFilters === "function" && window.applyIncomeFilters()
});

window.applyFilters = dashboardFilterController.applyFilters;
dashboardFilterController.wireControls();





function renderList(expenses) {
    updateStreamBadges();
    if (expenses.length === 0) {
        elements.expenseList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💸</div>
                <div class="empty-state-title">No transactions yet</div>
                <div class="empty-state-sub">Click <strong>Record Expense</strong> above to add your first transaction and start tracking your finances.</div>
            </div>`;
        return;
    }
    elements.expenseList.innerHTML = expenses.map((exp, idx) => {
        const catColor = getCategoryColor(exp.categoryName);
        const catName = exp.categoryName || 'General';
        const isRecurring = exp.recurring || exp.isRecurring;
        const delay = Math.min(idx * 0.04, 0.4);
        return `
        <div class="expense-item" style="animation-delay: ${delay}s;">
            <div class="expense-emoji-box" style="width:40px; height:40px; border-radius:12px; background:${catColor.bg}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <span class="u-inl-bf83cf1">${getCategoryEmoji(catName)}</span>
            </div>
            <div class="expense-info u-inl-bbf7159">
                <h4 class="expense-title">${escapeHtml(exp.description || "")}</h4>
                <div class="expense-meta u-inl-73df694">
                    <span>${formatDate(exp.expenseDate)}</span>
                    <span class="cat-chip" style="background:${catColor.bg}; color:${catColor.color}; border:1px solid ${catColor.color}30;">${escapeHtml(catName)}</span>
                    ${isRecurring ? '<span class="u-inl-ad1b491">⟳ RECURRING</span>' : ''}
                </div>
            </div>
            <div class="expense-actions-col u-inl-8b23579">
                <div class="expense-amount u-inl-81b7189">${formatCurrency(exp.amount)}</div>
                <button class="btn-text-icon btn-split-loan u-inl-a54fd17" onclick="window.LoansManager && window.LoansManager.openWithExpense(${exp.id}, '${jsAttrEscape(exp.description || '')}', ${exp.amount}, '${exp.expenseDate}')" title="Split / Link to Peer Loan">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                    <span>Split</span>
                </button>
                <button class="btn-edit" onclick="editExpense(${exp.id})" title="Edit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-delete" onclick="deleteExpense(${exp.id}, event)" title="Delete">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        </div>`;
    }).join("");
}

function populateCategoryDropdown(categories) {
    if (!categories || categories.length === 0) {
        elements.categorySelect.innerHTML = '<option value="" disabled selected>No categories found</option>';
        return;
    }
    const opts = categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    elements.categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>' + opts;
    if (window.syncCustomSelect) window.syncCustomSelect(elements.categorySelect);
}

function populateFilterDropdowns(categories, expenses) {
    if (categories && categories.length > 0) {
        const currentVal = elements.filterCategory ? elements.filterCategory.value : "all";
        const catOpts = categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
        elements.filterCategory.innerHTML = '<option value="all">All Categories</option>' + catOpts;
        if (window.syncCustomSelect) window.syncCustomSelect(elements.filterCategory);
        if (categories.some(c => c.name === currentVal)) {
            elements.filterCategory.value = currentVal;
        } else {
            elements.filterCategory.value = "all";
        }
    }

    if (expenses && expenses.length > 0) {
        const years = [...new Set(expenses.map(e => new Date(e.expenseDate).getFullYear()))].sort((a, b) => b - a);
        const yearOpts = years.map(y => `<option value="${y}">${y}</option>`).join('');
        elements.filterYear.innerHTML = '<option value="all">All Years</option>' + yearOpts;
        if (window.syncCustomSelect) window.syncCustomSelect(elements.filterYear);
    }
}

function renderCategoryPills(categories) {
    const pillsBar = document.getElementById("categoryPillsBar");
    if (!pillsBar) return;

    const currentSelectedCat = (elements.filterCategory && elements.filterCategory.value) ? elements.filterCategory.value : "all";

    const allChip = `<button class="pill-chip ${currentSelectedCat === 'all' ? 'active' : ''}" data-category="all">All Transactions</button>`;

    const catChips = (categories || []).map(cat => {
        const icon = getCategoryEmoji(cat.name);
        const isActive = currentSelectedCat.toLowerCase() === cat.name.toLowerCase();
        return `<button class="pill-chip ${isActive ? 'active' : ''}" data-category="${escapeHtml(cat.name)}">${icon} ${escapeHtml(cat.name)}</button>`;
    }).join("");

    pillsBar.innerHTML = allChip + catChips;
    if (typeof bindCategoryPillsScrollCues === "function") bindCategoryPillsScrollCues();

    pillsBar.querySelectorAll(".pill-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            pillsBar.querySelectorAll(".pill-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            const category = chip.getAttribute("data-category");
            if (elements.filterCategory) {
                elements.filterCategory.value = category;
                applyFilters();
            }
        });
    });
}

function syncCategoryPillSelection(selectedCatName) {
    const pillsBar = document.getElementById("categoryPillsBar");
    if (!pillsBar) return;
    pillsBar.querySelectorAll(".pill-chip").forEach(chip => {
        const chipCat = chip.getAttribute("data-category");
        if (!selectedCatName || selectedCatName === "all") {
            chip.classList.toggle("active", chipCat === "all");
        } else {
            chip.classList.toggle("active", chipCat.toLowerCase() === selectedCatName.toLowerCase());
        }
    });
}


// --- 6. ACTIONS (Forms & Buttons) ---

// Handle Add/Edit Form Submit
elements.addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = elements.addForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return; // a submission is already in flight

    const id = document.getElementById("expenseId").value;
    const isRecurring = elements.isRecurring.checked;

    const amountVal = parseFloat(document.getElementById("amount").value);
    const dateVal = document.getElementById("date").value;

    if (isNaN(amountVal) || amountVal <= 0) return showToast("Amount must be a positive number.", "error");
    if (!dateVal) return showToast("Please select a valid date.", "error");

    const expenseData = {
        description: document.getElementById("desc").value,
        amount: amountVal,
        expenseDate: dateVal,
        categoryId: parseInt(elements.categorySelect.value)
    };
    if (isRecurring) {
        expenseData.frequency = elements.recurringFrequency.value;
        if (expenseData.frequency === "CUSTOM") {
            const intervalDays = Number(elements.recurringIntervalDays.value);
            if (!Number.isInteger(intervalDays) || intervalDays < 1) {
                return showToast("Custom intervals must be at least one day.", "error");
            }
            expenseData.intervalDays = intervalDays;
        }
    }

    submitBtn.disabled = true;
    try {
        let savedExpense = null;
        if (id) {
            savedExpense = await apiRequest(`/expenses/${id}/user/${userId}`, { method: "PUT", body: JSON.stringify(expenseData) });
            showToast("Expense updated.", "success");
        } else if (isRecurring) {
            savedExpense = await apiRequest(`/expenses/recurring/user/${userId}`, { method: "POST", body: JSON.stringify(expenseData) });
            showToast("Recurring expense created.", "success");
        } else {
            savedExpense = await apiRequest(`/expenses/user/${userId}`, { method: "POST", body: JSON.stringify(expenseData) });
            celebrateSuccess(e.clientX, e.clientY);
            showToast("Expense added.", "success");
        }

        // Confirm every NEW debit with its amount (edits do not notify).
        if (!id) {
            const category = (allCategories || []).find(c => String(c.id) === String(expenseData.categoryId));
            window.DashboardNotifications?.notifyTransactionRecorded({
                kind: "DEBIT",
                amount: expenseData.amount,
                label: category ? category.name : "Expense",
                detail: expenseData.description
            });
        }

        if (window.DashboardML && typeof window.DashboardML.onExpenseSaved === "function") {
            window.DashboardML.onExpenseSaved(savedExpense || { id: id, ...expenseData }, expenseData);
        }

        // Was elements.modal.classList.remove("active") directly, which
        // skips closeModal()'s cleanup of document.body's "modal-open"
        // class (added by openModal() to lock background scroll while
        // the modal is up). Every other close path in this file — the
        // X button, clicking the overlay, Escape — goes through
        // closeModal() and was fine; this success path was the one
        // exception, so submitting the form left the page unscrollable
        // until a full refresh reset body's class list.
        closeModal(elements.modal);
        elements.addForm.reset();
        loadDashboard(true);
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        submitBtn.disabled = false;
    }
});

window.editExpense = (id) => {
    if (window.DashboardML && typeof window.DashboardML.resetActiveSession === "function") {
        window.DashboardML.resetActiveSession();
    }
    const expense = allExpenses.find(e => e.id === id);
    if (!expense) return;

    document.getElementById("expenseId").value = expense.id;
    document.getElementById("desc").value = expense.description;
    document.getElementById("amount").value = expense.amount;
    document.getElementById("date").value = expense.expenseDate;
    elements.categorySelect.value = expense.categoryId;

    elements.isRecurring.parentElement.style.display = "none";
    elements.recurringOptions.hidden = true;
    document.querySelector(".modal h3").textContent = "Edit Expense";
    document.querySelector(".modal button[type='submit']").textContent = "Update Expense";
    openModal(elements.modal);
};

window.deleteExpense = async (id, event) => {
    if (!(await window.appConfirm("Delete this expense?"))) return;
    try {
        await apiRequest(`/expenses/${id}/user/${userId}`, { method: 'DELETE' });
        showToast("Expense deleted.", "success");
        loadDashboard(true);
    } catch (err) {
        showToast(err.message, "error");
        const btn = event?.target?.closest(".btn-delete");
        if (btn) {
            btn.classList.add("shake");
            setTimeout(() => btn.classList.remove("shake"), 400);
        }
    }
};

function syncRecurringIntervalVisibility() {
    if (elements.customIntervalWrap && elements.recurringFrequency) {
        const isCustom = (elements.recurringFrequency.value === "CUSTOM");
        elements.customIntervalWrap.hidden = !isCustom;
        elements.customIntervalWrap.style.display = isCustom ? "flex" : "none";
    }
}

function openNewExpenseModal() {
    if (window.DashboardML && typeof window.DashboardML.resetActiveSession === "function") {
        window.DashboardML.resetActiveSession();
    }
    if (elements.addForm) elements.addForm.reset();
    const idEl = document.getElementById("expenseId");
    if (idEl) idEl.value = "";
    const dateEl = document.getElementById("date");
    if (dateEl) dateEl.value = getLocalDateString();
    if (elements.isRecurring) {
        elements.isRecurring.checked = false;
        if (elements.isRecurring.parentElement) elements.isRecurring.parentElement.style.display = "flex";
    }
    if (elements.recurringOptions) {
        elements.recurringOptions.hidden = true;
        elements.recurringOptions.style.display = "none";
    }
    if (elements.recurringFrequency) elements.recurringFrequency.value = "MONTHLY";
    syncRecurringIntervalVisibility();
    const titleEl = document.getElementById("expenseModalTitle") || document.querySelector("#expenseModal .modal h3") || document.querySelector(".modal h3");
    if (titleEl) titleEl.textContent = "Record Expense";
    const submitBtn = document.getElementById("saveExpenseSubmitBtn") || document.querySelector("#expenseModal button[type='submit']") || document.querySelector(".modal button[type='submit']");
    if (submitBtn) submitBtn.textContent = "Save Expense";
    openModal(elements.modal);
}
window.openNewExpenseModal = openNewExpenseModal;

// Modal Controls
document.getElementById("openModalBtn")?.addEventListener("click", openNewExpenseModal);
document.getElementById("addExpenseTableBtn")?.addEventListener("click", openNewExpenseModal);

document.getElementById("closeExpenseModalBtn")?.addEventListener("click", () => {
    closeModal(elements.modal);
    const idEl = document.getElementById("expenseId");
    if (idEl) idEl.value = "";
    const titleEl = document.getElementById("expenseModalTitle") || document.querySelector("#expenseModal .modal h3");
    if (titleEl) titleEl.textContent = "Record Expense";
    const submitBtn = document.getElementById("saveExpenseSubmitBtn") || document.querySelector("#expenseModal button[type='submit']");
    if (submitBtn) submitBtn.textContent = "Save Expense";
});

// Close expense modal when clicking the backdrop (outside the modal card)
elements.modal?.addEventListener("click", (e) => {
    if (e.target === elements.modal) closeModal(elements.modal);
});

// Close any open modal on Escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach(m => closeModal(m));
    }
});

elements.isRecurring.addEventListener("change", () => {
    const isChecked = elements.isRecurring.checked;
    elements.recurringOptions.hidden = !isChecked;
    elements.recurringOptions.style.display = isChecked ? "flex" : "none";
    syncRecurringIntervalVisibility();
});
elements.recurringFrequency.addEventListener("change", () => {
    syncRecurringIntervalVisibility();
});

// Add Category
elements.addCategoryBtn.addEventListener("click", async () => {
    const name = await window.appPrompt("Enter new category name:");
    if (!name || !name.trim()) return;
    try {
        const newCat = await apiRequest(`/categories/user/${userId}`, { method: "POST", body: JSON.stringify({ name: name.trim() }) });
        allCategories.push(newCat);
        userOnlyCategories.push(newCat);
        populateCategoryDropdown(allCategories);
        populateFilterDropdowns(allCategories, allExpenses);
        renderCategoryPills(allCategories);
        elements.categorySelect.value = newCat.id;
        showToast(`Category "${newCat.name}" created!`, "success");
    } catch (error) { showToast(error.message, "error"); }
});

// --- MANAGE / DELETE CATEGORIES ---
const manageCategoriesModal = document.getElementById("manageCategoriesModal");

async function renderManageCategoriesList() {
    const listEl = document.getElementById("categoriesList") || document.getElementById("manageCategoriesList");
    if (!listEl) return;

    if (userOnlyCategories.length === 0) {
        listEl.innerHTML = `<p class="u-inl-fa52e02">You haven't created any custom categories yet.</p>`;
        return;
    }

    listEl.innerHTML = `<p class="u-inl-1bfcff7">Checking usage...</p>`;

    // Determine usage: one-off expenses are already loaded client-side
    // (allExpenses); recurring subscriptions need a fresh fetch since they
    // aren't cached globally. The backend re-validates this on delete
    // regardless — this is purely to disable buttons proactively in the UI.
    let recurring = [];
    try {
        recurring = await apiRequest(`/expenses/recurring/user/${userId}`) || [];
    } catch (e) {
        // If this fails, fall back to allowing the click and letting the
        // backend's authoritative check catch it.
    }

    const usedCategoryIds = new Set([
        ...allExpenses.map(e => e.categoryId),
        ...recurring.map(r => r.categoryId),
    ]);

    listEl.innerHTML = userOnlyCategories.map(cat => {
        const inUse = usedCategoryIds.has(cat.id);
        return `
            <div class="u-inl-7154ce7">
                <span class="u-inl-5684edc">${escapeHtml(cat.name)}</span>
                <button type="button" class="btn-icon" data-delete-category="${cat.id}" data-category-name="${escapeHtml(cat.name)}"
                    ${inUse ? 'disabled title="This category is used by one or more expenses and can\'t be deleted"' : 'title="Delete category"'}
                    style="${inUse ? 'opacity:0.4; cursor:not-allowed;' : 'color:var(--danger, #C0392B);'}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>`;
    }).join("");

    listEl.querySelectorAll("[data-delete-category]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const catId = btn.getAttribute("data-delete-category");
            const catName = btn.getAttribute("data-category-name");
            if (!(await window.appConfirm(`Delete category "${catName}"? This can't be undone.`))) return;
            try {
                await apiRequest(`/categories/${catId}/user/${userId}`, { method: "DELETE" });
                allCategories = allCategories.filter(c => String(c.id) !== String(catId));
                userOnlyCategories = userOnlyCategories.filter(c => String(c.id) !== String(catId));
                populateCategoryDropdown(allCategories);
                populateFilterDropdowns(allCategories, allExpenses);
                renderCategoryPills(allCategories);
                showToast(`Category "${catName}" deleted.`, "success");
                renderManageCategoriesList();
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    });
}

document.getElementById("manageCategoriesBtn")?.addEventListener("click", () => {
    openModal(manageCategoriesModal);
    renderManageCategoriesList();
});
document.getElementById("closeManageCategoriesModalBtn")?.addEventListener("click", () => {
    closeModal(manageCategoriesModal);
});
manageCategoriesModal?.addEventListener("click", (e) => {
    if (e.target === manageCategoriesModal) closeModal(manageCategoriesModal);
});

elements.toggleFiltersBtn.addEventListener("click", () => { elements.filterPanel.classList.toggle("active"); });

// Theme Logic
const savedTheme = localStorage.getItem("theme") || "dark";
document.body.setAttribute("data-theme", savedTheme);
if (typeof updateAllThemeIcons === "function") updateAllThemeIcons(savedTheme);

window.updateChartsTheme = updateChartsTheme;

// Smooth, instant theme updates for canvas-rendered charts with zero DOM repainting/re-filtering lag
document.addEventListener("themechange", () => {
    updateChartsTheme();
});

// Profile, Dynamic 50-Currency Custom Select & Export
const dashCurrWrapper = document.getElementById("dashCurrencyWrapper");
const dashCurrTrigger = document.getElementById("dashCurrencyTrigger");
const dashCurrLabel = document.getElementById("dashCurrencyLabel");
const currencySelector = document.getElementById("currencySelector");

function syncCurrencyDropdown(currCode) {
    if (typeof WORLD_CURRENCIES === "undefined") return;
    const activeCurr = currCode || (typeof getSelectedCurrency === "function" ? getSelectedCurrency() : "INR");
    const item = WORLD_CURRENCIES.find(c => c.code === activeCurr) || WORLD_CURRENCIES[0];
    if (currencySelector) currencySelector.value = item.code;
    if (dashCurrLabel && item) dashCurrLabel.textContent = `${item.flag} ${item.code} (${item.symbol})`;

    if (dashCurrWrapper) {
        const optionsList = dashCurrWrapper.querySelectorAll(".custom-option");
        optionsList.forEach(opt => {
            if (opt.getAttribute("data-value") === item.code) {
                opt.classList.add("selected");
            } else {
                opt.classList.remove("selected");
            }
        });
    }
}

if (dashCurrTrigger && dashCurrWrapper && typeof WORLD_CURRENCIES !== "undefined") {
    const optionsContainer = dashCurrWrapper.querySelector(".custom-select-options");
    const activeCurr = typeof getSelectedCurrency === "function" ? getSelectedCurrency() : "INR";
    if (currencySelector) currencySelector.value = activeCurr;

    optionsContainer.innerHTML = `
        <input type="text" class="custom-select-search" placeholder="Search 100+ currencies...">
        <div class="custom-options-list">
            ${getCurrenciesSortedByLikelihood().map(item => `
                <div class="custom-option ${item.code === activeCurr ? 'selected' : ''}" data-value="${item.code}" data-name="${item.name.toLowerCase()}" data-symbol="${item.symbol.toLowerCase()}">
                    <span><span class="custom-option-flag">${item.flag}</span> ${item.code} (${item.symbol}) — ${item.name}</span>
                </div>
            `).join('')}
        </div>
    `;

    const searchInput = optionsContainer.querySelector(".custom-select-search");
    const optionsList = optionsContainer.querySelectorAll(".custom-option");

    syncCurrencyDropdown(activeCurr);

    dashCurrTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        dashCurrWrapper.classList.toggle("open");
        if (dashCurrWrapper.classList.contains("open") && searchInput) {
            searchInput.focus();
        }
    });

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const q = searchInput.value.toLowerCase().trim();
            optionsList.forEach(opt => {
                const code = opt.getAttribute("data-value").toLowerCase();
                const name = opt.getAttribute("data-name");
                const symbol = opt.getAttribute("data-symbol");
                const match = code.includes(q) || name.includes(q) || symbol.includes(q);
                opt.style.display = match ? "flex" : "none";
            });
        });
        searchInput.addEventListener("click", e => e.stopPropagation());
    }

    optionsList.forEach(opt => {
        opt.addEventListener("click", (e) => {
            e.stopPropagation();
            const newCurr = opt.getAttribute("data-value");
            syncCurrencyDropdown(newCurr);
            dashCurrWrapper.classList.remove("open");

            localStorage.setItem("userCurrency", newCurr);
            if (typeof setCurrencySymbol === "function") setCurrencySymbol(newCurr);
            apiRequest(`/users/${userId}/currency`, { method: "PUT", body: JSON.stringify({ currency: newCurr }) })
                .then(() => {
                    showToast(`Currency updated to ${newCurr} (${getCurrencySymbol()})`, "success");
                })
                .catch(err => {
                    console.error("Failed to persist currency preference:", err);
                    showToast(`Failed to sync currency preference to server: ${err.message || "Network error"}`, "error");
                });
            refreshAllCurrencyDisplays();
        });
    });

    document.addEventListener("click", () => {
        dashCurrWrapper.classList.remove("open");
    });
}

function updateModalLabels() {
    const sym = typeof getCurrencySymbol === "function" ? getCurrencySymbol() : "$";
    document.querySelectorAll("label").forEach(lbl => {
        const text = lbl.textContent.trim();
        if (text.startsWith("Amount") || text === "Amount" || text.startsWith("Amount (")) {
            lbl.textContent = `Amount (${sym})`;
        } else if (text.includes("Monthly Limit")) {
            lbl.textContent = `Monthly Limit Amount (${sym})`;
        } else if (text.includes("Target Amount")) {
            lbl.textContent = `Target Amount (${sym})`;
        } else if (text.includes("Initial Saved Amount")) {
            lbl.textContent = `Initial Saved Amount (${sym})`;
        } else if (text.includes("Contribution Amount")) {
            lbl.textContent = `Contribution Amount (${sym})`;
        }
    });
}
updateModalLabels();

function refreshAllCurrencyDisplays() {
    updateModalLabels();
    initCurrencyPlaceholders();
    if (Array.isArray(allExpenses)) {
        updateProMetrics(allExpenses, allIncomes);
        applyFilters();
    }
    updateCashFlowMetrics(allExpenses || [], allIncomes || [], allSavingsGoals || []);
    if (Array.isArray(allIncomes)) {
        renderIncomes(allIncomes);
    }
    if (Array.isArray(allSavingsGoals)) {
        renderSavingsGoals(allSavingsGoals);
    }
    loadBudgets();
}

function toggleProfileMenu(forceState) {
    const isOpen = typeof forceState === "boolean" ? forceState : !elements.profileMenu.classList.contains("active");
    if (isOpen) {
        // Mutual exclusion: dismiss notification panel if open
        if (typeof window.DashboardInbox?.close === "function") {
            window.DashboardInbox.close();
        } else {
            const inboxPanel = document.getElementById("inboxPanel");
            if (inboxPanel && !inboxPanel.hidden) {
                inboxPanel.hidden = true;
                const inboxBell = document.getElementById("inboxBell");
                inboxBell?.setAttribute("aria-expanded", "false");
                inboxBell?.classList.remove("inbox-bell--open");
                const inboxContainer = document.getElementById("inbox");
                if (inboxContainer) inboxContainer.style.zIndex = "";
            }
        }
    }
    elements.profileMenu.classList.toggle("active", isOpen);
    elements.profileTrigger.classList.toggle("active", isOpen);
    elements.profileTrigger.setAttribute("aria-expanded", String(isOpen));
    elements.profileTrigger.style.zIndex = isOpen ? "2500" : "";
}
window.toggleProfileMenu = toggleProfileMenu;

elements.profileTrigger.addEventListener("click", () => { toggleProfileMenu(); });
document.getElementById("closeProfileMenuBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleProfileMenu(false);
});
elements.profileTrigger.addEventListener("keydown", (e) => {
    // Was mouse-only: a div with a click listener and no keyboard handling
    // is invisible to keyboard-only and screen-reader users — there was no
    // way to open this menu without a pointer at all.
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        toggleProfileMenu();
    } else if (e.key === "Escape") {
        toggleProfileMenu(false);
    }
});
document.addEventListener("click", (e) => { if (!elements.profileTrigger.contains(e.target) && !elements.profileMenu.contains(e.target)) toggleProfileMenu(false); });
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && elements.profileMenu.classList.contains("active")) {
        toggleProfileMenu(false);
        elements.profileTrigger.focus();
    }
});
// Note: logoutBtn is handled in biometrics.js (capture phase) to preserve theme/currency prefs.
// Do not re-bind here — duplicate handlers caused inconsistent wipe behavior.

const exportMonthlySummaryBtn = document.getElementById("exportMonthlySummaryBtn");
if (exportMonthlySummaryBtn) {
    exportMonthlySummaryBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleProfileMenu(false);
        openMonthlyReportPeriodModal("export");
    });
}

const sendMonthlyReportBtn = document.getElementById("sendMonthlyReportBtn");
if (sendMonthlyReportBtn) {
    (async () => {
        try {
            const authConfig = await apiRequest("/auth/config", { method: "GET" });
            if (authConfig && authConfig.emailVerificationEnabled) {
                sendMonthlyReportBtn.style.display = "block";
                const periodEmailBtn = document.getElementById("periodEmailReportBtn");
                if (periodEmailBtn) periodEmailBtn.style.display = "flex";
            }
        } catch (e) {
            // Ignore config lookup errors on legacy servers
        }
    })();

    sendMonthlyReportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleProfileMenu(false);
        openMonthlyReportPeriodModal("export");
    });
}

// Fetch and display server-side user profile (name + email)
(async () => {
    try {
        const profile = await apiRequest(`/users/${userId}`);
        if (profile) {
            // Update name in localStorage and display if different
            if (profile.name) {
                localStorage.setItem("userName", profile.name);
            }
            if (profile.currency) {
                const prevCurr = localStorage.getItem("userCurrency");
                localStorage.setItem("userCurrency", profile.currency);
                if (typeof setCurrencySymbol === "function") {
                    setCurrencySymbol(profile.currency);
                }
                syncCurrencyDropdown(profile.currency);
                updateModalLabels();
                if (prevCurr !== profile.currency || !elements.totalAmount || elements.totalAmount.textContent.includes("—")) {
                    refreshAllCurrencyDisplays();
                }
            }
            // Inject email under the user name in the profile menu
            const profileMenu = elements.profileMenu;
            if (profileMenu && profile.email) {
                const emailEl = document.getElementById("profileEmail");
                if (emailEl) {
                    emailEl.textContent = profile.email;
                } else {
                    // Dynamically insert email badge at top of profile menu
                    const emailDiv = document.createElement("div");
                    emailDiv.id = "profileEmail";
                    emailDiv.className = "profile-email-badge";
                    emailDiv.textContent = profile.email;
                    const header = profileMenu.querySelector(".profile-menu-header");
                    if (header) {
                        header.insertAdjacentElement("afterend", emailDiv);
                    } else {
                        profileMenu.insertBefore(emailDiv, profileMenu.firstChild);
                    }
                }
            }
        }
    } catch (err) {
        console.warn("Could not load user profile:", err);
    }
})();

// --- EXPORT & IMPORT CONTROLS ---
const authToken = localStorage.getItem("token");

// Exports must carry the JWT as an Authorization header, not a URL query
// param — the backend's JwtAuthenticationFilter only ever reads the header,
// so a plain window.open(url?token=...) request always comes back 401.
function escapeSpreadsheetXml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function generateXmlSpreadsheet(sheetName, headers, rows, totalColIdx, totalLabel, currency, accentColor = "#107C41") {
    // Dynamic column widths tailored to content type
    const colWidths = [50, 95, 140, 125, 260, 85];

    // noinspection XmlUnregisteredUri
    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${escapeSpreadsheetXml(sheetName)} Ledger</Title>
  <Author>ExpenseTracker Executive</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <!-- Global Normal Style -->
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>

  <!-- Modern Hero Header Style -->
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="${accentColor}"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${accentColor}"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${accentColor}"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${accentColor}"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="${accentColor}" ss:Pattern="Solid"/>
  </Style>

  <!-- Standard Row Data Styles -->
  <Style ss:ID="DataLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="DataLeftZebra">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1E293B"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="DataCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="DataCenterZebra">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1E293B"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>

  <!-- Currency Formats -->
  <Style ss:ID="Currency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>

  <Style ss:ID="CurrencyZebra">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>

  <!-- Total Summary Row -->
  <Style ss:ID="TotalLabel">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="${accentColor}"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="TotalValue">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="${accentColor}"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="${accentColor}"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeSpreadsheetXml(sheetName)}">
  <Table ss:DefaultRowHeight="20">`;

    // Define column widths
    colWidths.forEach(w => {
        xml += `\n   <Column ss:Width="${w}"/>`;
    });

    // Header Row with comfortable 28pt height
    xml += `\n   <Row ss:Height="28">`;
    headers.forEach(h => {
        xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeSpreadsheetXml(h)}</Data></Cell>`;
    });
    xml += `</Row>`;

    let sum = 0;
    rows.forEach((r, rowNum) => {
        const isZebra = (rowNum % 2 === 1);
        xml += `\n   <Row ss:Height="21">`;
        r.forEach((cell, idx) => {
            if (idx === totalColIdx) {
                const num = parseFloat(cell) || 0;
                sum += num;
                const style = isZebra ? "CurrencyZebra" : "Currency";
                xml += `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${num}</Data></Cell>`;
            } else if (idx === 0 || idx === 1 || idx === 5) {
                const style = isZebra ? "DataCenterZebra" : "DataCenter";
                xml += `<Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeSpreadsheetXml(String(cell ?? ""))}</Data></Cell>`;
            } else if (typeof cell === "number") {
                const style = isZebra ? "CurrencyZebra" : "Currency";
                xml += `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${cell}</Data></Cell>`;
            } else {
                const style = isZebra ? "DataLeftZebra" : "DataLeft";
                xml += `<Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeSpreadsheetXml(String(cell ?? ""))}</Data></Cell>`;
            }
        });
        xml += `</Row>`;
    });

    if (totalColIdx !== undefined) {
        xml += `\n   <Row ss:Height="26">`;
        for (let i = 0; i < headers.length; i++) {
            if (i === totalColIdx - 1) {
                xml += `<Cell ss:StyleID="TotalLabel"><Data ss:Type="String">${escapeSpreadsheetXml(totalLabel || "TOTAL")}:</Data></Cell>`;
            } else if (i === totalColIdx) {
                // Live Excel column formula with fallback calculated sum
                xml += `<Cell ss:StyleID="TotalValue" ss:Formula="=SUM(R2C:R[-1]C)"><Data ss:Type="Number">${sum}</Data></Cell>`;
            } else {
                xml += `<Cell ss:StyleID="TotalLabel"/>`;
            }
        }
        xml += `</Row>`;
    }

    xml += `\n  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
   <ActivePane>2</ActivePane>
   <Panes>
    <Pane>
     <Number>3</Number>
    </Pane>
    <Pane>
     <Number>2</Number>
    </Pane>
   </Panes>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
    return xml;
}

function triggerFileDownload(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Delay revocation to allow browser background file streaming to complete
    setTimeout(() => {
        try {
            a.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (_) {}
    }, 2500);
}

function exportExpensesClientSideExcel() {
    const list = Array.isArray(allExpenses) ? allExpenses : [];
    const activeCurr = (typeof getSelectedCurrency === "function" ? getSelectedCurrency() : (localStorage.getItem("userCurrency") || "INR"));
    const headers = ["ID", "Date", "Category", `Amount (${activeCurr})`, "Description", "Recurring"];
    const rows = list.map((e, idx) => [
        e.id || (idx + 1),
        e.expenseDate || e.date || "",
        e.category?.name || e.categoryName || e.category || "General",
        parseFloat(e.amount) || 0,
        e.description || "",
        (e.recurring || e.isRecurring) ? "YES" : "NO"
    ]);
    const xml = generateXmlSpreadsheet("Expenses", headers, rows, 3, `TOTAL OUTFLOW (${activeCurr})`, activeCurr, "#1E40AF");
    const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
    triggerFileDownload(blob, "expenses.xlsx");
}

function exportIncomesClientSideExcel() {
    const list = Array.isArray(allIncomes) ? allIncomes : [];
    const activeCurr = (typeof getSelectedCurrency === "function" ? getSelectedCurrency() : (localStorage.getItem("userCurrency") || "INR"));
    const headers = ["ID", "Date", "Source", `Amount (${activeCurr})`, "Description", "Recurring"];
    const rows = list.map((inc, idx) => [
        inc.id || (idx + 1),
        inc.incomeDate || inc.date || "",
        inc.source || "Cash Inflow",
        parseFloat(inc.amount) || 0,
        inc.description || "",
        (inc.isRecurring || inc.recurring) ? "YES" : "NO"
    ]);
    const xml = generateXmlSpreadsheet("Incomes", headers, rows, 3, `TOTAL INFLOW (${activeCurr})`, activeCurr, "#047857");
    const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
    triggerFileDownload(blob, "incomes.xlsx");
}

// Helper to track file upload progress with XMLHttpRequest

// --- MODERN FLOATING LIVE TRANSFER DOCK ---
const TransferDock = (() => {
    let dockEl = null;
    let hideTimeout = null;

    function getOrCreateDock() {
        if (dockEl && document.body.contains(dockEl)) return dockEl;
        dockEl = document.createElement("div");
        dockEl.id = "transferDock";
        dockEl.className = "transfer-dock";
        dockEl.innerHTML = `
            <div class="transfer-dock-header">
                <div class="transfer-dock-file">
                    <div class="transfer-dock-icon" id="transferDockIcon">📄</div>
                    <div class="transfer-dock-info">
                        <div class="transfer-dock-filename" id="transferDockFilename">File</div>
                        <div class="transfer-dock-status" id="transferDockStatus">Initializing...</div>
                    </div>
                </div>
                <span class="transfer-dock-badge export" id="transferDockBadge">Export</span>
            </div>
            <div class="transfer-progress-track">
                <div class="transfer-progress-fill" id="transferDockFill"></div>
            </div>
            <div class="transfer-dock-footer">
                <span id="transferDockDetail">Connecting...</span>
                <span class="u-inl-83e4487" id="transferDockPct">0%</span>
            </div>
        `;
        document.body.appendChild(dockEl);
        return dockEl;
    }

    function getIconForFile(filename) {
        const lower = String(filename || "").toLowerCase();
        if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "📊";
        if (lower.endsWith(".pdf")) return "📑";
        if (lower.endsWith(".csv")) return "📋";
        if (lower.endsWith(".json")) return "⚙️";
        return "📁";
    }

    return {
        show({ filename, mode = "export", status = "Preparing..." }) {
            clearTimeout(hideTimeout);
            const dock = getOrCreateDock();
            dock.className = `transfer-dock active ${mode}-mode`;
            const iconEl = document.getElementById("transferDockIcon");
            if (iconEl) iconEl.textContent = getIconForFile(filename);
            const nameEl = document.getElementById("transferDockFilename");
            if (nameEl) nameEl.textContent = filename;
            const statusEl = document.getElementById("transferDockStatus");
            if (statusEl) statusEl.textContent = status;
            const badge = document.getElementById("transferDockBadge");
            if (badge) {
                badge.className = `transfer-dock-badge ${mode}`;
                badge.textContent = mode === "export" ? "Exporting" : "Importing";
            }
            const fill = document.getElementById("transferDockFill");
            if (fill) fill.style.width = "5%";
            const pctEl = document.getElementById("transferDockPct");
            if (pctEl) pctEl.textContent = "0%";
            const detail = document.getElementById("transferDockDetail");
            if (detail) detail.textContent = "Starting transfer...";
        },
        updateProgress(pct, status, detail) {
            getOrCreateDock();
            if (pct != null && pct >= 0) {
                const clamped = Math.min(100, Math.max(0, Math.round(pct)));
                const fill = document.getElementById("transferDockFill");
                if (fill) fill.style.width = `${clamped}%`;
                const pctEl = document.getElementById("transferDockPct");
                if (pctEl) pctEl.textContent = `${clamped}%`;
            }
            if (status) {
                const statusEl = document.getElementById("transferDockStatus");
                if (statusEl) statusEl.textContent = status;
            }
            if (detail) {
                const detailEl = document.getElementById("transferDockDetail");
                if (detailEl) detailEl.textContent = detail;
            }
        },
        complete(message = "Complete") {
            const dock = getOrCreateDock();
            dock.className = "transfer-dock active complete-mode";
            const badge = document.getElementById("transferDockBadge");
            if (badge) {
                badge.className = "transfer-dock-badge complete";
                badge.textContent = "Complete";
            }
            const iconEl = document.getElementById("transferDockIcon");
            if (iconEl) iconEl.textContent = "✅";
            const fill = document.getElementById("transferDockFill");
            if (fill) fill.style.width = "100%";
            const pctEl = document.getElementById("transferDockPct");
            if (pctEl) pctEl.textContent = "100%";
            const statusEl = document.getElementById("transferDockStatus");
            if (statusEl) statusEl.textContent = message;
            const detail = document.getElementById("transferDockDetail");
            if (detail) detail.textContent = "Transfer finished";
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                dock.classList.remove("active");
            }, 3000);
        },
        fail(errorMessage = "Transfer failed") {
            const dock = getOrCreateDock();
            dock.className = "transfer-dock active";
            const badge = document.getElementById("transferDockBadge");
            if (badge) {
                badge.className = "transfer-dock-badge";
                badge.style.background = "rgba(239,68,68,0.2)";
                badge.style.color = "#EF4444";
                badge.textContent = "Failed";
            }
            const iconEl = document.getElementById("transferDockIcon");
            if (iconEl) iconEl.textContent = "⚠️";
            const statusEl = document.getElementById("transferDockStatus");
            if (statusEl) statusEl.textContent = errorMessage;
            const detail = document.getElementById("transferDockDetail");
            if (detail) detail.textContent = "Operation stopped";
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                dock.classList.remove("active");
            }, 4500);
        },
        hide() {
            if (dockEl) dockEl.classList.remove("active");
        }
    };
})();
window.TransferDock = TransferDock;
