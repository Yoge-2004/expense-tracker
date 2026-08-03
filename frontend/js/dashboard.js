const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName") || "User";

if (!token || !userId) window.location.href = "index.html";

// UI Setup
document.querySelector(".top-bar p").textContent = `Welcome back, ${userName}`;
document.querySelector(".avatar").textContent = userName.charAt(0).toUpperCase();

// Helpers
const formatCurrency = (amt) => (typeof formatGlobalCurrency === "function" ? formatGlobalCurrency(amt) : `${typeof getCurrencySymbol === "function" ? getCurrencySymbol() : "$"} ${Number(amt || 0).toFixed(2)}`);
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// Global State
let allExpenses = [];
let allCategories = [];
let pieChart = null;
let trendChart = null;

const elements = {
    totalAmount: document.getElementById("totalAmount"),
    expenseCount: document.getElementById("expenseCount"),
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
    allExpenses = expenses;

    populateCategoryDropdown(allCategories);
    populateFilterDropdowns(allCategories, expenses);

    applyFilters();
    renderTrendChart(expenses);
    loadBudgets();
    updateProMetrics(expenses);
}

async function loadDashboard() {
    const cached = loadExpenseCache();
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
        const activeSubs = safeSubs.filter(s => s.status === 'ACTIVE');
        const monthlyTotal = activeSubs.reduce((acc, s) => acc + Number(s.amount || 0), 0);

        const subsBadge = document.getElementById("subsCountBadge");
        if (subsBadge) subsBadge.textContent = `${activeSubs.length} Active`;
        const subsTotal = document.getElementById("subsMonthlyTotal");
        if (subsTotal) subsTotal.textContent = `${formatCurrency(monthlyTotal)} / mo`;
    } catch (err) {
        console.error("Subs fetch error", err);
    }
}

// Keyboard Shortcuts & Category Pill Bar Handlers
document.addEventListener("keydown", (e) => {
    if ((e.key === '/' || (e.metaKey && e.key === 'k') || (e.ctrlKey && e.key === 'k')) && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        elements.filterSearch?.focus();
    }
});

document.querySelectorAll(".pill-chip").forEach(chip => {
    chip.addEventListener("click", () => {
        document.querySelectorAll(".pill-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        const category = chip.getAttribute("data-category");
        if (elements.filterCategory) {
            if (category === "all") {
                elements.filterCategory.value = "all";
            } else {
                const options = Array.from(elements.filterCategory.options);
                const matchedOption = options.find(opt => opt.text.toLowerCase().includes(category));
                elements.filterCategory.value = matchedOption ? matchedOption.value : "all";
            }
            applyFilters();
        }
    });
});

// --- 2. BUDGET LOGIC ---
async function loadBudgets() {
    try {
        const budgets = await apiRequest(`/expenses/budget/status/user/${userId}`);

        if (!budgets || budgets.length === 0) {
            elements.budgetList.innerHTML = `<p class="text-muted" style="font-size:13px; text-align:center;">No budgets set.</p>`;
            return;
        }

        elements.budgetList.innerHTML = budgets.map(b => {
            const pct = Math.min(b.percentage || 0, 100);
            let barColor, badgeClass;
            if (b.percentage > 100) { barColor = 'var(--danger)'; badgeClass = 'badge-danger'; }
            else if (b.percentage > 80) { barColor = 'var(--warning)'; badgeClass = 'badge-warning'; }
            else { barColor = 'var(--primary)'; badgeClass = 'badge-primary'; }

            const catColor = getCategoryColor(b.categoryName);
            const periodLabel = b.period ? b.period.toUpperCase() : 'MONTHLY';
            return `
            <div class="budget-item">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; border-radius:10px; background:${catColor.bg}; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">${getCategoryEmoji(b.categoryName)}</div>
                        <div>
                            <div style="font-size:14px; font-weight:700; color:var(--text-main);">${b.categoryName}</div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${formatCurrency(b.spent)} of ${formatCurrency(b.limit)} <span class="status-badge ${badgeClass}" style="margin-left:4px;">${periodLabel}</span></div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:13px; font-weight:800; color:${barColor};">${(b.percentage || 0).toFixed(0)}%</span>
                        <button onclick="deleteBudgetLimit(${b.budgetId || 0}, ${b.categoryId || 0})" class="btn-delete" title="Delete Budget Limit" style="height:28px; width:28px; padding:0; flex-shrink:0;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                <div class="budget-bar-track">
                    <div class="budget-bar-fill" style="width:${pct}%; background:${barColor};"></div>
                </div>
            </div>`;
        }).join("");
    } catch (e) {
        console.error("Budget Error", e);
    }
}

window.deleteBudgetLimit = async (budgetId, categoryId) => {
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
    customBudgetDates.hidden = true;
    setBudgetModal.classList.add("active");
});

