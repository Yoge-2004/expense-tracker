// Check for test mock auth in test environments
const urlSearch = window.location.search || (window.location.href.includes("?") ? window.location.href.slice(window.location.href.indexOf("?")) : "");
const urlParams = new URLSearchParams(urlSearch);
if (urlParams.get("test_mock_auth") === "true" || window.location.href.includes("test_mock_auth=true")) {
    localStorage.setItem("token", "mock_jwt_token_123");
    localStorage.setItem("userId", "101");
    if (!localStorage.getItem("userName")) localStorage.setItem("userName", "Alex Smith");
    if (!localStorage.getItem("userCurrency")) localStorage.setItem("userCurrency", "USD");
}

const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName") || "User";

if (!token || !userId) window.location.href = "index.html";

// UI Setup
document.querySelector(".top-bar p").textContent = `Welcome back, ${userName}`;
document.querySelector(".avatar").textContent = userName.charAt(0).toUpperCase();

// Timezone-safe local date helpers (guarantees local timezone accuracy at 12:00 AM midnight)
function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString) {
    if (!dateString) return new Date();
    if (dateString instanceof Date) return dateString;
    const parts = String(dateString).split('T')[0].split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dateString);
}

// Helpers
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

const formatCurrency = (amt) => (typeof formatGlobalCurrency === "function" ? formatGlobalCurrency(amt) : `${typeof getCurrencySymbol === "function" ? getCurrencySymbol() : "$"} ${Number(amt || 0).toFixed(2)}`);
const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = parseLocalDate(dateString);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

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
            renderDashboardData([], []);
        }
        renderIncomes(allIncomes || []);
        renderSavingsGoals(allSavingsGoals || []);
        loadBudgets();
    }
}

