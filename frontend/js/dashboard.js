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
    subsList: document.getElementById("subsList"),
    closeSubsBtn: document.getElementById("closeSubsBtn"),
    // Delete Account Elements
    deleteAccountBtn: document.getElementById("deleteAccountBtn"),
    deleteAccountModal: document.getElementById("deleteAccountModal"),
    deleteConfirmInput: document.getElementById("deleteConfirmInput"),
    confirmDeleteAccountBtn: document.getElementById("confirmDeleteAccountBtn"),
    cancelDeleteAccountBtn: document.getElementById("cancelDeleteAccountBtn")
};

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
    allExpenses = (expenses || []).sort((a, b) => {
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
    const cached = skipCache ? null : loadExpenseCache();
    const renderedFromCache = !!cached;

    if (cached) {
        renderDashboardData(cached.expenses, cached.categories);
    } else {
        showSkeletonLoading();
    }

    try {
        console.log("Loading Dashboard Data...");

        const [expenses, globalCats, userCats] = await Promise.all([
            apiRequest(`/expenses/user/${userId}`),
            apiRequest(`/categories/global`),
            apiRequest(`/categories/user/${userId}`)
        ]);

        // Merge Categories safely
        const safeGlobal = Array.isArray(globalCats) ? globalCats : [];
        const safeUser = Array.isArray(userCats) ? userCats : [];
        const categories = [...safeGlobal, ...safeUser];
        userOnlyCategories = safeUser;

        renderDashboardData(expenses, categories);
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

let cachedBudgets = [];

/**
 * Computes and renders real-time financial insights into the Smart Intelligence panel.
 */
function renderFinancialInsights(expenses) {
    const grid = document.getElementById("insightsCardsGrid");
    const healthBadge = document.getElementById("insightsHealthScoreText");
    if (!grid) return;

    const safeExpenses = Array.isArray(expenses) ? expenses : (allExpenses || []);

    if (safeExpenses.length === 0) {
        grid.innerHTML = `
            <div class="insight-card-item" style="grid-column: 1 / -1; text-align: center; padding: 24px;">
                <p class="text-muted" style="margin: 0; font-size: 13.5px;">No transactions recorded for this period. Add expenses to generate real-time financial intelligence.</p>
            </div>
        `;
        if (healthBadge) healthBadge.textContent = "100% Budget Health";
        return;
    }

    const now = new Date();
    const currentDay = Math.max(now.getDate(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // 1. Current month burn rate and projection
    const currentMonthExpenses = safeExpenses.filter(e => {
        const d = new Date(e.expenseDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const currentMonthSpent = currentMonthExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const dailyBurn = currentMonthSpent / currentDay;
    const projectedSpent = dailyBurn * daysInMonth;

    // 2. Category dominance & percentage share
    const catMap = {};
    let totalAll = 0;
    safeExpenses.forEach(e => {
        const amt = Number(e.amount || 0);
        const cat = e.categoryName || "Other";
        catMap[cat] = (catMap[cat] || 0) + amt;
        totalAll += amt;
    });

    let topCat = "None";
    let topCatAmt = 0;
    Object.entries(catMap).forEach(([cat, amt]) => {
        if (amt > topCatAmt) {
            topCatAmt = amt;
            topCat = cat;
        }
    });
    const topCatPct = totalAll > 0 ? ((topCatAmt / totalAll) * 100).toFixed(1) : "0";

    // 3. Peak single transaction
    let peakExpense = null;
    safeExpenses.forEach(e => {
        const amt = Number(e.amount || 0);
        if (!peakExpense || amt > Number(peakExpense.amount || 0)) {
            peakExpense = e;
        }
    });

    // 4. Budget adherence score
    let healthScore = 100;
    let budgetInsightText = "All categories operating smoothly within limits.";
    if (cachedBudgets && cachedBudgets.length > 0) {
        let exceededCount = 0;
        let warningCount = 0;
        cachedBudgets.forEach(b => {
            const limit = Number(b.limit || b.amount || 0);
            const spent = Number(b.spent || 0);
            if (limit > 0) {
                const ratio = spent / limit;
                if (ratio > 1.0) exceededCount++;
                else if (ratio >= 0.8) warningCount++;
            }
        });
        const penalty = (exceededCount * 25) + (warningCount * 10);
        healthScore = Math.max(0, 100 - penalty);
        if (exceededCount > 0) {
            budgetInsightText = `⚠️ <strong>${exceededCount} budget(s) exceeded</strong>. Review high-spend categories immediately.`;
        } else if (warningCount > 0) {
            budgetInsightText = `🟡 <strong>${warningCount} budget(s) nearing limit</strong> (&gt;80% capacity utilized).`;
        } else {
            budgetInsightText = `🟢 <strong>${cachedBudgets.length} of ${cachedBudgets.length}</strong> categories strictly on target.`;
        }
    }
    if (healthBadge) {
        healthBadge.textContent = `${healthScore}% Budget Health`;
    }

    grid.innerHTML = `
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
                <strong>${topCat}</strong> is your primary driver, taking <strong>${topCatPct}%</strong> (<strong>${formatCurrency(topCatAmt)}</strong>) of all recorded spend.
            </div>
        </div>

        <div class="insight-card-item">
            <div class="insight-card-item-header">
                <div class="insight-icon-box" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">🎯</div>
                <span class="insight-card-label">Budget Adherence</span>
            </div>
            <div class="insight-card-content">
                ${budgetInsightText}
            </div>
        </div>

        <div class="insight-card-item">
            <div class="insight-card-item-header">
                <div class="insight-icon-box" style="background: rgba(162, 62, 50, 0.15); color: #A23E32;">🏷️</div>
                <span class="insight-card-label">Peak Outflow Alert</span>
            </div>
            <div class="insight-card-content">
                ${peakExpense ? `Largest transaction is <strong>${formatCurrency(peakExpense.amount)}</strong> for <em>${peakExpense.description || 'Expense'}</em>.` : 'No transactions recorded.'}
            </div>
        </div>
    `;
}

// Keyboard Shortcuts
document.addEventListener("keydown", (e) => {
    if ((e.key === '/' || (e.metaKey && e.key === 'k') || (e.ctrlKey && e.key === 'k')) && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        elements.filterSearch?.focus();
    }
});

// --- 2. BUDGET LOGIC ---
async function loadBudgets() {
    try {
        const budgets = await apiRequest(`/expenses/budget/status/user/${userId}`);
        const usageBadge = document.getElementById("budgetUsageBadge");

        if (!budgets || budgets.length === 0) {
            elements.budgetList.innerHTML = `<p class="text-muted" style="font-size:13px; text-align:center;">No budgets set.</p>`;
            if (usageBadge) {
                usageBadge.textContent = "No Budget Set";
                usageBadge.className = "status-badge badge-neutral";
            }
            if (budgetVsActualChart) { budgetVsActualChart.destroy(); budgetVsActualChart = null; }
            return;
        }

        // Overall usage across every budgeted category — only earns a color
        // when it's actually worth flagging, same thresholds as each row below.
        const totalLimit = budgets.reduce((acc, b) => acc + Number(b.limit || 0), 0);
        const totalSpent = budgets.reduce((acc, b) => acc + Number(b.spent || 0), 0);
        const overallPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

        if (usageBadge) {
            usageBadge.textContent = `${overallPct.toFixed(0)}% Used`;
            usageBadge.className = "status-badge " +
                (overallPct > 100 ? "badge-danger" : overallPct > 80 ? "badge-warning" : "badge-neutral");
        }

        elements.budgetList.innerHTML = budgets.map(b => {
            const pct = Math.min(b.percentage || 0, 100);
            let barColor;
            if (b.percentage > 100) { barColor = 'var(--danger)'; }
            else if (b.percentage > 80) { barColor = 'var(--warning)'; }
            else { barColor = 'var(--primary)'; }

            const catColor = getCategoryColor(b.categoryName);
            const periodLabel = b.period ? b.period.toUpperCase() : 'MONTHLY';
            // Store current values for the edit pre-fill
            const startStr = b.startDate || '';
            const endStr   = b.endDate   || '';
            return `
            <div class="budget-item">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:8px;">
                    <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                        <div style="width:36px; height:36px; border-radius:10px; background:${catColor.bg}; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">${getCategoryEmoji(b.categoryName)}</div>
                        <div style="min-width:0; flex:1;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span style="font-size:14px; font-weight:700; color:var(--text-main); line-height:1.2;">${b.categoryName}</span>
                                <span class="status-badge badge-neutral" style="font-size:9px; padding:2px 7px; font-weight:700; letter-spacing:0.5px; line-height:1.2; text-transform:uppercase;">${periodLabel}</span>
                            </div>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:4px; font-variant-numeric:tabular-nums; line-height:1.3;">
                                ${formatCurrency(b.spent)} <span style="opacity:0.7;">of</span> ${formatCurrency(b.limit)}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                        <span style="font-size:13px; font-weight:800; color:${barColor}; margin-right:2px;">${(b.percentage || 0).toFixed(0)}%</span>
                        <button onclick="openEditBudget(${b.budgetId || 0}, ${b.categoryId || 0}, '${b.categoryName}', ${b.limit || 0}, '${periodLabel}', '${startStr}', '${endStr}')" class="btn-edit" title="Edit Budget Limit" style="height:28px; width:28px; padding:0; flex-shrink:0;">
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

        cachedBudgets = budgets;
        renderBudgetVsActualChart(budgets);
        renderFinancialInsights(allExpenses);
    } catch (e) {
        console.error("Budget Error", e);
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

elements.addBudgetBtn.addEventListener("click", () => {
    budgetCategorySelect.innerHTML = allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    setBudgetForm.reset();
    if (customBudgetDates) customBudgetDates.hidden = true;
    openModal(setBudgetModal);
});

// Edit Budget — pre-fill the budget modal with existing values and re-open it
window.openEditBudget = (budgetId, categoryId, categoryName, limit, period, startDate, endDate) => {
    // Rebuild category list with the target selected
    budgetCategorySelect.innerHTML = allCategories.map(c =>
        `<option value="${c.id}"${c.id === categoryId ? ' selected' : ''}>${c.name}</option>`
    ).join("");

    // Pre-fill limit, period and dates
    const limitInput = document.getElementById("budgetLimitAmount");
    if (limitInput) limitInput.value = limit;
    if (budgetPeriod) {
        budgetPeriod.value = period || "MONTHLY";
        if (customBudgetDates) customBudgetDates.hidden = budgetPeriod.value !== "CUSTOM";
    }
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

budgetPeriod?.addEventListener("change", () => {
    if (customBudgetDates) customBudgetDates.hidden = budgetPeriod.value !== "CUSTOM";
});

setBudgetForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = setBudgetForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return; // a submission is already in flight

    const catId = parseInt(budgetCategorySelect.value);
    const limit = parseFloat(document.getElementById("budgetLimitAmount").value);
    const period = budgetPeriod.value;
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

elements.filterSearch.addEventListener('input', debounce(applyFilters, 250));

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
function animateNumber(el, target, isCurrency = false) {
    if (!el) return;
    const duration = 850;
    const startTime = performance.now();
    const startVal = parseFloat(el.getAttribute('data-val') || 0);
    el.setAttribute('data-val', target);

    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const easeOutBack = 1 + 2.70158 * Math.pow(progress - 1, 3) + 1.70158 * Math.pow(progress - 1, 2);
        const current = startVal + (target - startVal) * Math.min(Math.max(easeOutBack, 0), 1);
        el.textContent = isCurrency ? formatCurrency(current) : Math.round(current);
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = isCurrency ? formatCurrency(target) : target;
        }
    }
    requestAnimationFrame(step);
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
    if (expenses.length === 0) {
        elements.expenseList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💸</div>
                <div class="empty-state-title">No transactions yet</div>
                <div class="empty-state-sub">Click <strong>Record Expense</strong> to add your first transaction and start tracking your finances.</div>
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
                <h4 class="expense-title">${exp.description}</h4>
                <div class="expense-meta" style="display:flex; align-items:center; gap:8px; margin-top:4px; flex-wrap:wrap;">
                    <span>${formatDate(exp.expenseDate)}</span>
                    <span class="cat-chip" style="background:${catColor.bg}; color:${catColor.color}; border:1px solid ${catColor.color}30;">${catName}</span>
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
    const opts = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    elements.categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>' + opts;
}

function populateFilterDropdowns(categories, expenses) {
    if (categories && categories.length > 0) {
        const currentVal = elements.filterCategory ? elements.filterCategory.value : "all";
        const catOpts = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        elements.filterCategory.innerHTML = '<option value="all">All Categories</option>' + catOpts;
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
        return `<button class="pill-chip ${isActive ? 'active' : ''}" data-category="${cat.name}">${icon} ${cat.name}</button>`;
    }).join("");

    pillsBar.innerHTML = allChip + catChips;

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

// Modal Controls
document.getElementById("openModalBtn").addEventListener("click", () => {
    elements.addForm.reset();
    document.getElementById("expenseId").value = "";
    document.getElementById("date").value = getLocalDateString();
    elements.isRecurring.checked = false;
    elements.isRecurring.parentElement.style.display = "flex";
    elements.recurringOptions.hidden = true;
    elements.recurringOptions.style.display = "none";
    if (elements.recurringFrequency) elements.recurringFrequency.value = "MONTHLY";
    syncRecurringIntervalVisibility();
    document.querySelector(".modal h3").textContent = "Add Expense";
    document.querySelector(".modal button[type='submit']").textContent = "Save Expense";
    openModal(elements.modal);
});

document.getElementById("closeExpenseModalBtn")?.addEventListener("click", () => closeModal(elements.modal));

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
    const listEl = document.getElementById("manageCategoriesList");
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
                <span style="font-size:14px; color:var(--text-main);">${cat.name}</span>
                <button type="button" class="btn-icon" data-delete-category="${cat.id}" data-category-name="${cat.name}"
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

// Charts are canvas-drawn and don't pick up CSS variable changes on their
// own — re-render them once the theme has actually changed, not on the
// raw click (which could fire before the theme-toggle listener in api.js
// depending on event order, leaving charts one click behind).
document.addEventListener("themechange", () => {
    if (typeof applyFilters === "function") applyFilters();
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
            updateModalLabels();
            applyFilters();
            updateProMetrics(allExpenses);
        });
    });

    document.addEventListener("click", () => {
        dashCurrWrapper.classList.remove("open");
    });
}

function updateModalLabels() {
    const sym = typeof getCurrencySymbol === "function" ? getCurrencySymbol() : "$";
    document.querySelectorAll("label").forEach(lbl => {
        if (lbl.textContent.includes("Amount")) {
            lbl.textContent = `Amount (${sym})`;
        } else if (lbl.textContent.includes("Monthly Limit")) {
            lbl.textContent = `Monthly Limit Amount (${sym})`;
        }
    });
}
updateModalLabels();

elements.profileTrigger.addEventListener("click", (e) => { e.stopPropagation(); elements.profileMenu.classList.toggle("active"); });
document.addEventListener("click", (e) => { if (!elements.profileTrigger.contains(e.target) && !elements.profileMenu.contains(e.target)) elements.profileMenu.classList.remove("active"); });
document.getElementById("logoutBtn").addEventListener("click", () => { localStorage.clear(); window.location.href = "index.html"; });

const sendMonthlyReportBtn = document.getElementById("sendMonthlyReportBtn");
if (sendMonthlyReportBtn) {
    // Adapt menu item based on server email availability
    (async () => {
        try {
            const authConfig = await apiRequest("/auth/config", { method: "GET" });
            if (authConfig && authConfig.emailVerificationEnabled === false) {
                sendMonthlyReportBtn.innerHTML = "📊 Export Monthly Summary";
                sendMonthlyReportBtn.setAttribute("title", "Export your current monthly financial breakdown");
            }
        } catch (e) {
            // Ignore config lookup errors on legacy servers
        }
    })();

    sendMonthlyReportBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        elements.profileMenu.classList.remove("active");
        try {
            const authConfig = await apiRequest("/auth/config", { method: "GET" }).catch(() => ({ emailVerificationEnabled: false }));
            if (authConfig && authConfig.emailVerificationEnabled === false) {
                // Email service disabled: download the same HTML template used for the email
                showToast("Email delivery is disabled on this server. Downloading monthly report...", "info");
                const res = await fetch(`${API_BASE_URL}/reports/monthly/user/${userId}/html`, {
                    headers: { "Authorization": `Bearer ${authToken}` }
                });
                if (!res.ok) {
                    throw new Error(`Failed to generate report (${res.status})`);
                }
                const html = await res.text();
                const blob = new Blob([html], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `monthly-report-${new Date().toISOString().slice(0, 7)}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast("Monthly financial report downloaded.", "success");
                return;
            }

            showToast("Sending monthly report to your email...", "info");
            await apiRequest(`/reports/monthly/user/${userId}/send-email`, { method: "POST" });
            showToast("Monthly financial report email sent successfully!", "success");
        } catch (err) {
            showToast(err.message || "Failed to process monthly report", "error");
        }
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
                localStorage.setItem("userCurrency", profile.currency);
                if (typeof setCurrencySymbol === "function") {
                    setCurrencySymbol(profile.currency);
                }
                syncCurrencyDropdown(profile.currency);
                updateModalLabels();
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
// Fetching as a blob also keeps the token out of the browser's history and
// server access logs entirely.
async function downloadAuthenticated(url, fallbackFilename, loadingMessage) {
    showToast(loadingMessage, "info");
    try {
        const res = await fetch(url, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        if (!res.ok) {
            throw new Error(`Export failed (${res.status})`);
        }
        const disposition = res.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match ? match[1] : fallbackFilename;

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
        showToast(`${filename} downloaded.`, "success");
    } catch (err) {
        showToast(err.message || "Export failed", "error");
    }
}

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

    const isJson = file.name.toLowerCase().endsWith(".json");
    const endpoint = isJson ? `/expenses/user/${userId}/import/json` : `/expenses/user/${userId}/import/csv`;

    try {
        setLoading(true, "Importing file...");
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
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
    elements.profileMenu.classList.remove("active");
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
elements.closeSubsBtn.addEventListener("click", () => {
    closeModal(elements.subsModal);
});
elements.subsModal?.addEventListener("click", (e) => {
    if (e.target === elements.subsModal) closeModal(elements.subsModal);
});

// Load List (With Edit & Delete Buttons)
async function loadSubscriptions() {
    elements.subsList.innerHTML = '<p class="text-muted">Loading active subscriptions...</p>';

    try {
        const subs = await apiRequest(`/expenses/recurring/user/${userId}`);

        if (!subs || subs.length === 0) {
            elements.subsList.innerHTML = '<p class="text-muted">No active subscriptions found.</p>';
            return;
        }

        elements.subsList.innerHTML = subs.map(sub => {
            const freqLabel = formatFrequency(sub);
            const freqColor = 'var(--text-muted)';
            return `
            <div class="sub-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px 12px; border-bottom:1px solid var(--border); margin-bottom:8px; border-radius:12px; background:var(--card-bg); transition:background 0.2s;" onmouseenter="this.style.background='var(--input-bg)'" onmouseleave="this.style.background='var(--card-bg)'">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; color:var(--text-main); margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sub.description}</div>
                    <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                        <span>Next: <span style="color:var(--accent); font-weight:600;">${formatDate(sub.nextDueDate)}</span></span>
                        <span style="opacity:0.4;">•</span>
                        <span style="font-weight:600; color:var(--text-main);">${formatCurrency(sub.amount)}</span>
                        <span style="opacity:0.4;">•</span>
                        <span style="background:rgba(var(--ink-rgb),0.06); color:${freqColor}; border:1px solid var(--border); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px; letter-spacing:0.04em; text-transform:uppercase;">${freqLabel}</span>
                        <span style="opacity:0.7; font-size:11px; color:var(--text-muted);">${sub.categoryName}</span>
                    </div>
                </div>
                <div style="display:flex; gap:10px; flex-shrink:0; margin-left:12px;">
                    <button onclick="openEditSubscription(${sub.id}, '${sub.description.replace(/'/g, "\\'")}',' ${sub.amount}', '${sub.nextDueDate}', '${sub.frequency || 'MONTHLY'}', ${sub.intervalDays || 1})" class="btn-edit" title="Edit Subscription" style="height:32px; width:32px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="cancelSubscription(${sub.id}, event)" class="btn-delete" title="Cancel Subscription" style="height:32px; width:32px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>`;
        }).join("");

    } catch (error) {
        elements.subsList.innerHTML = `<p style="color:var(--danger)">Error: ${error.message}</p>`;
    }
}

const editSubModal = document.getElementById("editSubModal");
const editSubForm = document.getElementById("editSubForm");

window.openEditSubscription = (id, desc, amount, nextDueDate, frequency = 'MONTHLY', intervalDays = 1) => {
    document.getElementById("editSubId").value = id;
    document.getElementById("editSubDesc").value = desc.trim();
    document.getElementById("editSubAmount").value = amount;
    document.getElementById("editSubNextDate").value = nextDueDate;
    const freqSelect = document.getElementById("editSubFrequency");
    if (freqSelect) freqSelect.value = frequency;
    const intervalInput = document.getElementById("editSubIntervalDays");
    if (intervalInput) intervalInput.value = intervalDays || 1;
    const intervalWrap = document.getElementById("editSubIntervalWrap");
    if (intervalWrap) intervalWrap.hidden = frequency !== "CUSTOM";
    openModal(editSubModal);
};

// Toggle custom interval field inside edit subscription form
document.getElementById("editSubFrequency")?.addEventListener("change", (e) => {
    const wrap = document.getElementById("editSubIntervalWrap");
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

// Open the delete account confirmation modal
elements.deleteAccountBtn.addEventListener("click", (e) => {
    e.preventDefault();
    elements.profileMenu.classList.remove("active");
    elements.deleteConfirmInput.value = "";
    elements.confirmDeleteAccountBtn.style.opacity = "0.5";
    elements.confirmDeleteAccountBtn.style.pointerEvents = "none";
    openModal(elements.deleteAccountModal);
    setTimeout(() => elements.deleteConfirmInput.focus(), 150);
});

// Enable the confirm button only when user types "DELETE"
elements.deleteConfirmInput.addEventListener("input", () => {
    const isValid = elements.deleteConfirmInput.value.trim() === "DELETE";
    elements.confirmDeleteAccountBtn.style.opacity = isValid ? "1" : "0.5";
    elements.confirmDeleteAccountBtn.style.pointerEvents = isValid ? "auto" : "none";
});

// Close modal on cancel
elements.cancelDeleteAccountBtn.addEventListener("click", () => {
    closeModal(elements.deleteAccountModal);
    elements.deleteConfirmInput.value = "";
});

// Close modal on overlay click
elements.deleteAccountModal.addEventListener("click", (e) => {
    if (e.target === elements.deleteAccountModal) {
        closeModal(elements.deleteAccountModal);
        elements.deleteConfirmInput.value = "";
    }
});

// Confirm deletion — calls DELETE /api/users/{userId}
elements.confirmDeleteAccountBtn.addEventListener("click", async () => {
    if (elements.deleteConfirmInput.value.trim() !== "DELETE") return;

    elements.confirmDeleteAccountBtn.classList.add("btn-loading");
    elements.confirmDeleteAccountBtn.style.pointerEvents = "none";

    try {
        await apiRequest(`/users/${userId}`, { method: "DELETE" });
        localStorage.clear();
        window.location.href = "index.html";
    } catch (err) {
        showToast(err.message, "error");
        elements.confirmDeleteAccountBtn.classList.remove("btn-loading");
        elements.confirmDeleteAccountBtn.style.opacity = "1";
        elements.confirmDeleteAccountBtn.style.pointerEvents = "auto";
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