document.getElementById("closeBudgetModalBtn")?.addEventListener("click", () => {
    setBudgetModal.classList.remove("active");
});

budgetPeriod?.addEventListener("change", () => {
    customBudgetDates.hidden = budgetPeriod.value !== "CUSTOM";
});

setBudgetForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const catId = parseInt(budgetCategorySelect.value);
    const limit = parseFloat(document.getElementById("budgetLimitAmount").value);
    const period = budgetPeriod.value;
    const startDate = document.getElementById("budgetStartDate").value || null;
    const endDate = document.getElementById("budgetEndDate").value || null;

    if (isNaN(limit) || limit <= 0) return showToast("Limit amount must be greater than 0", "error");

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
        setBudgetModal.classList.remove("active");
        loadBudgets();
    } catch (err) { showToast(err.message, "error"); }
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


// --- 4. FILTERING (With Validation) ---
function applyFilters() {
    let filtered = [...allExpenses];
    const search = elements.filterSearch.value.toLowerCase();
    const startDate = elements.filterStartDate.value;
    const endDate = elements.filterEndDate.value;

    // Date Range Validation
    if (startDate && endDate) {
        if (new Date(startDate) > new Date(endDate)) {
            showToast("Start date cannot be after end date.", "error");
            elements.filterEndDate.value = "";
            return;
        }
    }

    // 1. Search
    if (search) filtered = filtered.filter(e => e.description.toLowerCase().includes(search) || (e.categoryName && e.categoryName.toLowerCase().includes(search)));

    // 2. Category
    if (elements.filterCategory.value !== 'all') filtered = filtered.filter(e => e.categoryName === elements.filterCategory.value);

    // 3. Date
    if (startDate || endDate) {
        if (startDate) filtered = filtered.filter(e => e.expenseDate >= startDate);
        if (endDate) filtered = filtered.filter(e => e.expenseDate <= endDate);
    } else {
        if (elements.filterMonth.value !== 'all') filtered = filtered.filter(e => new Date(e.expenseDate).getMonth() === parseInt(elements.filterMonth.value));
        if (elements.filterYear.value !== 'all') filtered = filtered.filter(e => new Date(e.expenseDate).getFullYear() === parseInt(elements.filterYear.value));
    }

    // 4. Sort
    const sort = elements.filterSort.value;
    filtered.sort((a, b) => {
        if (sort === 'date-desc') return new Date(b.expenseDate) - new Date(a.expenseDate);
        if (sort === 'date-asc') return new Date(a.expenseDate) - new Date(b.expenseDate);
        if (sort === 'amount-desc') return b.amount - a.amount;
        if (sort === 'amount-asc') return a.amount - b.amount;
        return 0;
    });

    updateStats(filtered);
    renderPieChart(filtered);
    renderList(filtered);
    renderTrendChart(filtered);
}

