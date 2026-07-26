const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName") || "User";

if (!token || !userId) window.location.href = "index.html";

// UI Setup
document.querySelector(".top-bar p").textContent = `Welcome back, ${userName}`;
document.querySelector(".avatar").textContent = userName.charAt(0).toUpperCase();

// Helpers
const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
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

// --- 1. INITIALIZATION ---
async function loadDashboard() {
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
        allCategories = [...safeGlobal, ...safeUser];
        allExpenses = expenses;

        // Populate UI
        populateCategoryDropdown(allCategories);
        populateFilterDropdowns(allCategories, expenses);

        applyFilters();
        renderTrendChart(expenses);
        loadBudgets();
        updateProMetrics(expenses);

    } catch (error) {
        console.error("Critical Error:", error);
        if (error.message.includes("User not found")) {
            localStorage.clear();
            window.location.href = "index.html";
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
            let colorClass = "";
            if (b.percentage > 100) colorClass = "danger";
            else if (b.percentage > 80) colorClass = "warning";

            const periodLabel = b.period ? b.period.toUpperCase() : "MONTHLY";

            return `
            <div class="budget-item" style="margin-bottom:16px; padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--input-bg);">
                <div class="budget-info" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong style="color:var(--text-main); font-size:14px;">${b.categoryName}</strong>
                        <span class="badge" style="font-size:10px; padding:2px 6px; border-radius:6px; background:rgba(0,212,170,0.15); color:#00D4AA; margin-left:6px;">${periodLabel}</span>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${formatCurrency(b.spent)} / ${formatCurrency(b.limit)} (${b.percentage.toFixed(1)}%)</div>
                    </div>
                    <button onclick="deleteBudgetLimit(${b.budgetId || 0}, ${b.categoryId || 0})" class="btn-delete" title="Delete Budget Limit" style="height:30px; width:30px; padding:0;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="progress-track">
                    <div class="progress-fill ${colorClass}" style="width: ${Math.min(b.percentage, 100)}%"></div>
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

const setBudgetModal = document.getElementById("setBudgetModal");
const setBudgetForm = document.getElementById("setBudgetForm");
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
                backgroundColor: ['#00D4AA', '#FF6B35', '#3B82F6', '#FBBF24', '#10D9A0', '#A855F7'],
                borderWidth: 2,
                borderColor: document.body.getAttribute("data-theme") === "light" ? '#FFFFFF' : '#090D16'
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
    const textColor = isLight ? '#64748B' : '#94A3B8';

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
                borderColor: '#00D4AA',
                backgroundColor: (context) => getTrendGradient(context.chart),
                fill: 'origin',
                tension: 0.35,
                cubicInterpolationMode: 'monotone',
                borderWidth: 3,
                pointRadius: dates.length > 31 ? 0 : 3,
                pointHoverRadius: 6,
                pointBackgroundColor: isLight ? '#FFFFFF' : '#00D4AA',
                pointBorderColor: '#00B8D9',
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
    return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function getTrendGradient(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return 'rgba(0, 212, 170, 0.22)';
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, 'rgba(0, 212, 170, 0.35)');
    gradient.addColorStop(0.72, 'rgba(0, 212, 170, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 212, 170, 0.01)');
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
    if (expenses.length === 0) { elements.expenseList.innerHTML = `<p style="text-align:center; color:#555; margin-top:20px;">No expenses found.</p>`; return; }
    elements.expenseList.innerHTML = expenses.map(exp => `
        <div class="expense-item">
            <div class="expense-info">
                <h4>${exp.description}</h4>
                <div class="expense-meta">${formatDate(exp.expenseDate)} • <span style="color:var(--primary)">${exp.categoryName || 'General'}</span></div>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
                <div class="expense-amount" style="margin-right:8px;">${formatCurrency(exp.amount)}</div>
                <button class="btn-edit" onclick="editExpense(${exp.id})" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                <button class="btn-delete" onclick="deleteExpense(${exp.id})" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            </div>
        </div>
    `).join("");
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
    elements.isRecurring.parentElement.style.display = "flex";
    elements.recurringOptions.hidden = !elements.isRecurring.checked;
    document.querySelector(".modal h3").textContent = "Add Expense";
    document.querySelector(".modal button[type='submit']").textContent = "Save Expense";
    elements.modal.classList.add("active");
});

document.getElementById("closeModalBtn").addEventListener("click", () => elements.modal.classList.remove("active"));

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
updateThemeIcons(savedTheme);

elements.themeToggle.addEventListener("click", () => {
    const newTheme = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcons(newTheme);
    applyFilters();
});

function updateThemeIcons(theme) {
    const sun = document.querySelector(".sun-icon");
    const moon = document.querySelector(".moon-icon");
    if (theme === "dark") { sun.style.display = "block"; moon.style.display = "none"; }
    else { sun.style.display = "none"; moon.style.display = "block"; }
}

// Profile & Export
elements.profileTrigger.addEventListener("click", (e) => { e.stopPropagation(); elements.profileMenu.classList.toggle("active"); });
document.addEventListener("click", (e) => { if (!elements.profileTrigger.contains(e.target) && !elements.profileMenu.contains(e.target)) elements.profileMenu.classList.remove("active"); });
document.getElementById("logoutBtn").addEventListener("click", () => { localStorage.clear(); window.location.href = "index.html"; });

// --- EXPORT & IMPORT CONTROLS ---
const token = localStorage.getItem("token");

document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
    window.open(`${API_BASE_URL}/expenses/user/${userId}/export/csv?token=${token}`);
    showToast("Exporting CSV...", "info");
});

document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
    window.open(`${API_BASE_URL}/expenses/user/${userId}/export/json?token=${token}`);
    showToast("Exporting JSON...", "info");
});

document.getElementById("exportPdfBtn")?.addEventListener("click", () => {
    window.open(`${API_BASE_URL}/expenses/user/${userId}/export/pdf?token=${token}`);
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