// --- PRO METRICS CALCULATION ---
async function updateProMetrics(expenses) {
    if (!Array.isArray(expenses)) return;

    // Total Spent & Count
    const totalSpent = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const count = expenses.length;
    
    if (elements.totalAmount) elements.totalAmount.textContent = formatCurrency(totalSpent);
    const countEl = document.getElementById("expenseCountText");
    if (countEl) countEl.textContent = `${count} transaction${count === 1 ? '' : 's'} recorded`;

    // Daily Burn Rate & Month End Forecast
    const now = new Date();
    const currentDay = Math.max(now.getDate(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    // Filter expenses for current month
    const currentMonthExpenses = expenses.filter(e => {
        const d = new Date(e.expenseDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const currentMonthSpent = currentMonthExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const dailyBurn = currentMonthSpent / currentDay;
    const projectedSpent = dailyBurn * daysInMonth;

    const dailyBurnEl = document.getElementById("dailyBurnRate");
    if (dailyBurnEl) dailyBurnEl.textContent = `${formatCurrency(dailyBurn)} / day`;
    const forecastEl = document.getElementById("monthForecast");
    if (forecastEl) forecastEl.textContent = `Projected: ${formatCurrency(projectedSpent)}`;

    // Top Category
    const catMap = {};
    expenses.forEach(e => {
        const cat = e.categoryName || 'Other';
        catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0);
    });

    let topCat = 'None';
    let maxAmt = 0;
    Object.entries(catMap).forEach(([cat, amt]) => {
        if (amt > maxAmt) {
            maxAmt = amt;
            topCat = cat;
        }
    });

    const topCatNameEl = document.getElementById("topCategoryName");
    if (topCatNameEl) topCatNameEl.textContent = topCat;
    const topCatAmtEl = document.getElementById("topCategoryAmount");
    if (topCatAmtEl) topCatAmtEl.textContent = `${formatCurrency(maxAmt)} spent`;

    // Subscriptions Fetch
    try {
        const subs = await apiRequest(`/expenses/recurring/user/${userId}`);
        const safeSubs = Array.isArray(subs) ? subs : [];
        // Every record returned by this endpoint IS an active subscription —
        // RecurringExpense has no status/paused/cancelled concept at all, so
        // this used to filter on a field (`status`) that the backend never
        // sent. That silently zeroed out the count and monthly total on
        // every real account, regardless of how many subscriptions actually
        // existed — every screenshot taken this session showed "0 Active"
        // for exactly this reason.
        const activeSubs = safeSubs;
        const monthlyTotal = activeSubs.reduce((acc, s) => acc + Number(s.amount || 0), 0);

        const subsBadge = document.getElementById("subsCountBadge");
        if (subsBadge) subsBadge.textContent = `${activeSubs.length} Active`;
        const subsTotal = document.getElementById("subsMonthlyTotal");
        if (subsTotal) subsTotal.textContent = `${formatCurrency(monthlyTotal)} / mo`;
    } catch (err) {
        console.error("Subs fetch error", err);
    }
}


/**
 * Computes and renders real-time financial insights into the Smart Intelligence panel.
 */
function renderFinancialInsights(expenses) {

    const grid = document.getElementById("insightsCardsGrid");
    const healthBadge = document.getElementById("insightsHealthScoreText");
    if (!grid) return;

    const safeExpenses = (window.allExpenses && window.allExpenses.length > 0) ? window.allExpenses : (Array.isArray(expenses) ? expenses : (allExpenses || []));
    const safeIncomes = (window.allIncomes && window.allIncomes.length > 0) ? window.allIncomes : (Array.isArray(allIncomes) ? allIncomes : []);
    const safeGoals = (window.allSavingsGoals && window.allSavingsGoals.length > 0) ? window.allSavingsGoals : (Array.isArray(allSavingsGoals) ? allSavingsGoals : []);

    if (safeExpenses.length === 0 && safeIncomes.length === 0 && safeGoals.length === 0) {
        grid.innerHTML = `
            <div class="insight-card-item" style="grid-column: 1 / -1; width: 100%; max-width: 100%; box-sizing: border-box; text-align: center; padding: 20px 16px;">
                <p class="text-muted" style="margin: 0; font-size: 13.5px; line-height: 1.5; word-break: break-word;">No transactions, incomes, or savings goals recorded. Add entries to generate real-time financial intelligence.</p>
            </div>
        `;
        if (healthBadge) healthBadge.textContent = "100% Financial Health";
        return;
    }

    const now = new Date();
    const currentDay = Math.max(now.getDate(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Current month expenses and daily burn
    const currentMonthExpenses = safeExpenses.filter(e => {
        const d = new Date(e.expenseDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const currentMonthSpent = currentMonthExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const totalAllExpenses = safeExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const activeOutflow = currentMonthSpent > 0 ? currentMonthSpent : totalAllExpenses;
    const dailyBurn = currentDay > 0 ? (currentMonthSpent / currentDay) : 0;
    const projectedSpent = dailyBurn * daysInMonth;

    // 2. Current month incomes & active inflow
    const currentMonthIncomes = safeIncomes.filter(i => {
        const d = new Date(i.incomeDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const currentMonthInflow = currentMonthIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const totalAllInflow = safeIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const activeInflow = currentMonthInflow > 0 ? currentMonthInflow : totalAllInflow;

    // 3. Synthesis: Net Cash Flow & Savings Rate (Inflows vs Outflows)
    const netCashflow = activeInflow - activeOutflow;
    const savingsRate = activeInflow > 0 ? Math.round((netCashflow / activeInflow) * 100) : 0;

    let cashflowInsight = "";
    if (activeInflow > 0) {
        if (savingsRate >= 20) {
            cashflowInsight = `Retaining <strong>${savingsRate}%</strong> of income. Net monthly surplus is <strong>+${formatCurrency(netCashflow)}</strong>, exceeding wealth accumulation benchmarks.`;
        } else if (netCashflow >= 0) {
            cashflowInsight = `Retaining <strong>${savingsRate}%</strong> of income (+<strong>${formatCurrency(netCashflow)}</strong> surplus). Strive for ≥20% to accelerate goal funding.`;
        } else {
            cashflowInsight = `⚠️ Net deficit of <strong>-${formatCurrency(Math.abs(netCashflow))}</strong> this period. Outflows exceed inflows by <strong>${Math.round((activeOutflow / activeInflow) * 100)}%</strong>.`;
        }
    } else {
        cashflowInsight = `Total spend is <strong>${formatCurrency(activeOutflow)}</strong>. Record your income streams in Cash Inflow to calculate your net savings rate.`;
    }

    // 4. Synthesis: Savings Goals Trajectory (Goals vs Net Cash Flow)
    const totalGoalsTarget = safeGoals.reduce((acc, g) => acc + Number(g.targetAmount || 0), 0);
    const totalGoalsCurrent = safeGoals.reduce((acc, g) => acc + Number(g.currentAmount || 0), 0);
    const remainingGoalsNeeded = Math.max(0, totalGoalsTarget - totalGoalsCurrent);
    const goalsOverallPct = totalGoalsTarget > 0 ? Math.round((totalGoalsCurrent / totalGoalsTarget) * 100) : 0;

    let goalsInsight = "";
    if (safeGoals.length === 0) {
        goalsInsight = `No active savings goals. Establish reserve targets (e.g. Emergency Fund, Investments) to project funding velocity.`;
    } else if (remainingGoalsNeeded <= 0 && totalGoalsTarget > 0) {
        goalsInsight = `🎉 All active savings milestones are <strong>100% funded</strong> (${formatCurrency(totalGoalsCurrent)} saved). Ready for new financial horizons.`;
    } else if (netCashflow > 0) {
        const monthsToFund = Math.max(1, Math.ceil(remainingGoalsNeeded / netCashflow));
        goalsInsight = `At current net surplus of <strong>${formatCurrency(netCashflow)}/mo</strong>, remaining targets (<strong>${formatCurrency(remainingGoalsNeeded)}</strong>) will be reached in ~<strong>${monthsToFund} month${monthsToFund === 1 ? '' : 's'}</strong> (${goalsOverallPct}% achieved).`;
    } else {
        goalsInsight = `<strong>${goalsOverallPct}% achieved</strong> (${formatCurrency(totalGoalsCurrent)} of ${formatCurrency(totalGoalsTarget)}). Boost monthly surplus or reduce discretionary drain to accelerate funding.`;
    }

    // 5. Synthesis: Recurring Baseline Coverage (Recurring Incomes vs Subscriptions)
    const recurringIncomes = safeIncomes.filter(i => !!(i.isRecurring || i.recurring));
    const recurringExpenses = safeExpenses.filter(e => !!(e.isRecurring || e.recurring));

    const monthlyRecInflow = recurringIncomes.reduce((acc, i) => {
        const amt = Number(i.amount || 0);
        const freq = (i.frequency || "MONTHLY").toUpperCase();
        if (freq === "WEEKLY") return acc + (amt * 52 / 12);
        if (freq === "DAILY") return acc + (amt * 365 / 12);
        return acc + amt;
    }, 0);

    const monthlyRecOutflow = recurringExpenses.reduce((acc, e) => {
        const amt = Number(e.amount || 0);
        const freq = (e.frequency || "MONTHLY").toUpperCase();
        if (freq === "WEEKLY") return acc + (amt * 52 / 12);
        if (freq === "DAILY") return acc + (amt * 365 / 12);
        return acc + amt;
    }, 0);

    let recurringInsight = "";
    if (monthlyRecInflow > 0 && monthlyRecOutflow > 0) {
        const covPct = Math.round((monthlyRecInflow / monthlyRecOutflow) * 100);
        const netRec = monthlyRecInflow - monthlyRecOutflow;
        recurringInsight = `Recurring inflow (<strong>${formatCurrency(monthlyRecInflow)}/mo</strong>) covers <strong>${covPct}%</strong> of recurring subscriptions (<strong>${formatCurrency(monthlyRecOutflow)}/mo</strong>), leaving a <strong>${netRec >= 0 ? '+' : ''}${formatCurrency(netRec)}/mo</strong> baseline buffer.`;
    } else if (monthlyRecInflow > 0) {
        recurringInsight = `Guaranteed recurring inflow of <strong>${formatCurrency(monthlyRecInflow)}/mo</strong> with zero fixed subscriptions recorded.`;
    } else if (monthlyRecOutflow > 0) {
        recurringInsight = `Fixed subscriptions total <strong>${formatCurrency(monthlyRecOutflow)}/mo</strong>. Tag steady income streams as Recurring to safeguard baseline obligations.`;
    } else {
        recurringInsight = `No recurring subscriptions or income streams detected. Tag salary or SaaS renewals as Recurring for baseline tracking.`;
    }

    // 6. Category Concentration & Top Outflow
    const catMap = {};
    let totalCategorized = 0;
    safeExpenses.forEach(e => {
        const amt = Number(e.amount || 0);
        const cat = e.categoryName || "Other";
        catMap[cat] = (catMap[cat] || 0) + amt;
        totalCategorized += amt;
    });

    let topCat = "None";
    let topCatAmt = 0;
    Object.entries(catMap).forEach(([cat, amt]) => {
        if (amt > topCatAmt) {
            topCatAmt = amt;
            topCat = cat;
        }
    });
    const topCatPct = totalCategorized > 0 ? ((topCatAmt / totalCategorized) * 100).toFixed(1) : "0";

    // 7. Budget Governance & Adherence
    let budgetHealthScore = 35;
    let budgetInsightText = "All categories operating smoothly within limits.";
    const safeBudgets = (typeof cachedBudgets !== 'undefined' && Array.isArray(cachedBudgets)) ? cachedBudgets : (window.cachedBudgets || []);
    if (safeBudgets && safeBudgets.length > 0) {
        let exceededCount = 0;
        let warningCount = 0;
        safeBudgets.forEach(b => {
            const limit = Number(b.limit || b.amount || 0);
            const spent = Number(b.spent || 0);
            if (limit > 0) {
                const ratio = spent / limit;
                if (ratio > 1.0) exceededCount++;
                else if (ratio >= 0.8) warningCount++;
            }
        });
        const penalty = (exceededCount * 18) + (warningCount * 8);
        budgetHealthScore = Math.max(0, 35 - penalty);
        if (exceededCount > 0) {
            budgetInsightText = `⚠️ <strong>${exceededCount} budget(s) exceeded</strong>. Review high-spend categories immediately.`;
        } else if (warningCount > 0) {
            budgetInsightText = `🟡 <strong>${warningCount} budget(s) nearing limit</strong> (>80% capacity utilized).`;
        } else {
            budgetInsightText = `🟢 <strong>${safeBudgets.length} of ${safeBudgets.length}</strong> categories strictly on target.`;
        }
    }

    // 8. Holistic Synthesized Financial Health Score (0-100%)
    let cashflowScore = 20;
    if (activeInflow > 0) {
        if (savingsRate >= 25) cashflowScore = 35;
        else if (savingsRate >= 15) cashflowScore = 30;
        else if (savingsRate >= 0) cashflowScore = 22;
        else if (savingsRate >= -15) cashflowScore = 10;
        else cashflowScore = 0;
    }

    let resilienceScore = 20;
    if (safeGoals.length > 0 || recurringIncomes.length > 0) {
        let goalPts = (goalsOverallPct >= 50 ? 15 : 10);
        let recPts = (monthlyRecInflow >= monthlyRecOutflow ? 15 : 5);
        resilienceScore = Math.min(30, goalPts + recPts);
    }

    const holisticScore = Math.min(100, Math.max(10, Math.round(budgetHealthScore + cashflowScore + resilienceScore)));

    if (healthBadge) {
        healthBadge.textContent = `${holisticScore}% Financial Health`;
    }

    grid.innerHTML = `
        <div class="insight-card-item">
            <div class="insight-card-item-header">
                <div class="insight-icon-box" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">⚖️</div>
                <span class="insight-card-label">Net Cash Flow & Savings Rate</span>
            </div>
            <div class="insight-card-content">
                ${cashflowInsight}
            </div>
        </div>

        <div class="insight-card-item">
            <div class="insight-card-item-header">
                <div class="insight-icon-box" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B;">🎯</div>
                <span class="insight-card-label">Savings Goals Trajectory</span>
            </div>
            <div class="insight-card-content">
                ${goalsInsight}
            </div>
        </div>

        <div class="insight-card-item">
            <div class="insight-card-item-header">
                <div class="insight-icon-box" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6;">🔄</div>
                <span class="insight-card-label">Recurring Baseline Coverage</span>
            </div>
            <div class="insight-card-content">
                ${recurringInsight}
            </div>
        </div>

        <div class="insight-card-item">
            <div class="insight-card-item-header">
                <div class="insight-icon-box" style="background: rgba(199, 154, 62, 0.15); color: #C79A3E;">🔥</div>
                <span class="insight-card-label">Burn Velocity & Runway</span>
            </div>
            <div class="insight-card-content">
                Averaging <strong>${formatCurrency(dailyBurn)}/day</strong> this month. Projected month-end outflow is <strong>${formatCurrency(projectedSpent)}</strong>.
            </div>
        </div>

        <div class="insight-card-item">
            <div class="insight-card-item-header">
                <div class="insight-icon-box" style="background: rgba(76, 122, 120, 0.15); color: #4C7A78;">📊</div>
                <span class="insight-card-label">Category Concentration</span>
            </div>
            <div class="insight-card-content">
                <strong>${escapeHtml(topCat)}</strong> is your primary driver, taking <strong>${topCatPct}%</strong> (<strong>${formatCurrency(topCatAmt)}</strong>) of all recorded spend.
            </div>
        </div>

        <div class="insight-card-item">
            <div class="insight-card-item-header">
                <div class="insight-icon-box" style="background: rgba(162, 62, 50, 0.15); color: #A23E32;">🛡️</div>
                <span class="insight-card-label">Budget Governance</span>
            </div>
            <div class="insight-card-content">
                ${budgetInsightText}
            </div>
        </div>
    `;
}

window.renderFinancialInsights = renderFinancialInsights;

// Keyboard Shortcuts & Search Bar Responsive Adaptation
const isMacPlatform = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const kbdBadge = document.querySelector(".command-kbd");
if (kbdBadge) {
    kbdBadge.textContent = isMacPlatform ? "⌘K" : "Ctrl K";
}

function updateSearchPlaceholder() {
    if (!elements.filterSearch) return;
    if (window.innerWidth <= 600) {
        elements.filterSearch.placeholder = "Search expenses & incomes...";
    } else {
        elements.filterSearch.placeholder = isMacPlatform ? "Search expenses & incomes (Press / or ⌘K)..." : "Search expenses & incomes (Press / or Ctrl+K)...";
    }
}
window.addEventListener("resize", updateSearchPlaceholder);
updateSearchPlaceholder();

window.addEventListener("keydown", (e) => {
    const isK = e.key === 'k' || e.key === 'K' || e.code === 'KeyK';
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    if (isCmdOrCtrl && isK) {
        e.preventDefault();
        e.stopPropagation();
        if (elements.filterSearch) {
            elements.filterSearch.focus();
            elements.filterSearch.select();
        }
        return;
    }

    if (e.key === '/') {
        const activeEl = document.activeElement;
        const isEditing = activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.tagName === 'SELECT' ||
            activeEl.isContentEditable
        );

        if (!isEditing) {
            e.preventDefault();
            if (elements.filterSearch) {
                elements.filterSearch.focus();
                elements.filterSearch.select();
            }
            return;
        }
    }

    if (e.key === "Escape" && document.activeElement === elements.filterSearch) {
        if (elements.filterSearch.value) {
            elements.filterSearch.value = "";
            elements.filterSearch.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            elements.filterSearch.blur();
        }
    }
}, { capture: true });

// --- 2. BUDGET LOGIC ---
async function loadBudgets() {
    const usageBadge = document.getElementById("budgetUsageBadge");
    try {
        const budgets = await apiRequest(`/expenses/budget/status/user/${userId}`);
        cachedBudgets = Array.isArray(budgets) ? budgets : [];

        if (!cachedBudgets || cachedBudgets.length === 0) {
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
            if (budgetVsActualChart) { budgetVsActualChart.destroy(); budgetVsActualChart = null; }
            return;
        }

        // Overall usage across every budgeted category
        const totalLimit = cachedBudgets.reduce((acc, b) => acc + Number(b.limit || 0), 0);
        const totalSpent = cachedBudgets.reduce((acc, b) => acc + Number(b.spent || 0), 0);
        const overallPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

        if (usageBadge) {
            usageBadge.textContent = `${overallPct.toFixed(0)}% Used`;
            usageBadge.className = "status-badge badge-outflow";
        }

        if (elements.budgetList) {
            elements.budgetList.innerHTML = cachedBudgets.map(b => {
                const pct = Math.min(b.percentage || 0, 100);
                let barColor;
                if (b.percentage > 100) { barColor = 'var(--danger)'; }
                else if (b.percentage > 80) { barColor = 'var(--warning)'; }
                else { barColor = 'var(--primary)'; }

                const catColor = getCategoryColor(b.categoryName);
                const periodLabel = b.period ? b.period.toUpperCase() : 'MONTHLY';
                const startStr = b.startDate || '';
                const endStr   = b.endDate   || '';
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
                            <span style="font-size:13px; font-weight:800; color:${barColor}; margin-right:2px;">${(b.percentage || 0).toFixed(0)}%</span>
                            <button onclick="openEditBudget(${b.budgetId || 0}, ${b.categoryId || 0}, '${escapeHtml(b.categoryName).replace(/'/g, "\\'")}', ${b.limit || 0}, '${periodLabel}', '${startStr}', '${endStr}', ${b.intervalDays || 30})" class="btn-edit" title="Edit Budget Limit" style="height:28px; width:28px; padding:0; flex-shrink:0;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button onclick="deleteBudgetLimit(${b.budgetId || 0}, ${b.categoryId || 0}, event)" class="btn-delete" title="Delete Budget Limit" style="height:28px; width:28px; padding:0; flex-shrink:0;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>
                    <div class="budget-bar-track">
                        <div class="budget-bar-fill" style="width:${pct}%; background:${barColor};"></div>
                    </div>
                </div>`;
            }).join("");
        }

        renderBudgetVsActualChart(cachedBudgets);
        renderFinancialInsights(allExpenses);
    } catch (e) {
        console.error("Budget Error", e);
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

window.deleteBudgetLimit = async (budgetId, categoryId, event) => {
    if (!confirm("Are you sure you want to delete this budget limit?")) return;
    try {
        if (budgetId && budgetId > 0) {
            await apiRequest(`/expenses/budget/${budgetId}`, { method: "DELETE" });
        } else if (categoryId && categoryId > 0) {
            await apiRequest(`/expenses/budget/user/${userId}/category/${categoryId}`, { method: "DELETE" });
        }
        showToast("Budget limit deleted.", "success");
        loadBudgets();
    } catch (e) {
        showToast(e.message, "error");
        const btn = event?.target?.closest(".btn-delete");
        if (btn) {
            btn.classList.add("shake");
            setTimeout(() => btn.classList.remove("shake"), 400);
        }
    }
};


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
function renderPieChart(expenses) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const categoryTotals = {};
    expenses.forEach(exp => {
        const cat = exp.categoryName || 'Uncategorized';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
    });

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: ['#C79A3E', '#A23E32', '#4C7A78', '#5B8C5A', '#8B5E34', '#B06B5C'],
                borderWidth: 2,
                borderColor: document.body.getAttribute("data-theme") === "light" ? '#FCFBF6' : '#10120E'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-muted'),
                        font: { size: 13, family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
                        boxWidth: 12, padding: 14, usePointStyle: true
                    }
                }
            }
        }
    });
}

function renderTrendChart(expenses) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    const isLight = document.body.getAttribute("data-theme") === "light";
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
    const textColor = isLight ? '#6B6558' : '#A8A395';

    const dailyTotals = {};
    expenses.forEach(exp => {
        const date = exp.expenseDate;
        dailyTotals[date] = (dailyTotals[date] || 0) + exp.amount;
    });

    const { dates, values } = buildTrendSeries(dailyTotals);

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(formatTrendDate),
            datasets: [{
                label: 'Daily Spending',
                data: values,
                borderColor: '#C79A3E',
                backgroundColor: (context) => getTrendGradient(context.chart),
                fill: 'origin',
                tension: 0.35,
                cubicInterpolationMode: 'monotone',
                borderWidth: 3,
                pointRadius: dates.length > 31 ? 0 : 3,
                pointHoverRadius: 6,
                pointBackgroundColor: isLight ? '#FCFBF6' : '#C79A3E',
                pointBorderColor: '#A97F2E',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 7, maxRotation: 0 } },
                y: { beginAtZero: true, grace: '10%', grid: { color: gridColor }, ticks: { color: textColor, maxTicksLimit: 5, callback: value => formatCompactCurrency(value) } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { displayColors: false, callbacks: { label: context => ` ${formatCurrency(context.parsed.y)}` } }
            }
        }
    });
}

/**
 * Renders a horizontal 2-segment bar comparing total recurring (subscription)
 * spend against total one-time spend — answers "how much of my spending is
 * actually locked in vs. discretionary," which neither the category pie nor
 * the daily trend line can show, since both mix the two together.
 */
function renderRecurringSplitChart(expenses) {
    const canvas = document.getElementById('recurringSplitChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const isLight = document.body.getAttribute("data-theme") === "light";
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
    const textColor = isLight ? '#6B6558' : '#A8A395';

    if (recurringSplitChart) recurringSplitChart.destroy();
    if (!Array.isArray(expenses) || expenses.length === 0) return;

    let recurringTotal = 0;
    let oneTimeTotal = 0;
    expenses.forEach(exp => {
        const amt = Number(exp.amount || 0);
        const isRecurring = exp.recurring || exp.isRecurring;
        if (isRecurring) recurringTotal += amt; else oneTimeTotal += amt;
    });

    recurringSplitChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Recurring', 'One-Time'],
            datasets: [{
                data: [recurringTotal, oneTimeTotal],
                backgroundColor: ['#A23E32', '#C79A3E'],
                borderRadius: 6,
            }],
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: value => formatCompactCurrency(value) } },
                y: { grid: { display: false }, ticks: { color: textColor, font: { weight: '600' } } },
            },
            plugins: {
                legend: { display: false },
                tooltip: { displayColors: false, callbacks: { label: context => ` ${formatCurrency(context.parsed.x)}` } },
            },
        },
    });
}

/**
 * Renders a bar chart of total spend grouped by day of the week — a
 * behavioral insight none of the other charts surface: WHEN spending
 * happens, not just how much or on what. Reveals patterns like weekend
 * overspending that a category or time-trend view can't show on its own.
 */
function renderDayOfWeekChart(expenses) {
    const canvas = document.getElementById('dayOfWeekChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const isLight = document.body.getAttribute("data-theme") === "light";
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
    const textColor = isLight ? '#6B6558' : '#A8A395';
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (dayOfWeekChart) dayOfWeekChart.destroy();
    if (!Array.isArray(expenses) || expenses.length === 0) return;

    const totalsByDay = [0, 0, 0, 0, 0, 0, 0];
    expenses.forEach(exp => {
        const d = new Date(exp.date || exp.expenseDate);
        if (isNaN(d.getTime())) return;
        totalsByDay[d.getDay()] += Number(exp.amount || 0);
    });

    dayOfWeekChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dayLabels,
            datasets: [{
                data: totalsByDay,
                backgroundColor: '#4C7A78',
                borderRadius: 6,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor } },
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: value => formatCompactCurrency(value) } },
            },
            plugins: {
                legend: { display: false },
                tooltip: { displayColors: false, callbacks: { label: context => ` ${formatCurrency(context.parsed.y)}` } },
            },
        },
    });
}

/**
 * Renders a grouped bar chart comparing each budgeted category's limit
 * against what was actually spent — the one chart on this dashboard that
 * answers "am I on track," not just "where did money go." Bars for
 * categories currently over budget render in the danger color so overages
 * are visible at a glance without reading numbers.
 */
function renderBudgetVsActualChart(budgets) {
    const canvas = document.getElementById('budgetVsActualChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const isLight = document.body.getAttribute("data-theme") === "light";
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
    const textColor = isLight ? '#6B6558' : '#A8A395';

    if (budgetVsActualChart) budgetVsActualChart.destroy();

    if (!budgets || budgets.length === 0) {
        return; // Empty state is already handled by the budget list above this chart.
    }

    const labels = budgets.map(b => b.categoryName || 'Uncategorized');
    const limits = budgets.map(b => Number(b.limit || 0));
    const spent = budgets.map(b => Number(b.spent || 0));
    const overBudgetColors = budgets.map(b => (b.percentage > 100 ? '#C0392B' : '#C79A3E'));

    budgetVsActualChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Budget',
                    data: limits,
                    backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)',
                    borderRadius: 4,
                },
                {
                    label: 'Actual Spent',
                    data: spent,
                    backgroundColor: overBudgetColors,
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor } },
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: value => formatCompactCurrency(value) } },
            },
            plugins: {
                legend: { display: true, labels: { color: textColor, boxWidth: 12, padding: 12 } },
                tooltip: { callbacks: { label: context => ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } },
            },
        },
    });
}

function buildTrendSeries(dailyTotals) {
    const availableDates = Object.keys(dailyTotals).sort();
    if (!availableDates.length) return { dates: [], values: [] };

    const end = parseLocalDate(availableDates.at(-1));
    const earliest = parseLocalDate(availableDates[0]);
    // A compact 90-day window avoids an unreadable graph for long-lived accounts.
    const start = new Date(Math.max(earliest.getTime(), end.getTime() - 89 * 86400000));
    const dates = [];
    for (let date = start; date <= end; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)) {
        const key = toLocalDateKey(date);
        dates.push(key);
    }
    return { dates, values: dates.map(date => dailyTotals[date] || 0) };
}

function parseLocalDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTrendDate(value) {
    return parseLocalDate(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatCompactCurrency(value) {
    return typeof formatGlobalCompactCurrency === "function" ? formatGlobalCompactCurrency(value) : `${typeof getCurrencySymbol === "function" ? getCurrencySymbol() : "$"}${Number(value || 0).toFixed(0)}`;
}

function getTrendGradient(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return 'rgba(199, 154, 62, 0.22)';
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, 'rgba(199, 154, 62, 0.35)');
    gradient.addColorStop(0.72, 'rgba(199, 154, 62, 0.08)');
    gradient.addColorStop(1, 'rgba(199, 154, 62, 0.01)');
    return gradient;
}


// --- 4. FILTERING (With Validation & Quick Presets) ---
function applyFilters() {
    let filtered = [...allExpenses];
    const search = elements.filterSearch.value.toLowerCase().trim();
    const startDate = elements.filterStartDate ? elements.filterStartDate.value : "";
    const endDate = elements.filterEndDate ? elements.filterEndDate.value : "";

    // Date Range Validation
    if (startDate && endDate) {
        if (startDate > endDate) {
            showToast("Start date cannot be after end date.", "error");
            elements.filterEndDate.value = "";
            return;
        }
    }

    // 1. Search
    if (search) filtered = filtered.filter(e => (e.description && e.description.toLowerCase().includes(search)) || (e.categoryName && e.categoryName.toLowerCase().includes(search)));

    // 2. Category
    if (elements.filterCategory.value !== 'all') filtered = filtered.filter(e => e.categoryName === elements.filterCategory.value);

    // 3. Date Range
    if (startDate || endDate) {
        if (startDate) filtered = filtered.filter(e => (e.expenseDate || '').split('T')[0] >= startDate);
        if (endDate) filtered = filtered.filter(e => (e.expenseDate || '').split('T')[0] <= endDate);
    } else {
        if (elements.filterMonth.value !== 'all') filtered = filtered.filter(e => parseLocalDate(e.expenseDate).getMonth() === parseInt(elements.filterMonth.value));
        if (elements.filterYear.value !== 'all') filtered = filtered.filter(e => parseLocalDate(e.expenseDate).getFullYear() === parseInt(elements.filterYear.value));
    }

    // 4. Sort with Timestamp Tie-Breaking (Ensures newly added expenses stay on top)
    const sort = elements.filterSort.value;
    filtered.sort((a, b) => {
        if (sort === 'date-desc') {
            const dDiff = new Date(b.expenseDate) - new Date(a.expenseDate);
            if (dDiff !== 0) return dDiff;
            if (b.createdAt && a.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
            return (b.id || 0) - (a.id || 0);
        }
        if (sort === 'date-asc') {
            const dDiff = new Date(a.expenseDate) - new Date(b.expenseDate);
            if (dDiff !== 0) return dDiff;
            if (a.createdAt && b.createdAt) return new Date(a.createdAt) - new Date(b.createdAt);
            return (a.id || 0) - (b.id || 0);
        }
        if (sort === 'amount-desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
        if (sort === 'amount-asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
        return 0;
    });

    updateStats(filtered);
    renderPieChart(filtered);
    renderList(filtered);
    renderTrendChart(filtered);
    renderRecurringSplitChart(filtered);
    renderDayOfWeekChart(filtered);
    renderFinancialInsights(filtered);
}

[elements.filterSort, elements.filterCategory, elements.filterStartDate, elements.filterEndDate, elements.filterMonth, elements.filterYear]
    .filter(Boolean)
    .forEach(el => el.addEventListener('input', () => {
        if (el === elements.filterStartDate || el === elements.filterEndDate) {
            document.querySelectorAll("#datePresetsWrap .preset-btn").forEach(b => b.classList.remove("active"));
        }
        if (el === elements.filterCategory) {
            syncCategoryPillSelection(elements.filterCategory.value);
        }
        applyFilters();
    }));

// Quick 1-tap Date Presets (Mobile & Desktop)
document.querySelectorAll("#datePresetsWrap .preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("#datePresetsWrap .preset-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const preset = btn.getAttribute("data-preset");
        const now = new Date();
        const todayStr = getLocalDateString(now);

        if (preset === "all") {
            if (elements.filterStartDate) elements.filterStartDate.value = "";
            if (elements.filterEndDate) elements.filterEndDate.value = "";
        } else if (preset === "today") {
            if (elements.filterStartDate) elements.filterStartDate.value = todayStr;
            if (elements.filterEndDate) elements.filterEndDate.value = todayStr;
        } else if (preset === "month") {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            if (elements.filterStartDate) elements.filterStartDate.value = getLocalDateString(firstDay);
            if (elements.filterEndDate) elements.filterEndDate.value = todayStr;
        } else if (preset === "last30") {
            const past30 = new Date(now.getTime() - 30 * 86400000);
            if (elements.filterStartDate) elements.filterStartDate.value = getLocalDateString(past30);
            if (elements.filterEndDate) elements.filterEndDate.value = todayStr;
        }
        applyFilters();
    });
});

/**
 * Delays calling `fn` until `delay` ms have passed since the last call —
 * standard debounce so a rapid sequence of events (like keystrokes) only
 * triggers the expensive work once, after the user pauses.
 */
function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

elements.filterSearch.addEventListener('input', debounce(() => {
    applyFilters();
    if (typeof applyIncomeFilters === 'function') {
        applyIncomeFilters();
    renderFinancialInsights(allExpenses);
    }
}, 250));

document.getElementById("resetFiltersBtn")?.addEventListener("click", () => {
    elements.filterSearch.value = "";
    if (elements.filterStartDate) elements.filterStartDate.value = "";
    if (elements.filterEndDate) elements.filterEndDate.value = "";
    document.querySelectorAll("#datePresetsWrap .preset-btn").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-preset") === "all");
    });
    elements.filterMonth.value = "all";
    elements.filterYear.value = "all";
    elements.filterCategory.value = "all";
    elements.filterSort.value = "date-desc";
    syncCategoryPillSelection("all");
    applyFilters();
});


// --- 5. UI RENDERING HELPERS & NUMBER COUNT ANIMATION ---
function animateNumber(el, target, isCurrency = false, showSign = false) {
    if (!el) return;
    const duration = 850;
    const startTime = performance.now();
    const startVal = parseFloat(el.getAttribute('data-val') || 0);
    el.setAttribute('data-val', target);

    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const easeOutBack = 1 + 2.70158 * Math.pow(progress - 1, 3) + 1.70158 * Math.pow(progress - 1, 2);
        const current = startVal + (target - startVal) * Math.min(Math.max(easeOutBack, 0), 1);
        const sign = showSign ? (current < 0 ? "-" : "+") : "";
        el.textContent = isCurrency ? `${sign}${formatCurrency(Math.abs(current))}` : Math.round(current);
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            const finalSign = showSign ? (target < 0 ? "-" : "+") : "";
            el.textContent = isCurrency ? `${finalSign}${formatCurrency(Math.abs(target))}` : target;
        }
    }
    requestAnimationFrame(step);
}

function animatePercent(el, target) {
    if (!el) return;
    const duration = 850;
    const startTime = performance.now();
    const startVal = parseFloat(el.getAttribute('data-val') || 0);
    el.setAttribute('data-val', target);

    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = startVal + (target - startVal) * easeOut;
        el.textContent = `${current.toFixed(1)}%`;
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = `${target.toFixed(1)}%`;
        }
    }
    requestAnimationFrame(step);
}

function celebrateSuccess(x, y) {
    try {
        const count = 28;
        const colors = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899", "#34D399", "#60A5FA"];
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.left = "0";
        container.style.top = "0";
        container.style.width = "100vw";
        container.style.height = "100vh";
        container.style.pointerEvents = "none";
        container.style.zIndex = "999999";
        document.body.appendChild(container);

        const spawnX = typeof x === "number" && !isNaN(x) && x > 0 ? x : window.innerWidth / 2;
        const spawnY = typeof y === "number" && !isNaN(y) && y > 0 ? y : window.innerHeight / 2;

        for (let i = 0; i < count; i++) {
            const p = document.createElement("div");
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.floor(Math.random() * 8) + 6;
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 180 + 70;
            const destX = Math.cos(angle) * velocity;
            const destY = Math.sin(angle) * velocity + 45;
            const rotate = Math.random() * 720 - 360;

            p.style.position = "absolute";
            p.style.left = `${spawnX}px`;
            p.style.top = `${spawnY}px`;
            p.style.width = `${size}px`;
            p.style.height = `${size * (Math.random() > 0.5 ? 1 : 1.5)}px`;
            p.style.backgroundColor = color;
            p.style.borderRadius = Math.random() > 0.35 ? "2px" : "50%";
            p.style.opacity = "1";
            p.style.transition = "transform 0.85s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.85s ease-out";
            container.appendChild(p);

            requestAnimationFrame(() => {
                p.style.transform = `translate(${destX}px, ${destY}px) rotate(${rotate}deg) scale(${Math.random() * 0.4 + 0.6})`;
                p.style.opacity = "0";
            });
        }

        setTimeout(() => container.remove(), 950);
    } catch (e) {}
}

function updateStats(expenses) {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    animateNumber(elements.totalAmount, total, true);
    // Not animateNumber() here: it unconditionally writes a bare number
    // (e.g. "5") to the element's textContent, which would clobber the
    // "N transactions recorded" phrasing this element actually shows.
    // elements.expenseCount also pointed at a nonexistent "expenseCount" id
    // until now (the real element is #expenseCountText) — so before this
    // fix, this line silently did nothing at all on every filter change,
    // and the count only ever reflected whatever it was on initial load.
    if (elements.expenseCount) {
        const count = expenses.length;
        elements.expenseCount.textContent = `${count} transaction${count === 1 ? '' : 's'} recorded`;
    }
}

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
                <span style="font-size:18px;">${getCategoryEmoji(catName)}</span>
            </div>
            <div class="expense-info" style="flex:1; min-width:0;">
                <h4 class="expense-title">${escapeHtml(exp.description || "")}</h4>
                <div class="expense-meta" style="display:flex; align-items:center; gap:8px; margin-top:4px; flex-wrap:wrap;">
                    <span>${formatDate(exp.expenseDate)}</span>
                    <span class="cat-chip" style="background:${catColor.bg}; color:${catColor.color}; border:1px solid ${catColor.color}30;">${escapeHtml(catName)}</span>
                    ${isRecurring ? '<span style="font-family:var(--font-mono); font-size:9px; letter-spacing:0.08em; font-weight:600; color:var(--accent); background:rgba(162,62,50,0.08); padding:2px 8px; border-radius:3px; border:1px solid rgba(162,62,50,0.35);">⟳ RECURRING</span>' : ''}
                </div>
            </div>
            <div class="expense-actions-col" style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                <div class="expense-amount" style="font-family:var(--font-mono); font-variant-numeric:tabular-nums; color:var(--text-main); font-size:15px; font-weight:600;">${formatCurrency(exp.amount)}</div>
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

function getCategoryEmoji(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('food') || n.includes('dining') || n.includes('restaurant')) return '🍔';
    if (n.includes('transport') || n.includes('travel') || n.includes('uber')) return '🚗';
    if (n.includes('shop') || n.includes('cloth') || n.includes('amazon')) return '🛍️';
    if (n.includes('util') || n.includes('electric') || n.includes('water') || n.includes('bill')) return '⚡';
    if (n.includes('entertain') || n.includes('movie') || n.includes('netflix')) return '🎬';
    if (n.includes('health') || n.includes('medical') || n.includes('gym')) return '💊';
    if (n.includes('edu') || n.includes('course') || n.includes('book')) return '📚';
    if (n.includes('subscribe') || n.includes('saas') || n.includes('software')) return '💻';
    if (n.includes('grocer') || n.includes('market') || n.includes('super')) return '🛒';
    return '💳';
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
        if (id) {
            await apiRequest(`/expenses/${id}/user/${userId}`, { method: "PUT", body: JSON.stringify(expenseData) });
            showToast("Expense updated.", "success");
        } else if (isRecurring) {
            await apiRequest(`/expenses/recurring/user/${userId}`, { method: "POST", body: JSON.stringify(expenseData) });
            showToast("Recurring expense created.", "success");
        } else {
            await apiRequest(`/expenses/user/${userId}`, { method: "POST", body: JSON.stringify(expenseData) });
            celebrateSuccess(e.clientX, e.clientY);
            showToast("Expense added.", "success");
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
    if (!confirm("Delete this expense?")) return;
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
    const name = prompt("Enter new category name:");
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
        listEl.innerHTML = `<p style="font-size:13px; color:var(--text-muted); padding:8px 0;">You haven't created any custom categories yet.</p>`;
        return;
    }

    listEl.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">Checking usage...</p>`;

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
            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--input-bg); border:1px solid var(--border); border-radius:10px;">
                <span style="font-size:14px; color:var(--text-main);">${escapeHtml(cat.name)}</span>
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
            if (!confirm(`Delete category "${catName}"? This can't be undone.`)) return;
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

function updateChartsTheme() {
    const isLight = document.body.getAttribute("data-theme") === "light";
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
    const textColor = isLight ? '#6B6558' : '#A8A395';
    const borderColor = isLight ? '#FCFBF6' : '#10120E';

    if (pieChart) {
        if (pieChart.data?.datasets?.[0]) {
            pieChart.data.datasets[0].borderColor = borderColor;
        }
        if (pieChart.options?.plugins?.legend?.labels) {
            pieChart.options.plugins.legend.labels.color = textColor;
        }
        pieChart.update('none');
    }

    if (trendChart) {
        if (trendChart.options?.scales?.x?.ticks) trendChart.options.scales.x.ticks.color = textColor;
        if (trendChart.options?.scales?.y?.ticks) trendChart.options.scales.y.ticks.color = textColor;
        if (trendChart.options?.scales?.y?.grid) trendChart.options.scales.y.grid.color = gridColor;
        if (trendChart.data?.datasets?.[0]) {
            trendChart.data.datasets[0].pointBackgroundColor = isLight ? '#FCFBF6' : '#C79A3E';
        }
        trendChart.update('none');
    }

    if (recurringSplitChart) {
        if (recurringSplitChart.options?.scales?.x?.ticks) recurringSplitChart.options.scales.x.ticks.color = textColor;
        if (recurringSplitChart.options?.scales?.x?.grid) recurringSplitChart.options.scales.x.grid.color = gridColor;
        if (recurringSplitChart.options?.scales?.y?.ticks) recurringSplitChart.options.scales.y.ticks.color = textColor;
        recurringSplitChart.update('none');
    }

    if (dayOfWeekChart) {
        if (dayOfWeekChart.options?.scales?.x?.ticks) dayOfWeekChart.options.scales.x.ticks.color = textColor;
        if (dayOfWeekChart.options?.scales?.y?.ticks) dayOfWeekChart.options.scales.y.ticks.color = textColor;
        if (dayOfWeekChart.options?.scales?.y?.grid) dayOfWeekChart.options.scales.y.grid.color = gridColor;
        dayOfWeekChart.update('none');
    }

    if (budgetVsActualChart) {
        if (budgetVsActualChart.data?.datasets?.[0]) {
            budgetVsActualChart.data.datasets[0].backgroundColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)';
        }
        if (budgetVsActualChart.options?.scales?.x?.ticks) budgetVsActualChart.options.scales.x.ticks.color = textColor;
        if (budgetVsActualChart.options?.scales?.y?.ticks) budgetVsActualChart.options.scales.y.ticks.color = textColor;
        if (budgetVsActualChart.options?.scales?.y?.grid) budgetVsActualChart.options.scales.y.grid.color = gridColor;
        if (budgetVsActualChart.options?.plugins?.legend?.labels) budgetVsActualChart.options.plugins.legend.labels.color = textColor;
        budgetVsActualChart.update('none');
    }
}
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
    const activeCurr = currCode || (typeof getSelectedCurrency === "function" ? getSelectedCurrency() : "USD");
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
    const activeCurr = typeof getSelectedCurrency === "function" ? getSelectedCurrency() : "USD";
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
            apiRequest(`/users/${userId}/currency`, { method: "PUT", body: JSON.stringify({ currency: newCurr }) }).catch(err => console.warn("Failed to persist currency preference:", err));
            showToast(`Currency updated to ${newCurr} (${getCurrencySymbol()})`, "success");
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
        updateProMetrics(allExpenses);
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
    elements.profileMenu.classList.toggle("active", isOpen);
    elements.profileTrigger.setAttribute("aria-expanded", String(isOpen));
}

elements.profileTrigger.addEventListener("click", (e) => { e.stopPropagation(); toggleProfileMenu(); });
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
document.getElementById("logoutBtn").addEventListener("click", () => { localStorage.clear(); window.location.href = "index.html"; });

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
                    emailDiv.style.cssText = "padding:12px 20px 8px; font-size:12px; color:var(--text-muted); border-bottom:1px solid var(--border); word-break:break-all;";
                    emailDiv.textContent = profile.email;
                    profileMenu.insertBefore(emailDiv, profileMenu.firstChild);
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
    const list = (window.allExpenses && window.allExpenses.length > 0) ? window.allExpenses : (Array.isArray(allExpenses) ? allExpenses : []);
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
    const list = (window.allIncomes && window.allIncomes.length > 0) ? window.allIncomes : (Array.isArray(allIncomes) ? allIncomes : []);
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

// Fetching as a blob keeps the token out of URL history and server logs.
async function downloadAuthenticated(url, fallbackFilename, loadingMessage, fallbackFn = null) {
    showToast(loadingMessage, "info");
    try {
        const currentToken = localStorage.getItem("token") || authToken || token;
        const activeCurr = (typeof getSelectedCurrency === "function" ? getSelectedCurrency() : (localStorage.getItem("userCurrency") || "INR"));
        const sep = url.includes("?") ? "&" : "?";
        const finalUrl = `${url}${sep}currency=${encodeURIComponent(activeCurr)}`;
        
        const reqHeaders = {};
        if (currentToken) {
            reqHeaders["Authorization"] = `Bearer ${currentToken}`;
        }
        if (activeCurr) {
            reqHeaders["X-Currency"] = activeCurr;
        }

        const res = await fetch(finalUrl, { headers: reqHeaders });
        if (!res.ok) {
            if (res.status === 401) {
                throw new Error("Authentication session expired. Please log in again.");
            }
            throw new Error(`Export server responded with status ${res.status}`);
        }
        const disposition = res.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match ? match[1] : fallbackFilename;

        const blob = await res.blob();
        triggerFileDownload(blob, filename);
        showToast(`${filename} downloaded successfully.`, "success");
    } catch (err) {
        console.warn("downloadAuthenticated backend call failed, attempting fallback:", err);
        if (typeof fallbackFn === "function") {
            try {
                fallbackFn();
                showToast(`${fallbackFilename} generated and downloaded.`, "success");
                return;
            } catch (fbErr) {
                console.error("Client fallback generation failed:", fbErr);
            }
        }
        showToast(err.message || "Export failed", "error");
    }
}

document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
    downloadAuthenticated(
        `${API_BASE_URL}/expenses/user/${userId}/export/excel`,
        "expenses.xlsx",
        "Generating Expenses Excel Workbook...",
        () => exportExpensesClientSideExcel()
    );
});

document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/expenses/user/${userId}/export/csv`, "expenses.csv", "Exporting CSV...");
});

document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/expenses/user/${userId}/export/json`, "expenses.json", "Exporting JSON...");
});

document.getElementById("exportPdfBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/expenses/user/${userId}/export/pdf`, "expenses.pdf", "Generating PDF report...");
});

const importBtn = document.getElementById("importBtn");
const importFileInput = document.getElementById("importFileInput");

importBtn?.addEventListener("click", () => importFileInput?.click());

importFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const fname = file.name.toLowerCase();
    let endpoint = `/expenses/user/${userId}/import/csv`;
    if (fname.endsWith(".json")) {
        endpoint = `/expenses/user/${userId}/import/json`;
    } else if (fname.endsWith(".xlsx") || fname.endsWith(".xls")) {
        endpoint = `/expenses/user/${userId}/import/excel`;
    }

    try {
        setLoading(true, "Importing file...");
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token") || token}`
            },
            body: formData
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || "Import failed");
        }

        const data = await res.json();
        if (data.failedRows > 0) {
            showToast(`${data.imported} imported, ${data.failedRows} row(s) skipped — see console for details.`, data.imported > 0 ? "info" : "error");
            console.warn("Import row errors:", data.errors);
        } else {
            showToast(data.message || "Expenses imported successfully!", "success");
        }
        if (typeof window.clearApiCache === "function") window.clearApiCache();
        try { localStorage.removeItem(getCacheKey()); } catch (_) {}
        // Must be awaited: loadDashboard is async, and without awaiting it here
        // the `finally` block below runs setLoading(false) immediately — hiding
        // the loading indicator before the actual refetch/re-render finishes,
        // which looked like the UI hadn't refreshed at all.
        await loadDashboard(true);
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        setLoading(false);
        importFileInput.value = "";
    }
});

