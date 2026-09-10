/* Dashboard DOM registry and lightweight view helpers. */
(function () {
    "use strict";

    const elements = {
    totalAmount: document.getElementById("totalAmount"),
    expenseCount: document.getElementById("expenseCountText"),
    expenseList: document.getElementById("expenseList"),
    filterSearch: document.getElementById("filterSearch"),
    filterSort: document.getElementById("filterSort"),
    filterMonth: document.getElementById("filterMonth"),
    filterYear: document.getElementById("filterYear"),
    filterCategory: document.getElementById("filterCategory"),
    filterStartDate: document.getElementById("filterStartDate"),
    filterEndDate: document.getElementById("filterEndDate"),
    modal: document.getElementById("expenseModal"),
    categorySelect: document.getElementById("categorySelect"),
    addCategoryBtn: document.getElementById("addCategoryBtn"),
    addForm: document.getElementById("addExpenseForm"),
    isRecurring: document.getElementById("isRecurring"),
    recurringOptions: document.getElementById("recurringOptions"),
    recurringFrequency: document.getElementById("recurringFrequency"),
    customIntervalWrap: document.getElementById("customIntervalWrap"),
    recurringIntervalDays: document.getElementById("recurringIntervalDays"),
    profileMenu: document.getElementById("profileMenu"),
    profileTrigger: document.getElementById("profileTrigger"),
    toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
    filterPanel: document.getElementById("filterPanel"),
    themeToggle: document.getElementById("themeToggle"),
    addBudgetBtn: document.getElementById("addBudgetBtn"),
    budgetList: document.getElementById("budgetList"),
    // Subscription Elements
    manageSubsBtn: document.getElementById("manageSubsBtn"),
    subsModal: document.getElementById("subsModal"),
    subsList: document.getElementById("subsModalList") || document.getElementById("subsList"),
    closeSubsBtn: document.getElementById("closeSubsModalBtn") || document.getElementById("closeSubsBtn"),
    // Delete Account Elements
    deleteAccountBtn: document.getElementById("deleteAccountBtn"),
    deleteAccountModal: document.getElementById("deleteAccountModal"),
    deletePasswordInput: document.getElementById("deletePasswordInput"),
    deleteConfirmInput: document.getElementById("deleteConfirmInput"),
    confirmDeleteAccountBtn: document.getElementById("confirmDeleteAccountBtn"),
    cancelDeleteAccountBtn: document.getElementById("cancelDeleteAccountBtn")
};

    function initCurrencyPlaceholders() {
    const zeroCurr = DashboardUtils.formatCurrency(0);
    if (elements.totalAmount && (elements.totalAmount.textContent.trim() === "—" || elements.totalAmount.textContent.includes("₹") || elements.totalAmount.textContent.includes("$"))) {
        elements.totalAmount.textContent = zeroCurr;
    }
    const totalIncomeEl = document.getElementById("totalIncomeAmount");
    if (totalIncomeEl && (totalIncomeEl.textContent.trim() === "—" || totalIncomeEl.textContent.includes("$"))) {
        totalIncomeEl.textContent = zeroCurr;
    }
    const netCashFlowEl = document.getElementById("netCashFlowAmount");
    if (netCashFlowEl && (netCashFlowEl.textContent.trim() === "—" || netCashFlowEl.textContent.includes("$"))) {
        netCashFlowEl.textContent = zeroCurr;
    }
    const dailyBurnEl = document.getElementById("dailyBurnRate");
    if (dailyBurnEl && (dailyBurnEl.textContent.includes("—") || dailyBurnEl.textContent.includes("₹"))) {
        dailyBurnEl.textContent = `${zeroCurr} / day`;
    }
    const totalSavedProgress = document.getElementById("totalSavedProgress");
    if (totalSavedProgress && (totalSavedProgress.textContent.includes("—") || totalSavedProgress.textContent.includes("$"))) {
        totalSavedProgress.textContent = `Saved: ${zeroCurr}`;
    }
    const subsTotal = document.getElementById("subsMonthlyTotal");
    if (subsTotal && (subsTotal.textContent.includes("—") || subsTotal.textContent.includes("₹"))) {
        subsTotal.textContent = `${zeroCurr} / mo`;
    }
}


    function showSkeletonLoading() {
    // Metric card skeletons
    document.querySelectorAll('.metric-value').forEach(el => {
        el.dataset.realContent = el.textContent;
        el.innerHTML = '<span class="skeleton skeleton-value"></span>';
    });
    // Expense list skeleton
    if (elements.expenseList) {
        elements.expenseList.innerHTML = Array.from({ length: 5 }, () =>
            `<div class="skeleton skeleton-row"></div>`
        ).join('');
    }
    // Budget list skeleton
    if (elements.budgetList) {
        elements.budgetList.innerHTML = Array.from({ length: 3 }, () =>
            `<div class="skeleton skeleton-row" style="height:80px; margin-bottom:12px;"></div>`
        ).join('');
    }
}


    window.DashboardDom = Object.freeze({
        elements,
        initCurrencyPlaceholders: initCurrencyPlaceholders,
        showSkeletonLoading: showSkeletonLoading
    });
})();