[elements.filterSearch, elements.filterSort, elements.filterCategory, elements.filterStartDate, elements.filterEndDate, elements.filterMonth, elements.filterYear]
    .forEach(el => el.addEventListener('input', applyFilters));


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
    animateNumber(elements.expenseCount, expenses.length, false);
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
    elements.expenseList.innerHTML = expenses.map(exp => {
        const catColor = getCategoryColor(exp.categoryName);
        const catName = exp.categoryName || 'General';
        const isRecurring = exp.recurring || exp.isRecurring;
        return `
        <div class="expense-item">
            <div style="width:42px; height:42px; border-radius:12px; background:${catColor.bg}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <span style="font-size:18px;">${getCategoryEmoji(catName)}</span>
            </div>
            <div class="expense-info" style="flex:1; min-width:0;">
                <h4 style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${exp.description}</h4>
                <div class="expense-meta" style="display:flex; align-items:center; gap:8px; margin-top:3px;">
                    <span>${formatDate(exp.expenseDate)}</span>
                    <span class="cat-chip" style="background:${catColor.bg}; color:${catColor.color}; border:1px solid ${catColor.color}30;">${catName}</span>
                    ${isRecurring ? '<span style="font-family:var(--font-mono); font-size:9px; letter-spacing:0.08em; font-weight:600; color:var(--accent); background:rgba(162,62,50,0.08); padding:2px 8px; border-radius:3px; border:1px solid rgba(162,62,50,0.35);">⟳ RECURRING</span>' : ''}
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                <div class="expense-amount" style="font-family:var(--font-mono); font-variant-numeric:tabular-nums; color:var(--text-main); font-size:15px; font-weight:600;">${formatCurrency(exp.amount)}</div>
                <button class="btn-edit" onclick="editExpense(${exp.id})" title="Edit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-delete" onclick="deleteExpense(${exp.id})" title="Delete">
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
        const catOpts = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        elements.filterCategory.innerHTML = '<option value="all">All Categories</option>' + catOpts;
    }

    if (expenses && expenses.length > 0) {
        const years = [...new Set(expenses.map(e => new Date(e.expenseDate).getFullYear()))].sort((a, b) => b - a);
        const yearOpts = years.map(y => `<option value="${y}">${y}</option>`).join('');
        elements.filterYear.innerHTML = '<option value="all">All Years</option>' + yearOpts;
    }
}


// --- 6. ACTIONS (Forms & Buttons) ---

// Handle Add/Edit Form Submit
elements.addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
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

        elements.modal.classList.remove("active");
        elements.addForm.reset();
        loadDashboard();
    } catch (err) { showToast(err.message, "error"); }
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
    elements.modal.classList.add("active");
};

window.deleteExpense = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
        await apiRequest(`/expenses/${id}/user/${userId}`, { method: 'DELETE' });
        showToast("Expense deleted.", "success");
        loadDashboard();
    } catch (err) { showToast(err.message, "error"); }
};

// Modal Controls
document.getElementById("openModalBtn").addEventListener("click", () => {
    elements.addForm.reset();
    document.getElementById("expenseId").value = "";
    document.getElementById("date").value = new Date().toISOString().split("T")[0];
    elements.isRecurring.parentElement.style.display = "flex";
    elements.recurringOptions.hidden = !elements.isRecurring.checked;
    document.querySelector(".modal h3").textContent = "Add Expense";
    document.querySelector(".modal button[type='submit']").textContent = "Save Expense";
    elements.modal.classList.add("active");
});

document.getElementById("closeExpenseModalBtn")?.addEventListener("click", () => elements.modal.classList.remove("active"));

// Close expense modal when clicking the backdrop (outside the modal card)
elements.modal?.addEventListener("click", (e) => {
    if (e.target === elements.modal) elements.modal.classList.remove("active");
});

// Close any open modal on Escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        elements.modal?.classList.remove("active");
        setBudgetModal?.classList.remove("active");
    }
});


elements.isRecurring.addEventListener("change", () => {
    elements.recurringOptions.hidden = !elements.isRecurring.checked;
});
elements.recurringFrequency.addEventListener("change", () => {
    elements.customIntervalWrap.hidden = elements.recurringFrequency.value !== "CUSTOM";
});

// Add Category
elements.addCategoryBtn.addEventListener("click", async () => {
    const name = prompt("Enter new category name:");
    if (!name) return;
    try {
        const newCat = await apiRequest(`/categories/user/${userId}`, { method: "POST", body: JSON.stringify({ name: name }) });
        allCategories.push(newCat);
        const option = document.createElement("option"); option.value = newCat.id; option.textContent = newCat.name; option.selected = true; elements.categorySelect.appendChild(option);
    } catch (error) { showToast(error.message, "error"); }
});

elements.toggleFiltersBtn.addEventListener("click", () => { elements.filterPanel.classList.toggle("active"); });

// Theme Logic
const savedTheme = localStorage.getItem("theme") || "dark";
document.body.setAttribute("data-theme", savedTheme);
if (typeof updateAllThemeIcons === "function") updateAllThemeIcons(savedTheme);

if (elements.themeToggle) {
    elements.themeToggle.addEventListener("click", () => {
        if (typeof applyFilters === "function") applyFilters();
    });
}

// Profile, Dynamic 50-Currency Custom Select & Export
const dashCurrWrapper = document.getElementById("dashCurrencyWrapper");
const dashCurrTrigger = document.getElementById("dashCurrencyTrigger");
const dashCurrLabel = document.getElementById("dashCurrencyLabel");
const currencySelector = document.getElementById("currencySelector");

if (dashCurrTrigger && dashCurrWrapper && typeof WORLD_CURRENCIES !== "undefined") {
    const optionsContainer = dashCurrWrapper.querySelector(".custom-select-options");
    const activeCurr = typeof getSelectedCurrency === "function" ? getSelectedCurrency() : "USD";
    if (currencySelector) currencySelector.value = activeCurr;

    optionsContainer.innerHTML = `
        <input type="text" class="custom-select-search" placeholder="Search 50+ currencies...">
        <div class="custom-options-list">
            ${WORLD_CURRENCIES.map(item => `
                <div class="custom-option ${item.code === activeCurr ? 'selected' : ''}" data-value="${item.code}" data-name="${item.name.toLowerCase()}" data-symbol="${item.symbol.toLowerCase()}">
                    <span><span class="custom-option-flag">${item.flag}</span> ${item.code} (${item.symbol}) — ${item.name}</span>
                </div>
            `).join('')}
        </div>
    `;

    const searchInput = optionsContainer.querySelector(".custom-select-search");
    const optionsList = optionsContainer.querySelectorAll(".custom-option");

    const initialItem = WORLD_CURRENCIES.find(c => c.code === activeCurr) || WORLD_CURRENCIES[0];
    if (dashCurrLabel && initialItem) {
        dashCurrLabel.textContent = `${initialItem.flag} ${initialItem.code} (${initialItem.symbol})`;
    }

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
            optionsList.forEach(o => o.classList.remove("selected"));
            opt.classList.add("selected");
            const newCurr = opt.getAttribute("data-value");
            const item = WORLD_CURRENCIES.find(c => c.code === newCurr);
            if (currencySelector) currencySelector.value = newCurr;
            if (dashCurrLabel && item) dashCurrLabel.textContent = `${item.flag} ${item.code} (${item.symbol})`;
            dashCurrWrapper.classList.remove("open");

            localStorage.setItem("userCurrency", newCurr);
            showToast(`Currency updated to ${newCurr} (${getCurrencySymbol()})`, "success");
            updateModalLabels();
            applyFilters();
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

// --- EXPORT & IMPORT CONTROLS ---
const authToken = localStorage.getItem("token");

document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
    window.open(`${API_BASE_URL}/expenses/user/${userId}/export/csv?token=${authToken}`);
    showToast("Exporting CSV...", "info");
});

document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
    window.open(`${API_BASE_URL}/expenses/user/${userId}/export/json?token=${authToken}`);
    showToast("Exporting JSON...", "info");
});

document.getElementById("exportPdfBtn")?.addEventListener("click", () => {
    window.open(`${API_BASE_URL}/expenses/user/${userId}/export/pdf?token=${authToken}`);
    showToast("Generating PDF report...", "info");
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
        showToast(data.message || "Expenses imported successfully!", "success");
        loadDashboard();
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
    elements.subsModal.classList.add("active");
    loadSubscriptions();
});

// Close Modal
elements.closeSubsBtn.addEventListener("click", () => {
    elements.subsModal.classList.remove("active");
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

        elements.subsList.innerHTML = subs.map(sub => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border); margin-bottom:8px;">
                <div>
                    <div style="font-weight:600; color:var(--text-main);">${sub.description}</div>
                    <div style="font-size:12px; color:var(--text-muted);">
                        Next Due: <span style="color:var(--accent);">${formatDate(sub.nextDueDate)}</span> • ${formatCurrency(sub.amount)}
                        <br>
                        <span style="opacity:0.7; font-size:11px;">${sub.categoryName} • ${formatFrequency(sub)}</span>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="openEditSubscription(${sub.id}, '${sub.description.replace(/'/g, "\\'")}', '${sub.amount}', '${sub.nextDueDate}')" class="btn-edit" title="Edit Subscription" style="height:32px; width:32px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="cancelSubscription(${sub.id})" class="btn-delete" title="Cancel Subscription" style="height:32px; width:32px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
        `).join("");

    } catch (error) {
        elements.subsList.innerHTML = `<p style="color:var(--danger)">Error: ${error.message}</p>`;
    }
}