// --- 7. SUBSCRIPTION MANAGER (View, Edit, Delete) ---

// Open Modal
elements.manageSubsBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    toggleProfileMenu(false);
    openModal(elements.subsModal);
    loadSubscriptions();
});

// Also handle the "Manage Subscriptions →" link in the metrics card
document.getElementById("manageSubsLink")?.addEventListener("click", async (e) => {
    e.preventDefault();
    openModal(elements.subsModal);
    loadSubscriptions();
});

// Close Modal
elements.closeSubsBtn?.addEventListener("click", () => {
    closeModal(elements.subsModal);
});
elements.subsModal?.addEventListener("click", (e) => {
    if (e.target === elements.subsModal) closeModal(elements.subsModal);
});

let currentSubsModalTab = 'expenses';
let cachedSubsExpenses = [];
let cachedSubsIncomes = [];

async function loadSubscriptions() {
    if (elements.subsList) {
        elements.subsList.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px 0;">Loading active recurring commitments & inflows...</p>';
    }

    try {
        const activeExpenses = (window.allExpenses && window.allExpenses.length > 0) ? window.allExpenses : (allExpenses || []);
        const activeIncomes = (window.allIncomes && window.allIncomes.length > 0) ? window.allIncomes : (allIncomes || []);

        const isFileOrOffline = window.location.protocol === "file:" || !navigator.onLine || window.location.search.includes("test_mock_auth") || !userId;
        const [subs, incs, savs] = await Promise.all([
            (activeExpenses && activeExpenses.some(e => !!(e.isRecurring || e.recurring)))
                ? Promise.resolve(activeExpenses.filter(e => !!(e.isRecurring || e.recurring)))
                : (isFileOrOffline ? Promise.resolve([]) : apiRequest(`/expenses/recurring/user/${userId}`).catch(err => {
                    console.warn("Failed to load recurring expenses:", err);
                    return [];
                })),
            (activeIncomes && activeIncomes.length > 0)
                ? Promise.resolve(activeIncomes)
                : (isFileOrOffline ? Promise.resolve([]) : apiRequest(`/incomes/user/${userId}`).catch(err => {
                    console.warn("Failed to load incomes for recurring modal:", err);
                    return [];
                })),
            (allSavingsGoals && allSavingsGoals.length > 0)
                ? Promise.resolve(allSavingsGoals)
                : (isFileOrOffline ? Promise.resolve([]) : apiRequest(`/savings/goals/user/${userId}`).catch(err => {
                    console.warn("Failed to load savings goals for recurring modal:", err);
                    return [];
                }))
        ]);

        cachedSubsExpenses = Array.isArray(subs) ? subs : [];
        cachedSubsIncomes = (Array.isArray(incs) ? incs : []).filter(i => !!(i.isRecurring || i.recurring));
        cachedSubsSavings = (Array.isArray(savs) ? savs : []).filter(s => !!(s.isRecurring || (s.recurringAmount != null && Number(s.recurringAmount) > 0)));

        const monthlyOutflow = cachedSubsExpenses.reduce((acc, sub) => {
            const amt = Number(sub.amount || 0);
            const freq = (sub.frequency || "MONTHLY").toUpperCase();
            if (freq === "WEEKLY") return acc + (amt * 52 / 12);
            if (freq === "DAILY") return acc + (amt * 365 / 12);
            return acc + amt;
        }, 0);

        const monthlyInflow = cachedSubsIncomes.reduce((acc, inc) => {
            const amt = Number(inc.amount || 0);
            const freq = (inc.frequency || "MONTHLY").toUpperCase();
            if (freq === "WEEKLY") return acc + (amt * 52 / 12);
            if (freq === "DAILY") return acc + (amt * 365 / 12);
            return acc + amt;
        }, 0);

        const monthlySavings = cachedSubsSavings.reduce((acc, sav) => {
            const amt = Number(sav.recurringAmount || 0);
            const freq = (sav.frequency || "MONTHLY").toUpperCase();
            if (freq === "WEEKLY") return acc + (amt * 52 / 12);
            if (freq === "DAILY") return acc + (amt * 365 / 12);
            if (freq === "BI_WEEKLY" || freq === "BIWEEKLY") return acc + (amt * 26 / 12);
            if (freq === "YEARLY") return acc + (amt / 12);
            if (freq === "CUSTOM" && sav.intervalDays && sav.intervalDays > 0) return acc + (amt * 30 / sav.intervalDays);
            return acc + amt;
        }, 0);

        const netRecurring = monthlyInflow - (monthlyOutflow + monthlySavings);

        const summaryEl = document.getElementById("subsCashflowSummary");
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div style="background:var(--input-bg); border:1px solid var(--border); border-radius:10px; padding:10px 12px; text-align:center;">
                    <div style="font-size:10.5px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); font-weight:700;">Recurring Inflows</div>
                    <div style="font-size:14.5px; font-weight:700; color:#10B981; margin-top:2px; font-family:var(--font-mono); font-variant-numeric:tabular-nums;">+${formatCurrency(monthlyInflow)}<span style="font-size:10.5px; font-weight:500; opacity:0.8;">/mo</span></div>
                </div>
                <div style="background:var(--input-bg); border:1px solid var(--border); border-radius:10px; padding:10px 12px; text-align:center;">
                    <div style="font-size:10.5px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); font-weight:700;">Recurring Subscriptions</div>
                    <div style="font-size:14.5px; font-weight:700; color:var(--accent); margin-top:2px; font-family:var(--font-mono); font-variant-numeric:tabular-nums;">-${formatCurrency(monthlyOutflow)}<span style="font-size:10.5px; font-weight:500; opacity:0.8;">/mo</span></div>
                </div>
                <div style="background:var(--input-bg); border:1px solid var(--border); border-radius:10px; padding:10px 12px; text-align:center;">
                    <div style="font-size:10.5px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); font-weight:700;">Chits & Recurring Savings</div>
                    <div style="font-size:14.5px; font-weight:700; color:#F59E0B; margin-top:2px; font-family:var(--font-mono); font-variant-numeric:tabular-nums;">${formatCurrency(monthlySavings)}<span style="font-size:10.5px; font-weight:500; opacity:0.8;">/mo</span></div>
                </div>
                <div style="background:var(--input-bg); border:1px solid var(--border); border-radius:10px; padding:10px 12px; text-align:center;">
                    <div style="font-size:10.5px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); font-weight:700;">Net Autonomy Flow</div>
                    <div style="font-size:14.5px; font-weight:700; color:${netRecurring >= 0 ? '#10B981' : 'var(--danger)'}; margin-top:2px; font-family:var(--font-mono); font-variant-numeric:tabular-nums;">${netRecurring >= 0 ? '+' : ''}${formatCurrency(netRecurring)}<span style="font-size:10.5px; font-weight:500; opacity:0.8;">/mo</span></div>
                </div>
            `;
        }

        renderSubsModalContent();

    } catch (error) {
        if (elements.subsList) {
            elements.subsList.innerHTML = `<p style="color:var(--danger)">Error: ${error.message}</p>`;
        }
    }
}

let cachedSubsSavings = [];
function switchSubsModalTab(tab) {
    currentSubsModalTab = tab;
    const expBtn = document.getElementById("subsTabExpensesBtn");
    const incBtn = document.getElementById("subsTabIncomesBtn");
    const savBtn = document.getElementById("subsTabSavingsBtn");
    if (expBtn) expBtn.classList.toggle("active", tab === 'expenses');
    if (incBtn) {
        incBtn.classList.toggle("active", tab === 'incomes');
        if (tab === 'incomes') incBtn.classList.add("emerald");
        else incBtn.classList.remove("emerald");
    }
    if (savBtn) savBtn.classList.toggle("active", tab === 'savings');
    renderSubsModalContent();
}
window.switchSubsModalTab = switchSubsModalTab;

function renderSubsModalContent() {
    if (!elements.subsList) return;

    if (currentSubsModalTab === 'expenses') {
        if (!cachedSubsExpenses || cachedSubsExpenses.length === 0) {
            elements.subsList.innerHTML = `
                <div class="empty-state-compact" style="text-align:center; padding:28px 16px; color:var(--text-muted);">
                    <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">No active subscription expenses found</p>
                    <span style="font-size:12px;">Mark expenses as <strong>Recurring</strong> to monitor renewals, software SaaS, and recurring bills.</span>
                </div>`;
            return;
        }

        elements.subsList.innerHTML = cachedSubsExpenses.map(sub => {
            const freqLabel = formatFrequency(sub);
            const freqColor = 'var(--text-muted)';
            return `
            <div class="sub-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px 12px; border-bottom:1px solid var(--border); margin-bottom:8px; border-radius:12px; background:var(--card-bg); transition:background 0.2s;" onmouseenter="this.style.background='var(--input-bg)'" onmouseleave="this.style.background='var(--card-bg)'">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; color:var(--text-main); margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(sub.description)}</div>
                    <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                        <span>Next: <span style="color:var(--accent); font-weight:600;">${formatDate(sub.nextDueDate)}</span></span>
                        <span style="opacity:0.4;">•</span>
                        <span style="font-weight:600; color:var(--text-main);">${formatCurrency(sub.amount)}</span>
                        <span style="opacity:0.4;">•</span>
                        <span style="background:rgba(var(--ink-rgb),0.06); color:${freqColor}; border:1px solid var(--border); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px; letter-spacing:0.04em; text-transform:uppercase;">${freqLabel}</span>
                        <span style="opacity:0.7; font-size:11px; color:var(--text-muted);">${escapeHtml(sub.categoryName || 'General')}</span>
                    </div>
                </div>
                <div style="display:flex; gap:10px; flex-shrink:0; margin-left:12px;">
                    <button onclick="openEditSubscription(${sub.id}, '${escapeHtml(sub.description).replace(/'/g, "\\'")}', '${sub.amount}', '${sub.nextDueDate}', '${sub.frequency || 'MONTHLY'}', ${sub.intervalDays || 1})" class="btn-edit" title="Edit Subscription" style="height:32px; width:32px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="cancelSubscription(${sub.id}, event)" class="btn-delete" title="Cancel Subscription" style="height:32px; width:32px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>`;
        }).join("");

    } else if (currentSubsModalTab === 'savings') {
        if (!cachedSubsSavings || cachedSubsSavings.length === 0) {
            elements.subsList.innerHTML = `
                <div class="empty-state-compact" style="text-align:center; padding:28px 16px; color:var(--text-muted);">
                    <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">No recurring chit funds or savings plans</p>
                    <span style="font-size:12px;">Create a savings goal and check <strong>Recurring Contribution (Chit Fund / RD / SIP)</strong> to schedule automated contributions.</span>
                </div>`;
            return;
        }

        elements.subsList.innerHTML = cachedSubsSavings.map(goal => {
            const current = Number(goal.currentAmount || 0);
            const target = Number(goal.targetAmount || 0);
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            return `
            <div class="sub-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px 12px; border-bottom:1px solid var(--border); margin-bottom:8px; border-radius:12px; background:var(--card-bg); transition:background 0.2s;" onmouseenter="this.style.background='var(--input-bg)'" onmouseleave="this.style.background='var(--card-bg)'">
                <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                    <div style="width:36px; height:36px; border-radius:10px; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.25); display:inline-flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0;">
                        🪙
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:700; color:var(--text-main); margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(goal.name || "Chit / Savings Goal")}
                        </div>
                        <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; flex-wrap:gap; gap:6px;">
                            <span>Installment: <span style="color:#F59E0B; font-weight:700;">${formatCurrency(goal.recurringAmount || 0)}</span></span>
                            <span style="opacity:0.4;">•</span>
                            <span style="background:rgba(245,158,11,0.12); color:#F59E0B; border:1px solid rgba(245,158,11,0.3); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px; letter-spacing:0.04em; text-transform:uppercase;">
                                🔁 ${escapeHtml(formatGoalFrequency(goal.frequency, goal.intervalDays))}
                            </span>
                            ${goal.nextDueDate ? `<span style="opacity:0.4;">•</span><span>Next: <strong style="color:var(--text-main);">${formatDate(goal.nextDueDate)}</strong></span>` : ''}
                        </div>
                        <div style="margin-top:6px; font-size:11px; color:var(--text-muted);">
                            Accumulated ${formatCurrency(current)} of ${formatCurrency(target)} (${pct}%)
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:10px; flex-shrink:0; margin-left:12px;">
                    <button onclick="closeModal(elements.subsModal); document.getElementById('depositGoalId').value = '${goal.id}'; const dt = document.getElementById('savingsDepositTitle'); if(dt) dt.textContent='Contribute to ${escapeHtml(goal.name)}'; openModal(document.getElementById('savingsDepositModal'));" class="btn-primary btn-small" style="background:#F59E0B; border-color:#F59E0B; font-size:12px; padding:5px 12px; cursor:pointer;" title="Contribute Installment">
                        + Deposit
                    </button>
                </div>
            </div>`;
        }).join("");

    } else {
        // 'incomes' tab
        if (!cachedSubsIncomes || cachedSubsIncomes.length === 0) {
            elements.subsList.innerHTML = `
                <div class="empty-state-compact" style="text-align:center; padding:28px 16px; color:var(--text-muted);">
                    <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">No recurring income streams found</p>
                    <span style="font-size:12px;">Mark salary, client retainers, or rental payments as <strong>Recurring</strong> in the Cash Inflow section to view them here.</span>
                </div>`;
            return;
        }

        elements.subsList.innerHTML = cachedSubsIncomes.map(inc => {
            const freqLabel = formatIncomeFrequency(inc.frequency, inc.intervalDays);
            return `
            <div class="sub-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px 12px; border-bottom:1px solid var(--border); margin-bottom:8px; border-radius:12px; background:var(--card-bg); transition:background 0.2s;" onmouseenter="this.style.background='var(--input-bg)'" onmouseleave="this.style.background='var(--card-bg)'">
                <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                    <div style="width:36px; height:36px; border-radius:10px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); display:inline-flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0;">
                        ${getIncomeSourceEmoji(inc.source)}
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:700; color:var(--text-main); margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(inc.source || "Income")}
                            ${inc.description ? `<span style="font-weight:400; font-size:12px; color:var(--text-muted); margin-left:6px;">— ${escapeHtml(inc.description)}</span>` : ''}
                        </div>
                        <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                            <span>Logged: <span style="color:#10B981; font-weight:600;">${inc.incomeDate || '—'}</span></span>
                            <span style="opacity:0.4;">•</span>
                            <span style="font-weight:600; color:#10B981;">+${formatCurrency(inc.amount)}</span>
                            <span style="opacity:0.4;">•</span>
                            <span style="background:rgba(16,185,129,0.12); color:#10B981; border:1px solid rgba(16,185,129,0.3); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px; letter-spacing:0.04em; text-transform:uppercase;">
                                ⟳ ${freqLabel}
                            </span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:10px; flex-shrink:0; margin-left:12px;">
                    <button onclick="editIncomeFromSubsModal(${inc.id})" class="btn-edit" title="Edit Recurring Income" style="height:32px; width:32px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="deleteIncomeFromSubsModal(${inc.id})" class="btn-delete" title="Delete Income" style="height:32px; width:32px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>`;
        }).join("");
    }
}

