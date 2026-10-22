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
            val.innerHTML = "<span class='skeleton skeleton-value u-inl-fecf809'></span>";
        }
        const badge = card.querySelector(".status-badge");
        if (badge) {
            badge.innerHTML = "<span class='skeleton skeleton-text short u-inl-fdd03f2'></span>";
        }
        const dailyBurn = card.querySelector("#dailyBurnRate");
        if (dailyBurn) {
            dailyBurn.innerHTML = "<span class='skeleton skeleton-text short u-inl-7b439f0'></span>";
        } else {
            const footerSpan = card.querySelector(".metric-footer span");
            if (footerSpan && !footerSpan.querySelector(".skeleton")) {
                footerSpan.innerHTML = "<span class='skeleton skeleton-text short u-inl-0eaf717'></span>";
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
    // Loans metric cards & list skeleton
    document.querySelectorAll(".loans-metrics-grid .loan-metric-card").forEach(card => {
        card.classList.add("is-loading");
    });
    const lentVal = document.getElementById("loansTotalLent");
    if (lentVal) lentVal.innerHTML = "<span class='skeleton skeleton-value u-inl-37f90ee'></span>";
    const borrowedVal = document.getElementById("loansTotalBorrowed");
    if (borrowedVal) borrowedVal.innerHTML = "<span class='skeleton skeleton-value u-inl-37f90ee'></span>";
    const netVal = document.getElementById("loansNetBalance");
    if (netVal) netVal.innerHTML = "<span class='skeleton skeleton-value u-inl-37f90ee'></span>";
    const pendingCountEl = document.getElementById("loansPendingCount");
    const settledCountEl = document.getElementById("loansSettledCount");
    if (pendingCountEl && pendingCountEl.parentElement) {
        pendingCountEl.parentElement.innerHTML = "<span id='loansPendingCount'><span class='skeleton skeleton-value u-inl-d6591c9'></span></span> <span class='u-inl-d7930ba'>open / </span><span id='loansSettledCount'><span class='skeleton skeleton-value u-inl-d6591c9'></span></span> <span class='u-inl-b61e5de'>done</span>";
    }
    const lentPendingSubEl = document.getElementById("loansLentPendingCount");
    if (lentPendingSubEl) lentPendingSubEl.innerHTML = "<span class='skeleton skeleton-text short u-inl-60bcdfa'></span>";
    const borrowedPendingSubEl = document.getElementById("loansBorrowedPendingCount");
    if (borrowedPendingSubEl) borrowedPendingSubEl.innerHTML = "<span class='skeleton skeleton-text short u-inl-60bcdfa'></span>";
    const netStatusEl = document.getElementById("loansNetStatus");
    if (netStatusEl) netStatusEl.innerHTML = "<span class='skeleton skeleton-text short u-inl-7b439f0'></span>";

    const loansList = document.getElementById("loansListContainer");
    if (loansList) {
        loansList.innerHTML = `
            <div class="loans-skeleton-loader u-inl-5c3d2b7">
                <div class="skeleton u-inl-0a2a868"></div>
                <div class="skeleton u-inl-ced01e1"></div>
                <div class="skeleton u-inl-ced01e1"></div>
            </div>`;
    }
    // Financial insights skeleton
    const insightsGrid = document.getElementById("insightsCardsGrid");
    if (insightsGrid && !insightsGrid.children.length) {
        insightsGrid.innerHTML = Array.from({ length: 3 }, () =>
            `<div class="skeleton skeleton-card u-inl-22bddb4"></div>`
        ).join('');
    }
    // Money flow skeleton
    const moneyFlowBody = document.getElementById("moneyFlowBody");
    if (moneyFlowBody && !moneyFlowBody.children.length) {
        moneyFlowBody.innerHTML = `
            <div class="money-flow-skeleton u-inl-f10199d">
                <div class="skeleton skeleton-row u-inl-aac7ab4"></div>
                <div class="skeleton skeleton-row u-inl-aac7ab4"></div>
                <div class="skeleton skeleton-row u-inl-aac7ab4"></div>
                <div class="skeleton skeleton-row u-inl-aac7ab4"></div>
            </div>`;
    }
}


    window.DashboardDom = Object.freeze({
        elements,
        initCurrencyPlaceholders: initCurrencyPlaceholders,
        showSkeletonLoading: showSkeletonLoading
    });
})();
