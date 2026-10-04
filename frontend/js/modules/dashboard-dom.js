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
    const isSkeleton = (el) => el && (el.querySelector(".skeleton") || el.classList.contains("skeleton") || el.closest(".is-loading"));
    const zeroCurr = DashboardUtils.formatCurrency(0);
    if (elements.totalAmount && !isSkeleton(elements.totalAmount) && (elements.totalAmount.textContent.trim() === "—" || elements.totalAmount.textContent.includes("₹") || elements.totalAmount.textContent.includes("$"))) {
        elements.totalAmount.textContent = zeroCurr;
    }
    const totalIncomeEl = document.getElementById("totalIncomeAmount");
    if (totalIncomeEl && !isSkeleton(totalIncomeEl) && (totalIncomeEl.textContent.trim() === "—" || totalIncomeEl.textContent.includes("$"))) {
        totalIncomeEl.textContent = zeroCurr;
    }
    const netCashFlowEl = document.getElementById("netCashFlowAmount");
    if (netCashFlowEl && !isSkeleton(netCashFlowEl) && (netCashFlowEl.textContent.trim() === "—" || netCashFlowEl.textContent.includes("$"))) {
        netCashFlowEl.textContent = zeroCurr;
    }
    const dailyBurnEl = document.getElementById("dailyBurnRate");
    if (dailyBurnEl && !isSkeleton(dailyBurnEl) && (dailyBurnEl.textContent.includes("—") || dailyBurnEl.textContent.includes("₹"))) {
        dailyBurnEl.textContent = `${zeroCurr} / day`;
    }
    const totalSavedProgress = document.getElementById("totalSavedProgress");
    if (totalSavedProgress && !isSkeleton(totalSavedProgress) && (totalSavedProgress.textContent.includes("—") || totalSavedProgress.textContent.includes("$"))) {
        totalSavedProgress.textContent = `Saved: ${zeroCurr}`;
    }
    const subsTotal = document.getElementById("subsMonthlyTotal");
    if (subsTotal && !isSkeleton(subsTotal) && (subsTotal.textContent.includes("—") || subsTotal.textContent.includes("₹"))) {
        subsTotal.textContent = `${zeroCurr} / mo`;
    }
}


    function showSkeletonLoading() {
    // Metric card skeletons
    document.querySelectorAll(".grid-4-metrics .metric-card").forEach(card => {
        card.classList.add("is-loading");
        const val = card.querySelector(".metric-value");
        if (val) {
            val.innerHTML = "<span class=\"skeleton skeleton-value\" style=\"width:115px; height:28px; display:inline-block; margin-bottom:0;\"></span>";
        }
        const badge = card.querySelector(".status-badge");
        if (badge) {
            badge.innerHTML = "<span class=\"skeleton skeleton-text short\" style=\"width:48px; height:14px; display:inline-block; border-radius:99px; margin-bottom:0;\"></span>";
        }
        const dailyBurn = card.querySelector("#dailyBurnRate");
        if (dailyBurn) {
            dailyBurn.innerHTML = "<span class=\"skeleton skeleton-text short\" style=\"width:65px; height:12px; display:inline-block; margin-bottom:0;\"></span>";
        } else {
            const footerSpan = card.querySelector(".metric-footer span");
            if (footerSpan && !footerSpan.querySelector(".skeleton")) {
                footerSpan.innerHTML = "<span class=\"skeleton skeleton-text short\" style=\"width:85px; height:12px; display:inline-block; margin-bottom:0;\"></span>";
            }
        }
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
            `<div class="skeleton skeleton-card"></div>`
        ).join('');
    }
    // Income list skeleton (identical to expense list skeleton)
    const incomeListEl = document.getElementById("incomeList");
    if (incomeListEl) {
        incomeListEl.innerHTML = Array.from({ length: 5 }, () =>
            `<div class="skeleton skeleton-row"></div>`
        ).join('');
    }
    // Savings goals skeleton (3 cards)
    const savingsList = document.getElementById("savingsGoalsList") || document.getElementById("savingsGoalList");
    if (savingsList) {
        savingsList.innerHTML = Array.from({ length: 3 }, () =>
            `<div class="skeleton skeleton-card"></div>`
        ).join('');
    }
    // Financial insights skeleton
    const insightsGrid = document.getElementById("insightsCardsGrid");
    if (insightsGrid && !insightsGrid.children.length) {
        insightsGrid.innerHTML = Array.from({ length: 3 }, () =>
            `<div class="skeleton skeleton-card" style="min-height:110px;"></div>`
        ).join('');
    }
}


    window.DashboardDom = Object.freeze({
        elements,
        initCurrencyPlaceholders: initCurrencyPlaceholders,
        showSkeletonLoading: showSkeletonLoading
    });
})();