window.editIncomeFromSubsModal = (incId) => {
    closeModal(elements.subsModal);
    const inc = (allIncomes || []).find(i => String(i.id) === String(incId));
    if (!inc) return;
    const modal = document.getElementById("incomeModal");
    if (!modal) return;
    document.getElementById("incomeId").value = inc.id || "";
    document.getElementById("incomeSource").value = inc.source || "";
    document.getElementById("incomeAmount").value = inc.amount || "";
    document.getElementById("incomeDate").value = inc.incomeDate || new Date().toISOString().split("T")[0];
    document.getElementById("incomeDesc").value = inc.description || "";

    const isRec = !!(inc.isRecurring || inc.recurring);
    const incRecEl = document.getElementById("incomeIsRecurring");
    if (incRecEl) incRecEl.checked = isRec;

    const freq = inc.frequency || "MONTHLY";
    const interval = inc.intervalDays || 1;
    const incFreqEl = document.getElementById("incomeRecurringFrequency");
    if (incFreqEl) incFreqEl.value = freq;
    const incIntervalEl = document.getElementById("incomeRecurringIntervalDays");
    if (incIntervalEl) incIntervalEl.value = interval;

    const incRecOptions = document.getElementById("incomeRecurringOptions");
    if (incRecOptions) {
        incRecOptions.hidden = !isRec;
        incRecOptions.style.display = isRec ? "flex" : "none";
    }
    const titleEl = document.getElementById("incomeModalTitle");
    if (titleEl) titleEl.textContent = "Edit Income Stream";
    openModal(modal);
};