const editSubModal = document.getElementById("editSubModal");
const editSubForm = document.getElementById("editSubForm");

window.openEditSubscription = (id, desc, amount, nextDueDate) => {
    document.getElementById("editSubId").value = id;
    document.getElementById("editSubDesc").value = desc;
    document.getElementById("editSubAmount").value = amount;
    document.getElementById("editSubNextDate").value = nextDueDate;
    editSubModal.classList.add("active");
};

document.getElementById("closeEditSubModalBtn")?.addEventListener("click", () => {
    editSubModal.classList.remove("active");
});

editSubForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editSubId").value;
    const desc = document.getElementById("editSubDesc").value;
    const amount = parseFloat(document.getElementById("editSubAmount").value);
    const nextDueDate = document.getElementById("editSubNextDate").value;

    if (isNaN(amount) || amount <= 0) return showToast("Amount must be greater than 0", "error");

    try {
        await apiRequest(`/expenses/recurring/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                description: desc,
                amount: amount,
                nextDueDate: nextDueDate
            })
        });
        showToast("Subscription updated successfully.", "success");
        editSubModal.classList.remove("active");
        loadSubscriptions();
    } catch (e) {
        showToast(e.message, "error");
    }
});

// Cancel Logic
window.cancelSubscription = async (id) => {
    if (!confirm("Are you sure you want to cancel this recurring subscription? Future auto-payments will stop.")) return;

    try {
        await apiRequest(`/expenses/recurring/${id}`, { method: "DELETE" });
        showToast("Subscription cancelled.", "success");
        loadSubscriptions();
    } catch (err) {
        showToast(err.message, "error");
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
    elements.deleteAccountModal.classList.add("active");
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
    elements.deleteAccountModal.classList.remove("active");
    elements.deleteConfirmInput.value = "";
});

// Close modal on overlay click
elements.deleteAccountModal.addEventListener("click", (e) => {
    if (e.target === elements.deleteAccountModal) {
        elements.deleteAccountModal.classList.remove("active");
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
