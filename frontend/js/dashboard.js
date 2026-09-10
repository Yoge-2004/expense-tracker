const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName") || "User";

if (!token || !userId) window.location.href = "index.html";

// UI Setup
document.querySelector(".top-bar p").textContent = `Welcome back, ${userName}`;
document.querySelector(".avatar").textContent = userName.charAt(0).toUpperCase();

// Shared dashboard utilities are loaded from js/modules/dashboard-utils.js.
const { getLocalDateString, parseLocalDate, escapeHtml, formatCurrency, formatDate } = window.DashboardUtils;

// Modal Scroll Lock Helpers
function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add("active");
    document.body.classList.add("modal-open");
}

function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove("active");
    const anyActive = document.querySelector(".modal-overlay.active");
    if (!anyActive) {
        document.body.classList.remove("modal-open");
    }
}

// Global State
let allExpenses = [];
let allCategories = [];
let userOnlyCategories = []; // subset of allCategories actually deletable (excludes global/seeded ones)
let allIncomes = [];
let allSavingsGoals = [];
let cachedBudgets = [];
window.cachedBudgets = cachedBudgets;
let pieChart = null;
let trendChart = null;
let budgetVsActualChart = null;
let recurringSplitChart = null;
let dayOfWeekChart = null;

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

// Immediate synchronization of metric cards with active currency
function initCurrencyPlaceholders() {
    const zeroCurr = formatCurrency(0);
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
initCurrencyPlaceholders();

// ── Category palette (consistent colors per category name) — muted ink/stamp tones ──
const CATEGORY_PALETTE = [
    { bg: 'rgba(199,154,62,0.12)', color: '#C79A3E' },  // gold
    { bg: 'rgba(162,62,50,0.12)',  color: '#A23E32' },  // oxblood
    { bg: 'rgba(76,122,120,0.12)', color: '#4C7A78' },  // teal
    { bg: 'rgba(91,140,90,0.12)',  color: '#5B8C5A' },  // sage
    { bg: 'rgba(139,94,52,0.12)',  color: '#8B5E34' },  // umber
    { bg: 'rgba(176,107,92,0.12)', color: '#B06B5C' },  // terracotta
    { bg: 'rgba(201,147,46,0.12)', color: '#C9932E' },  // mustard
    { bg: 'rgba(107,114,128,0.12)',color: '#6B7280' },  // slate
];
function getCategoryColor(name) {
    const idx = name ? name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % CATEGORY_PALETTE.length : 0;
    return CATEGORY_PALETTE[idx];
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

// --- 1. INITIALIZATION ---
// ── Local cache (stale-while-revalidate) ──────────────────────────────────
// Shows the last-known dashboard state instantly on load, refreshes from
// the server in the background, and falls back to this cache if the
// server is briefly unreachable (e.g. a cold-starting Neon connection)
// instead of leaving the UI stuck on skeletons or silently failing.
const CACHE_VERSION = 1;
function getCacheKey() { return `expenseCache_${userId}`; }

function saveExpenseCache(expenses, categories) {
    try {
        localStorage.setItem(getCacheKey(), JSON.stringify({
            v: CACHE_VERSION,
            savedAt: Date.now(),
            expenses,
            categories,
        }));
    } catch (e) {
        console.warn("Could not save expense cache:", e);
    }
}

function loadExpenseCache() {
    try {
        const raw = localStorage.getItem(getCacheKey());
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.v !== CACHE_VERSION || !Array.isArray(parsed.expenses)) return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

function renderDashboardData(expenses, categories) {
    allCategories = categories;
    const incomingExpenses = (expenses && expenses.length > 0) ? expenses : ((window.allExpenses && window.allExpenses.length > 0) ? window.allExpenses : (allExpenses || []));
    allExpenses = incomingExpenses.sort((a, b) => {
        const dDiff = new Date(b.expenseDate) - new Date(a.expenseDate);
        if (dDiff !== 0) return dDiff;
        if (b.createdAt && a.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
        return (b.id || 0) - (a.id || 0);
    });

    populateCategoryDropdown(allCategories);
    populateFilterDropdowns(allCategories, allExpenses);
    renderCategoryPills(allCategories);

    applyFilters();
    renderTrendChart(allExpenses);
    loadBudgets();
    updateProMetrics(allExpenses);
}

async function loadDashboard(skipCache = false) {
    if (skipCache) {
        if (typeof window.clearApiCache === "function") {
            window.clearApiCache();
        }
        try { localStorage.removeItem(getCacheKey()); } catch (_) {}
    }
    const cached = skipCache ? null : loadExpenseCache();
    const renderedFromCache = !!cached;

    if (cached) {
        allExpenses = cached.expenses || [];
        allCategories = cached.categories || [];
        renderDashboardData(cached.expenses, cached.categories);
        renderIncomes(allIncomes || []);
        renderSavingsGoals(allSavingsGoals || []);
    } else {
        showSkeletonLoading();
    }

    try {
        console.log("Loading Dashboard Data...");

        const [expenses, globalCats, userCats, incomes, savingsGoals] = await Promise.all([
            apiRequest(`/expenses/user/${userId}`, { skipCache }),
            apiRequest(`/categories/global`, { skipCache }),
            apiRequest(`/categories/user/${userId}`, { skipCache }),
            apiRequest(`/incomes/user/${userId}`, { skipCache }).catch(err => { console.warn("Incomes fetch error:", err); return []; }),
            apiRequest(`/savings/goals/user/${userId}`, { skipCache }).catch(err => { console.warn("Savings fetch error:", err); return []; })
        ]);

        allIncomes = Array.isArray(incomes) ? incomes : [];
        allSavingsGoals = Array.isArray(savingsGoals) ? savingsGoals : [];

        // Merge Categories safely
        const safeGlobal = Array.isArray(globalCats) ? globalCats : [];
        const safeUser = Array.isArray(userCats) ? userCats : [];
        const categories = [...safeGlobal, ...safeUser];
        userOnlyCategories = safeUser;

        renderDashboardData(expenses, categories);
        renderIncomes(allIncomes);
        renderSavingsGoals(allSavingsGoals);
        updateCashFlowMetrics(expenses || [], allIncomes, allSavingsGoals);
        saveExpenseCache(expenses, categories);

    } catch (error) {
        console.error("Critical Error:", error);
        if (error.message.includes("User not found")) {
            localStorage.clear();
            window.location.href = "index.html";
            return;
        }
        if (renderedFromCache) {
            showToast("Couldn't reach the server — showing your last saved data.", "error");
        } else {
            showToast("Couldn't load your data. Check your connection and try again.", "error");
        }
    }
}