window.deleteIncomeFromSubsModal = async (incId) => {
    if (!confirm("Are you sure you want to delete this recurring income stream?")) return;
    try {
        setLoading(true, "Deleting income...");
        await apiRequest(`/incomes/${incId}/user/${userId}`, { method: "DELETE" });
        showToast("Income record deleted.", "success");
        await loadDashboard(true);
        loadSubscriptions();
    } catch (err) {
        showToast(err.message || "Failed to delete income", "error");
    } finally {
        setLoading(false);
    }
};

const editSubModal = document.getElementById("editSubModal");
const editSubForm = document.getElementById("editSubForm");

window.openEditSubscription = (id, desc, amount, nextDueDate, frequency = 'MONTHLY', intervalDays = 1) => {
    const editSubCatSelect = document.getElementById("editSubCategory");
    if (editSubCatSelect && allCategories && allCategories.length > 0) {
        editSubCatSelect.innerHTML = allCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
        if (window.syncCustomSelect) window.syncCustomSelect(editSubCatSelect);
    }
    document.getElementById("editSubId").value = id;
    document.getElementById("editSubDesc").value = desc.trim();
    document.getElementById("editSubAmount").value = amount;
    document.getElementById("editSubNextDate").value = nextDueDate;
    const freqSelect = document.getElementById("editSubFrequency");
    if (freqSelect) freqSelect.value = frequency;
    const intervalInput = document.getElementById("editSubIntervalDays");
    if (intervalInput) intervalInput.value = intervalDays || 1;
    const intervalWrap = document.getElementById("editSubCustomIntervalWrap") || document.getElementById("editSubIntervalWrap");
    if (intervalWrap) intervalWrap.hidden = frequency !== "CUSTOM";
    openModal(editSubModal);
};

// Toggle custom interval field inside edit subscription form
document.getElementById("editSubFrequency")?.addEventListener("change", (e) => {
    const wrap = document.getElementById("editSubCustomIntervalWrap") || document.getElementById("editSubIntervalWrap");
    if (wrap) wrap.hidden = e.target.value !== "CUSTOM";
});

document.getElementById("closeEditSubModalBtn")?.addEventListener("click", () => {
    closeModal(editSubModal);
});
editSubModal?.addEventListener("click", (e) => {
    if (e.target === editSubModal) closeModal(editSubModal);
});

editSubForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = editSubForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return; // a submission is already in flight

    const id = document.getElementById("editSubId").value;
    const desc = document.getElementById("editSubDesc").value;
    const amount = parseFloat(document.getElementById("editSubAmount").value);
    const nextDueDate = document.getElementById("editSubNextDate").value;
    const frequency = document.getElementById("editSubFrequency")?.value || "MONTHLY";
    const intervalDaysRaw = parseInt(document.getElementById("editSubIntervalDays")?.value || "1");

    if (isNaN(amount) || amount <= 0) return showToast("Amount must be greater than 0", "error");
    if (frequency === "CUSTOM" && (isNaN(intervalDaysRaw) || intervalDaysRaw < 1)) {
        return showToast("Custom interval must be at least 1 day", "error");
    }

    const body = { description: desc, amount, nextDueDate, frequency };
    if (frequency === "CUSTOM") body.intervalDays = intervalDaysRaw;

    submitBtn.disabled = true;
    try {
        await apiRequest(`/expenses/recurring/${id}`, {
            method: "PUT",
            body: JSON.stringify(body)
        });
        showToast("Subscription updated successfully.", "success");
        closeModal(editSubModal);
        loadSubscriptions();
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        submitBtn.disabled = false;
    }
});

// Cancel Logic
window.cancelSubscription = async (id, event) => {
    if (!confirm("Are you sure you want to cancel this recurring subscription? Future auto-payments will stop.")) return;

    try {
        await apiRequest(`/expenses/recurring/${id}`, { method: "DELETE" });
        showToast("Subscription cancelled.", "success");
        loadSubscriptions();
    } catch (err) {
        showToast(err.message, "error");
        const btn = event?.target?.closest(".btn-delete");
        if (btn) {
            btn.classList.add("shake");
            setTimeout(() => btn.classList.remove("shake"), 400);
        }
    }
};

// --- 8. DELETE ACCOUNT ---

function checkDeleteBtnState() {
    const isTextValid = elements.deleteConfirmInput && elements.deleteConfirmInput.value.trim() === "DELETE";
    const isPassValid = !elements.deletePasswordInput || elements.deletePasswordInput.value.length > 0;
    const isValid = isTextValid && isPassValid;
    elements.confirmDeleteAccountBtn.style.opacity = isValid ? "1" : "0.5";
    elements.confirmDeleteAccountBtn.style.pointerEvents = isValid ? "auto" : "none";
}

// Open the delete account confirmation modal
elements.deleteAccountBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleProfileMenu(false);
    if (elements.deletePasswordInput) elements.deletePasswordInput.value = "";
    elements.deleteConfirmInput.value = "";
    elements.confirmDeleteAccountBtn.style.opacity = "0.5";
    elements.confirmDeleteAccountBtn.style.pointerEvents = "none";
    openModal(elements.deleteAccountModal);
    setTimeout(() => {
        if (elements.deletePasswordInput) {
            elements.deletePasswordInput.focus();
        } else {
            elements.deleteConfirmInput.focus();
        }
    }, 150);
});

// Enable the confirm button only when user enters password and types "DELETE"
elements.deleteConfirmInput.addEventListener("input", checkDeleteBtnState);
if (elements.deletePasswordInput) {
    elements.deletePasswordInput.addEventListener("input", checkDeleteBtnState);
}

// Close modal on cancel
elements.cancelDeleteAccountBtn.addEventListener("click", () => {
    closeModal(elements.deleteAccountModal);
    if (elements.deletePasswordInput) elements.deletePasswordInput.value = "";
    elements.deleteConfirmInput.value = "";
});

// Close modal on overlay click
elements.deleteAccountModal.addEventListener("click", (e) => {
    if (e.target === elements.deleteAccountModal) {
        closeModal(elements.deleteAccountModal);
        if (elements.deletePasswordInput) elements.deletePasswordInput.value = "";
        elements.deleteConfirmInput.value = "";
    }
});

// Confirm deletion — calls DELETE /api/users/{userId} with password confirmation
elements.confirmDeleteAccountBtn.addEventListener("click", async () => {
    const password = elements.deletePasswordInput ? elements.deletePasswordInput.value : "";
    if (!password) {
        showToast("Please enter your current password to confirm deletion.", "warning");
        elements.deletePasswordInput?.focus();
        return;
    }
    if (elements.deleteConfirmInput.value.trim() !== "DELETE") return;

    elements.confirmDeleteAccountBtn.classList.add("btn-loading");
    elements.confirmDeleteAccountBtn.style.pointerEvents = "none";

    try {
        await apiRequest(`/users/${userId}`, {
            method: "DELETE",
            body: JSON.stringify({ password: password }),
            skipAuthRedirect: true
        });
        localStorage.clear();
        window.location.href = "index.html";
    } catch (err) {
        showToast(err.message, "error");
        elements.confirmDeleteAccountBtn.classList.remove("btn-loading");
        elements.confirmDeleteAccountBtn.style.opacity = "1";
        elements.confirmDeleteAccountBtn.style.pointerEvents = "auto";
        if (elements.deletePasswordInput) {
            elements.deletePasswordInput.value = "";
            elements.deletePasswordInput.focus();
        }
    }
});

// Start
loadDashboard();

function formatFrequency(subscription) {
    return subscription.frequency === "CUSTOM"
        ? `Every ${subscription.intervalDays} day${subscription.intervalDays === 1 ? "" : "s"}`
        : (subscription.frequency || "MONTHLY").toLowerCase().replace(/^./, char => char.toUpperCase());
}

// --- RIPPLE EFFECT on primary / submit buttons ---
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-primary, button[type='submit']");
    if (!btn) return;
    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";
    const rect = btn.getBoundingClientRect();
    ripple.style.left = (e.clientX - rect.left - 4) + "px";
    ripple.style.top  = (e.clientY - rect.top  - 4) + "px";
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
});


// =========================================================================
// EXECUTIVE CASH FLOW & INFLOW / SAVINGS GOVERNANCE
// =========================================================================

function updateCashFlowMetrics(expenses, incomes, savingsGoals) {
    const totalSpent = (expenses || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const totalIncome = (incomes || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const netCashFlow = totalIncome - totalSpent;
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
                    <button type="button" class="btn-icon btn-text-icon" onclick="resetIncomeFilters()" style="display:inline-flex; align-items:center; gap:6px; margin:12px auto 0; cursor:pointer;">
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
            <table class="data-table income-table" style="width:100%; border-collapse:collapse; margin-top:4px;">
                <thead>
                    <tr style="border-bottom:1px solid var(--border); text-align:left; color:var(--text-muted); font-size:12px;">
                        <th style="padding:10px 12px; white-space:nowrap;">Date</th>
                        <th style="padding:10px 12px; white-space:nowrap;">Source</th>
                        <th style="padding:10px 12px;">Description</th>
                        <th style="padding:10px 12px; white-space:nowrap;">Type</th>
                        <th style="padding:10px 12px; text-align:right; white-space:nowrap;">Amount</th>
                        <th style="padding:10px 12px; text-align:center; white-space:nowrap;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${incomes.map((inc, idx) => {
                        const isRec = !!(inc.isRecurring || inc.recurring);
                        const freqLabel = formatIncomeFrequency(inc.frequency, inc.intervalDays);
                        return `
                        <tr class="table-row-stagger" style="animation-delay: ${Math.min(idx * 35, 350)}ms; border-bottom:1px solid var(--border); font-size:13.5px;">
                            <td style="padding:12px 14px; white-space:nowrap; color:var(--text-muted);">${inc.incomeDate || "—"}</td>
                            <td style="padding:12px 14px; font-weight:600;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <div class="income-emoji-box" title="${escapeHtml(inc.source || 'Income')}">
                                        <span>${getIncomeSourceEmoji(inc.source)}</span>
                                    </div>
                                    <span style="font-weight:600; color:var(--text-main); font-size:13.5px;">${escapeHtml(inc.source || "Income")}</span>
                                </div>
                            </td>
                            <td class="income-desc-cell" style="padding:10px 12px; color:var(--text-muted); font-size:13px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(inc.description || "")}">${escapeHtml(inc.description || "—")}</td>
                            <td style="padding:12px 14px;">
                                ${isRec 
                                    ? `<span class="status-badge badge-success" style="font-size:11px; background:rgba(16,185,129,0.15); color:#10B981; border:1px solid rgba(16,185,129,0.3); display:inline-flex; align-items:center; gap:5px;"><span style="font-size:12px;">⟳</span> Recurring (${freqLabel})</span>` 
                                    : '<span class="status-badge badge-neutral" style="font-size:11px; display:inline-flex; align-items:center; gap:4px;"><span style="font-size:11px;">⚡</span> One-Time</span>'}
                            </td>
                            <td style="padding:12px 14px; text-align:right; font-weight:700; color:#10B981; font-family:var(--font-mono); font-variant-numeric:tabular-nums; font-size:14px;">
                                +${formatCurrency(inc.amount)}
                            </td>
                            <td style="padding:12px 14px; text-align:center;">
                                <button class="btn-icon edit-income-btn" data-inc-id="${inc.id}" data-inc-source="${escapeHtml(inc.source || "")}" data-inc-amount="${inc.amount || 0}" data-inc-date="${inc.incomeDate || ""}" data-inc-desc="${escapeHtml(inc.description || "")}" data-inc-recurring="${isRec}" data-inc-freq="${escapeHtml(inc.frequency || "MONTHLY")}" data-inc-interval="${inc.intervalDays || 1}" title="Edit Income" style="color:var(--text-muted); margin-right:4px;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button class="btn-icon delete-income-btn" data-income-id="${inc.id}" title="Delete Income" style="color:var(--text-muted);">
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
            if (!confirm("Are you sure you want to delete this income stream?")) return;
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
    const goal = (window.allSavingsGoals || allSavingsGoals || []).find(g => String(g.id) === String(goalId));
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
    window.allIncomes = allIncomes;
    applyIncomeFilters();
    updateStreamBadges();
}
window.renderIncomes = renderIncomes;

function renderSavingsGoals(goals) {
    allSavingsGoals = Array.isArray(goals) ? goals : [];
    window.allSavingsGoals = allSavingsGoals;
    allSavingsGoals = Array.isArray(goals) ? goals : [];
    const container = document.getElementById("savingsGoalsList");
    if (!container) return;
    if (!allSavingsGoals || allSavingsGoals.length === 0) {
        container.innerHTML = `
            <div class="empty-state-compact" style="grid-column:1/-1; text-align:center; padding:28px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02);">
                <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">No savings goals configured yet</p>
                <span style="font-size:12.5px;">Click <strong>+ New Goal</strong> to set targets for emergency reserves, investments, or travel.</span>
            </div>`;
        return;
    }

    container.innerHTML = goals.map((goal, idx) => {
        const target = Number(goal.targetAmount || 0);
        const current = Number(goal.currentAmount || 0);
        const ratio = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        const isCompleted = current >= target;

        return `
            <div class="card savings-goal-card hover-lift table-row-stagger" style="animation-delay: ${Math.min(idx * 45, 450)}ms; padding:18px; border:1px solid var(--border); border-radius:14px; background:var(--card-bg, rgba(255,255,255,0.03));">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div>
                        <h4 style="margin:0; font-size:15px; font-weight:700;">${escapeHtml(goal.name || "Savings Goal")}</h4>
                        <span style="font-size:11.5px; color:var(--text-muted);">Target: ${goal.targetDate || "Flexible"}</span>
                        ${goal.isRecurring ? `
                            <div style="margin-top:4px; font-size:11px; color:#F59E0B; display:inline-flex; align-items:center; gap:4px; background:rgba(245,158,11,0.1); padding:2px 6px; border-radius:6px; border:1px solid rgba(245,158,11,0.25);">
                                🔁 <strong>${formatCurrency(goal.recurringAmount)}</strong> / ${escapeHtml(formatGoalFrequency(goal.frequency, goal.intervalDays))}
                                ${goal.nextDueDate ? `• Next: ${formatDate(goal.nextDueDate)}` : ''}
                            </div>
                        ` : ''}
                    </div>
                    ${isCompleted 
                        ? '<span class="status-badge badge-success badge-pulse-glow" style="font-size:11px;">Completed 🎯</span>'
                        : `<span class="status-badge badge-warning" style="font-size:11px;">${ratio}% Achieved</span>`}
                </div>
                
                <div style="margin: 12px 0 6px;">
                    <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
                        <span style="font-weight:700; color:#F59E0B;">${formatCurrency(current)}</span>
                        <span style="color:var(--text-muted);">${formatCurrency(target)}</span>
                    </div>
                    <div style="height:8px; width:100%; background:var(--border); border-radius:4px; overflow:hidden;">
                        <div class="goal-progress-fill" data-target-width="${ratio}%" style="height:100%; width:0%; background: linear-gradient(90deg, #F59E0B, #10B981); border-radius:4px;"></div>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:10px; border-top:1px solid var(--border);">
                    <button class="btn-primary btn-small deposit-goal-btn" data-goal-id="${goal.id}" data-goal-name="${escapeHtml(goal.name)}" style="background:#F59E0B; border-color:#F59E0B; font-size:12px; padding:4px 12px; cursor:pointer;">
                        + Deposit
                    </button>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button class="btn-icon edit-goal-btn" data-goal-id="${goal.id}" title="Edit Goal" style="color:var(--text-muted); cursor:pointer;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn-icon delete-goal-btn" data-goal-id="${goal.id}" title="Delete Goal" style="color:var(--text-muted); cursor:pointer;">
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
            if (!confirm("Are you sure you want to delete this savings goal?")) return;
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
    const id = document.getElementById("incomeId").value;
    const isRecurring = document.getElementById("incomeIsRecurring").checked;
    const frequency = isRecurring ? (document.getElementById("incomeRecurringFrequency")?.value || "MONTHLY") : null;
    const intervalDays = (isRecurring && frequency === "CUSTOM")
        ? (parseInt(document.getElementById("incomeRecurringIntervalDays")?.value, 10) || 1)
        : null;

    const payload = {
        source: document.getElementById("incomeSource").value.trim(),
        amount: parseFloat(document.getElementById("incomeAmount").value),
        incomeDate: document.getElementById("incomeDate").value,
        description: document.getElementById("incomeDesc").value.trim(),
        isRecurring: isRecurring,
        frequency: frequency,
        intervalDays: intervalDays
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

// --- EXECUTIVE STATEMENT & INCOMES EXPORT / IMPORT CONTROLS ---
document.getElementById("exportReportPdfBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/reports/user/${userId}/export/pdf`, "executive_financial_statement.pdf", "Generating Complete Executive Financial Statement PDF...");
});

document.getElementById("exportIncomeExcelBtn")?.addEventListener("click", () => {
    downloadAuthenticated(
        `${API_BASE_URL}/incomes/user/${userId}/export/excel`,
        "incomes.xlsx",
        "Generating Incomes Excel Workbook...",
        () => exportIncomesClientSideExcel()
    );
});

document.getElementById("exportIncomeCsvBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/incomes/user/${userId}/export/csv`, "incomes.csv", "Exporting Incomes CSV...");
});

document.getElementById("exportIncomeJsonBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/incomes/user/${userId}/export/json`, "incomes.json", "Exporting Incomes JSON...");
});

document.getElementById("exportIncomePdfBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/incomes/user/${userId}/export/pdf`, "incomes_report.pdf", "Generating Incomes PDF Report...");
});

const importIncomeBtn = document.getElementById("importIncomeBtn");
const importIncomeFileInput = document.getElementById("importIncomeFileInput");

importIncomeBtn?.addEventListener("click", () => importIncomeFileInput?.click());

importIncomeFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const fname = file.name.toLowerCase();
    let endpoint = `/incomes/user/${userId}/import/csv`;
    if (fname.endsWith(".xlsx") || fname.endsWith(".xls")) {
        endpoint = `/incomes/user/${userId}/import/excel`;
    }

    try {
        setLoading(true, "Importing income streams...");
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token") || token}`
            },
            body: formData
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || "Incomes import failed");
        }

        const data = await res.json();
        showToast(data.message || "Incomes imported successfully!", "success");
        if (typeof window.clearApiCache === "function") window.clearApiCache();
        try { localStorage.removeItem(getCacheKey()); } catch (_) {}
        await loadDashboard(true);
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        setLoading(false);
        importIncomeFileInput.value = "";
    }
});

// --- MONTHLY FINANCIAL STATEMENT & PERIOD SELECTION SYSTEM ---
const ALL_REPORT_MONTHS = [
    { num: 1, name: "Jan", full: "January" },
    { num: 2, name: "Feb", full: "February" },
    { num: 3, name: "Mar", full: "March" },
    { num: 4, name: "Apr", full: "April" },
    { num: 5, name: "May", full: "May" },
    { num: 6, name: "Jun", full: "June" },
    { num: 7, name: "Jul", full: "July" },
    { num: 8, name: "Aug", full: "August" },
    { num: 9, name: "Sep", full: "September" },
    { num: 10, name: "Oct", full: "October" },
    { num: 11, name: "Nov", full: "November" },
    { num: 12, name: "Dec", full: "December" },
];

const reportDateNow = new Date();
const currentSystemYear = reportDateNow.getFullYear();
const currentSystemMonth = reportDateNow.getMonth() + 1; // 1-indexed

let periodStartYear = currentSystemYear;
let periodStartMonth = currentSystemMonth;
let periodAvailableYears = [currentSystemYear];

let selectedReportYear = currentSystemYear;
let selectedReportMonth = currentSystemMonth;
let viewedReportYear = currentSystemYear;
let viewedReportMonth = currentSystemMonth;
let cachedReportHtml = "";

const monthlyReportPeriodModal = document.getElementById("monthlyReportPeriodModal");
const closePeriodModalBtn = document.getElementById("closePeriodModalBtn");
const reportYearChips = document.getElementById("reportYearChips");
const reportMonthGrid = document.getElementById("reportMonthGrid");
const reportPeriodBanner = document.getElementById("reportPeriodBanner");
const reportSelectedPeriodText = document.getElementById("reportSelectedPeriodText");
const reportInceptionVal = document.getElementById("reportInceptionVal");

const periodViewReportBtn = document.getElementById("periodViewReportBtn");
const periodDownloadReportBtn = document.getElementById("periodDownloadReportBtn");
const periodEmailReportBtn = document.getElementById("periodEmailReportBtn");

const monthlyReportModal = document.getElementById("monthlyReportModal");
const viewMonthlyReportBtn = document.getElementById("viewMonthlyReportBtn");
const closeMonthlyReportModalBtn = document.getElementById("closeMonthlyReportModalBtn");
const changeReportPeriodBtn = document.getElementById("changeReportPeriodBtn");
const changeReportPeriodBtnLabel = document.getElementById("changeReportPeriodBtnLabel");
const monthlyReportMeta = document.getElementById("monthlyReportMeta");
const printReportBtn = document.getElementById("printReportBtn");
const downloadHtmlReportBtn = document.getElementById("downloadHtmlReportBtn");
const emailReportBtn = document.getElementById("emailReportBtn");
const monthlyReportFrame = document.getElementById("monthlyReportFrame");

function determineAccountInception() {
    const dates = [];
    if (Array.isArray(allExpenses)) {
        allExpenses.forEach(e => {
            const d = e.expenseDate || e.date;
            if (d) dates.push(d);
        });
    }
    if (Array.isArray(allIncomes)) {
        allIncomes.forEach(i => {
            const d = i.incomeDate || i.date;
            if (d) dates.push(d);
        });
    }
    dates.sort();
    if (dates.length > 0) {
        const earliest = new Date(dates[0]);
        const eYear = earliest.getFullYear();
        const eMonth = earliest.getMonth() + 1;
        if (!isNaN(eYear) && eYear >= 2020 && eYear <= currentSystemYear) {
            periodStartYear = eYear;
            periodStartMonth = eMonth;
            const years = [];
            for (let y = eYear; y <= currentSystemYear; y++) {
                years.push(y);
            }
            periodAvailableYears = years.reverse();
            return;
        }
    }
    periodStartYear = currentSystemYear;
    periodStartMonth = 1;
    periodAvailableYears = [currentSystemYear];
}

function isPeriodMonthValid(monthNum, year) {
    if (year === currentSystemYear && monthNum > currentSystemMonth) {
        return false; // Future month
    }
    if (year === periodStartYear && monthNum < periodStartMonth) {
        return false; // Prior to inception
    }
    return true;
}

function renderPeriodPickerUI() {
    if (!reportYearChips || !reportMonthGrid) return;

    // Render Year Chips
    reportYearChips.innerHTML = "";
    periodAvailableYears.forEach(y => {
        const isSelected = y === selectedReportYear;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `period-chip ${isSelected ? "active" : ""}`;
        chip.textContent = y;
        chip.addEventListener("click", () => {
            selectedReportYear = y;
            // Adjust selected month if invalid in new year
            if (selectedReportYear === currentSystemYear && selectedReportMonth > currentSystemMonth) {
                selectedReportMonth = currentSystemMonth;
            } else if (selectedReportYear === periodStartYear && selectedReportMonth < periodStartMonth) {
                selectedReportMonth = periodStartMonth;
            }
            renderPeriodPickerUI();
        });
        reportYearChips.appendChild(chip);
    });

    // Render Month Grid
    reportMonthGrid.innerHTML = "";
    ALL_REPORT_MONTHS.forEach(m => {
        const isValid = isPeriodMonthValid(m.num, selectedReportYear);
        const isSelected = m.num === selectedReportMonth;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `period-month-chip ${isSelected ? "active" : ""} ${!isValid ? "disabled" : ""}`;
        chip.textContent = m.name;
        chip.title = m.full;
        if (!isValid) {
            chip.disabled = true;
        } else {
            chip.addEventListener("click", () => {
                selectedReportMonth = m.num;
                renderPeriodPickerUI();
            });
        }
        reportMonthGrid.appendChild(chip);
    });

    // Update Banner & Inception text
    const selectedMonthObj = ALL_REPORT_MONTHS.find(m => m.num === selectedReportMonth);
    const startMonthObj = ALL_REPORT_MONTHS.find(m => m.num === periodStartMonth);
    if (reportSelectedPeriodText && selectedMonthObj) {
        reportSelectedPeriodText.textContent = `${selectedMonthObj.full} ${selectedReportYear}`;
    }
    if (reportInceptionVal && startMonthObj) {
        reportInceptionVal.textContent = `${startMonthObj.full} ${periodStartYear}`;
    }
}

let currentPeriodModalMode = "view"; // "view" | "export"

function setPeriodModalMode(mode) {
    currentPeriodModalMode = mode;
    const modalIcon = document.getElementById("periodModalIcon");
    const modalTitle = document.getElementById("periodModalTitle");
    const modalSubtitle = document.getElementById("periodModalSubtitle");
    const viewActions = document.getElementById("periodViewModeActions");
    const exportActions = document.getElementById("periodExportModeActions");

    if (mode === "export") {
        if (modalIcon) modalIcon.textContent = "📥";
        if (modalTitle) modalTitle.textContent = "Export Monthly Summary";
        if (modalSubtitle) modalSubtitle.textContent = "Select statement period & format to download your financial records.";
        if (viewActions) viewActions.style.display = "none";
        if (exportActions) exportActions.style.display = "block";
    } else {
        if (modalIcon) modalIcon.textContent = "📊";
        if (modalTitle) modalTitle.textContent = "View Monthly Report";
        if (modalSubtitle) modalSubtitle.textContent = "Account inception:";
        if (viewActions) viewActions.style.display = "block";
        if (exportActions) exportActions.style.display = "none";
    }
}

function openMonthlyReportPeriodModal(initialAction = "view") {
    if (!monthlyReportPeriodModal) return;
    determineAccountInception();
    // Default to current year and month if selected is invalid
    if (!isPeriodMonthValid(selectedReportMonth, selectedReportYear)) {
        selectedReportYear = currentSystemYear;
        selectedReportMonth = currentSystemMonth;
    }
    renderPeriodPickerUI();
    setPeriodModalMode(initialAction === "export" ? "export" : "view");
    openModal(monthlyReportPeriodModal);

    if (initialAction === "export") {
        setTimeout(() => periodDownloadReportBtn?.focus(), 50);
    } else {
        setTimeout(() => periodViewReportBtn?.focus(), 50);
    }
}

document.getElementById("periodSwitchToExportBtn")?.addEventListener("click", () => {
    setPeriodModalMode("export");
});

document.getElementById("periodSwitchToViewBtn")?.addEventListener("click", () => {
    setPeriodModalMode("view");
});

closePeriodModalBtn?.addEventListener("click", () => {
    closeModal(monthlyReportPeriodModal);
});

function applyLuxuryScrollbarToReportFrame(frame) {
    if (!frame) return;
    try {
        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (!doc || !doc.head) return;
        let styleEl = doc.getElementById("custom-report-preview-scrollbars");
        if (!styleEl) {
            styleEl = doc.createElement("style");
            styleEl.id = "custom-report-preview-scrollbars";
            doc.head.appendChild(styleEl);
        }
        styleEl.textContent = `
            html, body {
                scrollbar-width: thin !important;
                scrollbar-color: rgba(199, 154, 62, 0.5) rgba(11, 13, 9, 0.9) !important;
            }
            html::-webkit-scrollbar,
            body::-webkit-scrollbar,
            ::-webkit-scrollbar {
                width: 7px !important;
                height: 7px !important;
            }
            html::-webkit-scrollbar-track,
            body::-webkit-scrollbar-track,
            ::-webkit-scrollbar-track {
                background: #0b0d09 !important;
                border-radius: 999px !important;
            }
            html::-webkit-scrollbar-thumb,
            body::-webkit-scrollbar-thumb,
            ::-webkit-scrollbar-thumb {
                background: rgba(199, 154, 62, 0.5) !important;
                border-radius: 999px !important;
                border: 1px solid transparent !important;
                background-clip: padding-box !important;
            }
            html::-webkit-scrollbar-thumb:hover,
            body::-webkit-scrollbar-thumb:hover,
            ::-webkit-scrollbar-thumb:hover {
                background: rgba(199, 154, 62, 0.85) !important;
            }
            * {
                scrollbar-width: thin !important;
                scrollbar-color: rgba(199, 154, 62, 0.5) rgba(11, 13, 9, 0.9) !important;
            }
        `;
    } catch (e) {
        // Cross-origin safety
    }
}

async function openMonthlyReportPreview(year = selectedReportYear, month = selectedReportMonth) {
    if (!monthlyReportModal) return;
    try {
        viewedReportYear = year;
        viewedReportMonth = month;
        const monthObj = ALL_REPORT_MONTHS.find(m => m.num === viewedReportMonth) || { name: `M${month}`, full: `Month ${month}` };

        setLoading(true, `Compiling financial report for ${monthObj.full} ${viewedReportYear}...`);
        const res = await fetch(`${API_BASE_URL}/reports/monthly/user/${userId}/html?year=${viewedReportYear}&month=${viewedReportMonth}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token") || token}` }
        });
        if (!res.ok) throw new Error(`Failed to load monthly report (${res.status})`);
        cachedReportHtml = await res.text();
        if (monthlyReportFrame) {
            monthlyReportFrame.onload = () => applyLuxuryScrollbarToReportFrame(monthlyReportFrame);
            monthlyReportFrame.srcdoc = cachedReportHtml;
            setTimeout(() => applyLuxuryScrollbarToReportFrame(monthlyReportFrame), 50);
            setTimeout(() => applyLuxuryScrollbarToReportFrame(monthlyReportFrame), 250);
        }
        if (monthlyReportMeta) {
            monthlyReportMeta.innerHTML = `<span class="meta-label">Executive Statement</span> <span class="meta-dot">•</span> <strong class="meta-period">${monthObj.full} ${viewedReportYear}</strong>`;
        }
        if (changeReportPeriodBtnLabel) {
            changeReportPeriodBtnLabel.textContent = `${monthObj.name} ${viewedReportYear}`;
        }
        openModal(monthlyReportModal);
    } catch (err) {
        showToast(err.message || "Unable to preview monthly report", "error");
    } finally {
        setLoading(false);
    }
}

async function downloadMonthlyReport(year = selectedReportYear, month = selectedReportMonth) {
    const monthObj = ALL_REPORT_MONTHS.find(m => m.num === month) || { full: `Month ${month}` };
    try {
        setLoading(true, `Preparing ${monthObj.full} ${year} statement download...`);
        let htmlContent = cachedReportHtml;
        if (!htmlContent || viewedReportYear !== year || viewedReportMonth !== month) {
            const res = await fetch(`${API_BASE_URL}/reports/monthly/user/${userId}/html?year=${year}&month=${month}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token") || token}` }
            });
            if (!res.ok) throw new Error(`Failed to generate report download (${res.status})`);
            htmlContent = await res.text();
        }
        const blob = new Blob([htmlContent], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `financial-statement-${year}-${String(month).padStart(2, "0")}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Financial statement for ${monthObj.full} ${year} saved.`, "success");
    } catch (err) {
        showToast(err.message || "Failed to download report", "error");
    } finally {
        setLoading(false);
    }
}

async function emailMonthlyReport(year = selectedReportYear, month = selectedReportMonth) {
    const monthObj = ALL_REPORT_MONTHS.find(m => m.num === month) || { full: `Month ${month}` };
    try {
        setLoading(true, `Dispatching ${monthObj.full} ${year} report to your email...`);
        const res = await apiRequest(`/reports/monthly/user/${userId}/send-email?year=${year}&month=${month}`, { method: "POST" });
        showToast(res?.message || `Financial statement for ${monthObj.full} ${year} emailed successfully!`, "success");
    } catch (err) {
        showToast("Email is not configured. Starting report download instead...", "warning");
        await downloadMonthlyReport(year, month);
    } finally {
        setLoading(false);
    }
}

async function exportMonthlyCsv(year = selectedReportYear, month = selectedReportMonth) {
    const monthObj = ALL_REPORT_MONTHS.find(m => m.num === month) || { full: `Month ${month}` };
    try {
        setLoading(true, `Exporting CSV transactions for ${monthObj.full} ${year}...`);
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const monthlyExpenses = (allExpenses || []).filter(e => {
            const d = e.expenseDate || e.date;
            return d && d >= startDate && d <= endDate;
        });
        const monthlyIncomes = (allIncomes || []).filter(i => {
            const d = i.incomeDate || i.date;
            return d && d >= startDate && d <= endDate;
        });

        const sanitizeCsvCell = (val) => {
            if (val === null || val === undefined) return '""';
            let str = String(val);
            if (/^[=+\-@\t\r%]/.test(str)) {
                str = "'" + str;
            }
            return '"' + str.replace(/"/g, '""') + '"';
        };

        let csv = "Type,Date,Description,Category/Source,Amount,Payment Method\n";
        monthlyExpenses.forEach(e => {
            const catName = getCategoryName(e.categoryId) || "Uncategorized";
            csv += `Expense,${e.expenseDate || e.date || ""},${sanitizeCsvCell(e.description || "")},${sanitizeCsvCell(catName)},${e.amount || 0},${sanitizeCsvCell(e.paymentMethod || "CASH")}\n`;
        });
        monthlyIncomes.forEach(i => {
            const catName = i.source || "Income";
            csv += `Income,${i.incomeDate || i.date || ""},${sanitizeCsvCell(i.description || i.source || "")},${sanitizeCsvCell(catName)},${i.amount || 0},${sanitizeCsvCell(i.paymentMethod || "CASH")}\n`;
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `financial-ledger-${year}-${String(month).padStart(2, "0")}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Monthly transactions CSV downloaded for ${monthObj.full} ${year}.`, "success");
    } catch (err) {
        showToast(err.message || "Failed to export CSV", "error");
    } finally {
        setLoading(false);
    }
}

async function exportMonthlyJson(year = selectedReportYear, month = selectedReportMonth) {
    const monthObj = ALL_REPORT_MONTHS.find(m => m.num === month) || { full: `Month ${month}` };
    try {
        setLoading(true, `Exporting JSON analytics for ${monthObj.full} ${year}...`);
        const report = await apiRequest(`/reports/monthly/user/${userId}?year=${year}&month=${month}`, { method: "GET" });
        const jsonStr = JSON.stringify(report, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `monthly-analytics-${year}-${String(month).padStart(2, "0")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Monthly JSON analytics downloaded for ${monthObj.full} ${year}.`, "success");
    } catch (err) {
        showToast(err.message || "Failed to export JSON analytics", "error");
    } finally {
        setLoading(false);
    }
}

// Action button listeners in Period Picker Modal
periodViewReportBtn?.addEventListener("click", () => {
    closeModal(monthlyReportPeriodModal);
    openMonthlyReportPreview(selectedReportYear, selectedReportMonth);
});

periodDownloadReportBtn?.addEventListener("click", () => {
    downloadMonthlyReport(selectedReportYear, selectedReportMonth);
});

document.getElementById("periodExportCsvBtn")?.addEventListener("click", () => {
    exportMonthlyCsv(selectedReportYear, selectedReportMonth);
});

document.getElementById("periodExportJsonBtn")?.addEventListener("click", () => {
    exportMonthlyJson(selectedReportYear, selectedReportMonth);
});

periodEmailReportBtn?.addEventListener("click", () => {
    emailMonthlyReport(selectedReportYear, selectedReportMonth);
});

// Profile avatar menu triggers -> open Period Picker Modal
viewMonthlyReportBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleProfileMenu(false);
    openMonthlyReportPeriodModal("view");
});

// Toolbar buttons inside Preview Modal
changeReportPeriodBtn?.addEventListener("click", () => {
    closeModal(monthlyReportModal);
    selectedReportYear = viewedReportYear;
    selectedReportMonth = viewedReportMonth;
    openMonthlyReportPeriodModal("view");
});

closeMonthlyReportModalBtn?.addEventListener("click", () => closeModal(monthlyReportModal));

printReportBtn?.addEventListener("click", () => {
    if (monthlyReportFrame && monthlyReportFrame.contentWindow) {
        monthlyReportFrame.contentWindow.focus();
        monthlyReportFrame.contentWindow.print();
    }
});

downloadHtmlReportBtn?.addEventListener("click", () => {
    downloadMonthlyReport(viewedReportYear, viewedReportMonth);
});

emailReportBtn?.addEventListener("click", () => {
    emailMonthlyReport(viewedReportYear, viewedReportMonth);
});


// --- AUTO-UPDATE DASHBOARD WITH SERVER DATA ---
// Automatically keeps the UI refreshed whenever tab becomes active or on interval
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        loadDashboard(true);
    }
});

window.addEventListener("focus", () => {
    loadDashboard(true);
});

// Periodic background sync every 25 seconds
setInterval(() => {
    if (document.visibilityState === "visible") {
        loadDashboard(true);
    }
}, 25000);

// --- CATEGORY PILLS HORIZONTAL OVERFLOW INDICATOR & SCROLL SYSTEM ---
function bindCategoryPillsScrollCues() {
    const configs = [
        { barId: "categoryPillsBar", wrapperId: "categoryPillsWrapper", cueId: "expensePillsScrollCue" },
        { barId: "incomePillsBar", wrapperId: "incomePillsWrapper", cueId: "incomePillsScrollCue" }
    ];

    configs.forEach(({ barId, wrapperId, cueId }) => {
        const bar = document.getElementById(barId);
        const wrapper = document.getElementById(wrapperId) || (bar ? bar.closest(".category-pills-wrapper") : null);
        const cue = document.getElementById(cueId);
        if (!bar || !wrapper || !cue) return;

        function updateCue() {
            const maxScrollLeft = bar.scrollWidth - bar.clientWidth;
            const hasOverflow = maxScrollLeft > 8;
            if (hasOverflow) {
                wrapper.classList.add("has-overflow-right");
                const atEnd = (maxScrollLeft - bar.scrollLeft) <= 10;
                const cueText = cue.querySelector(".cue-text");
                const cueArrow = cue.querySelector(".cue-arrow");
                if (atEnd) {
                    if (cueText) cueText.textContent = "Start";
                    if (cueArrow) cueArrow.style.transform = "rotate(180deg)";
                    cue.title = "Scroll back to start";
                    cue.setAttribute("aria-label", "Scroll back to start");
                } else {
                    if (cueText) cueText.textContent = "More";
                    if (cueArrow) cueArrow.style.transform = "rotate(0deg)";
                    cue.title = "Scroll to see more";
                    cue.setAttribute("aria-label", "Scroll to see more");
                }
            } else {
                wrapper.classList.remove("has-overflow-right");
            }
        }

        bar.addEventListener("scroll", updateCue, { passive: true });
        window.addEventListener("resize", updateCue, { passive: true });

        if (!cue.dataset.bound) {
            cue.dataset.bound = "true";
            cue.addEventListener("click", () => {
                const maxScrollLeft = bar.scrollWidth - bar.clientWidth;
                if ((maxScrollLeft - bar.scrollLeft) <= 10) {
                    bar.scrollTo({ left: 0, behavior: "smooth" });
                } else {
                    bar.scrollBy({ left: 180, behavior: "smooth" });
                }
            });
        }

        updateCue();
        setTimeout(updateCue, 100);
        setTimeout(updateCue, 400);

        if (!bar.dataset.observed) {
            bar.dataset.observed = "true";
            const obs = new MutationObserver(() => {
                setTimeout(updateCue, 50);
            });
            obs.observe(bar, { childList: true, subtree: true });
        }
    });
}
document.addEventListener("DOMContentLoaded", bindCategoryPillsScrollCues);
bindCategoryPillsScrollCues();

function updateStreamBadges() {
    const expCount = (window.allExpenses || allExpenses || []).length;
    const incCount = (window.allIncomes || allIncomes || []).length;
    const totalCount = expCount + incCount;
    
    const bAll = document.getElementById("badgeAllCount");
    const bExp = document.getElementById("badgeExpensesCount");
    const bInc = document.getElementById("badgeIncomesCount");
    const colExp = document.getElementById("colExpenseCount");
    const colInc = document.getElementById("colIncomeCount");
    
    if (bAll) bAll.textContent = totalCount;
    if (bExp) bExp.textContent = expCount;
    if (bInc) bInc.textContent = incCount;
    if (colExp) colExp.textContent = `${expCount} item${expCount === 1 ? "" : "s"}`;
    if (colInc) colInc.textContent = `${incCount} item${incCount === 1 ? "" : "s"}`;
}
window.updateStreamBadges = updateStreamBadges;

function initLedgerStreamTabs() {
    const tabs = document.querySelectorAll("#ledgerStreamTabs .stream-pill-btn");
    const grid = document.getElementById("unifiedLedgerGrid");
    const incPills = document.getElementById("incomePillsWrapper");
    const expPills = document.getElementById("categoryPillsWrapper");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => {
                t.classList.remove("active");
                t.style.background = "transparent";
                t.style.color = "var(--text-muted)";
                t.style.borderColor = "transparent";
            });
            tab.classList.add("active");
            tab.style.background = "var(--card-bg, rgba(255,255,255,0.08))";
            tab.style.color = "var(--text-main)";
            tab.style.borderColor = "var(--border)";

            const mode = tab.getAttribute("data-tab");
            if (grid) {
                grid.classList.remove("view-expenses", "view-incomes");
                if (mode === "expenses") {
                    grid.classList.add("view-expenses");
                    if (expPills) expPills.style.display = "flex";
                    if (incPills) incPills.style.display = "none";
                } else if (mode === "incomes") {
                    grid.classList.add("view-incomes");
                    if (expPills) expPills.style.display = "none";
                    if (incPills) incPills.style.display = "flex";
                } else {
                    if (expPills) expPills.style.display = "flex";
                    if (incPills) incPills.style.display = "none";
                }
            }
        });
    });
    updateStreamBadges();
}
window.initLedgerStreamTabs = initLedgerStreamTabs;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLedgerStreamTabs);
} else {
    initLedgerStreamTabs();
}


// Security PIN Modal & Account Recovery Management
const securityPinModal = document.getElementById("securityPinModal");
const securityPinBtn = document.getElementById("securityPinBtn");
const closeSecurityPinModalBtn = document.getElementById("closeSecurityPinModalBtn");
const securityPinForm = document.getElementById("securityPinForm");
const pinStatusIndicator = document.getElementById("pinStatusIndicator");

async function openSecurityPinDialog() {
    toggleProfileMenu(false);
    if (!securityPinModal) return;
    try {
        const userProf = await apiRequest(`/users/${userId}`);
        const hasPin = !!(userProf && userProf.hasSecurityPin);
        if (pinStatusIndicator) {
            pinStatusIndicator.style.background = hasPin ? "rgba(76, 122, 120, 0.15)" : "rgba(230, 162, 60, 0.15)";
            pinStatusIndicator.style.border = `1px solid ${hasPin ? "#4C7A78" : "#E6A23C"}`;
            pinStatusIndicator.style.color = hasPin ? "#4C7A78" : "#E6A23C";
            pinStatusIndicator.innerHTML = hasPin
                ? `<span>🔒 <strong>Active:</strong> 6-Digit PIN is set. Enter a new PIN below if you want to update it.</span>`
                : `<span>⚠️ <strong>Not Configured:</strong> Set a 6-digit PIN below for zero-email instant recovery.</span>`;
        }
    } catch (err) {
        console.warn("Could not fetch user security status:", err);
    }
    const newPinEl = document.getElementById("newSecurityPin");
    const confirmPinEl = document.getElementById("confirmSecurityPin");
    if (newPinEl) newPinEl.value = "";
    if (confirmPinEl) confirmPinEl.value = "";
    openModal(securityPinModal);
}

securityPinBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openSecurityPinDialog();
});

closeSecurityPinModalBtn?.addEventListener("click", () => {
    closeModal(securityPinModal);
});

securityPinModal?.addEventListener("click", (e) => {
    if (e.target === securityPinModal) closeModal(securityPinModal);
});

securityPinForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPin = (document.getElementById("newSecurityPin")?.value || "").trim();
    const confirmPin = (document.getElementById("confirmSecurityPin")?.value || "").trim();

    if (!/^[0-9]{6}$/.test(newPin)) {
        return showToast("PIN must be exactly 6 numeric digits.", "error");
    }
    if (newPin !== confirmPin) {
        return showToast("PINs do not match.", "error");
    }

    const submitBtn = securityPinForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        await apiRequest(`/users/${userId}/security-pin`, {
            method: "PUT",
            body: JSON.stringify({ securityPin: newPin })
        });
        showToast("Security PIN updated successfully! 🔒", "success");
        closeModal(securityPinModal);
    } catch (err) {
        showToast(err.message || "Failed to update Security PIN", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
});

// ─── Biometric Authentication (Touch ID / Face ID / Windows Hello) ─────────
const biometricAuthBtn = document.getElementById("biometricAuthBtn");
biometricAuthBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!window.WebBiometrics) {
        showToast("Biometric module not initialized.", "error");
        return;
    }
    const isAvail = await WebBiometrics.isAvailable();
    if (!isAvail) {
        showToast("Biometric hardware (Touch ID / Face ID / Windows Hello) is not detected or supported on this browser.", "warning");
        return;
    }
    const token = localStorage.getItem("token");
    const userEmail = localStorage.getItem("userEmail") || (window.currentUser && window.currentUser.email) || "user";
    try {
        await WebBiometrics.enroll(userEmail, token);
        showToast("Biometric authentication (Touch ID / Face ID) activated successfully for this device! 🧬", "success");
    } catch (err) {
        showToast(err.message || "Biometric registration was cancelled.", "info");
    }
});
