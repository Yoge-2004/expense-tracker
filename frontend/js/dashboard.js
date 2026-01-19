const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName") || "User";

if (!token || !userId) window.location.href = "index.html";

// Update UI with User Info
document.querySelector(".top-bar p").textContent = `Welcome back, ${userName}`;
document.querySelector(".avatar").textContent = userName.charAt(0).toUpperCase();

// Helper: Currency Formatter
const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
};

// Global State
let allExpenses = [];
let chartInstance = null;

const elements = {
    totalAmount: document.getElementById("totalAmount"),
    expenseCount: document.getElementById("expenseCount"),
    expenseList: document.getElementById("expenseList"),
    filterSearch: document.getElementById("filterSearch"),
    filterSort: document.getElementById("filterSort"),
    filterMonth: document.getElementById("filterMonth"),
    filterYear: document.getElementById("filterYear"),
    filterCategory: document.getElementById("filterCategory"),
    modal: document.getElementById("expenseModal"),
    categorySelect: document.getElementById("categorySelect"),
    addCategoryBtn: document.getElementById("addCategoryBtn"),
    addForm: document.getElementById("addExpenseForm"),
    profileMenu: document.getElementById("profileMenu"),
    profileTrigger: document.getElementById("profileTrigger"),
    toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
    filterPanel: document.getElementById("filterPanel")
};

// --- INITIALIZATION ---
async function loadDashboard() {
    try {
        const [expenses, globalCats, userCats] = await Promise.all([
            apiRequest(`/expenses/user/${userId}`),
            apiRequest(`/categories/global`),
            apiRequest(`/categories/user/${userId}`)
        ]);

        allExpenses = expenses;
        const allCategories = [...globalCats, ...userCats];

        populateCategoryDropdown(allCategories);
        populateFilterDropdowns(allCategories, expenses);
        applyFilters(); // Renders list and stats
    } catch (error) {
        console.error(error);
        if (error.message.includes("User not found")) {
            localStorage.clear();
            window.location.href = "index.html";
        }
    }
}

// --- RENDERING ---
function renderList(expenses) {
    if (expenses.length === 0) {
        elements.expenseList.innerHTML = `<p style="text-align:center; color:#555; margin-top:20px;">No expenses found.</p>`;
        return;
    }

    elements.expenseList.innerHTML = expenses.map(exp => `
        <div class="expense-item">
            <div class="expense-info">
                <h4>${exp.description}</h4>
                <div class="expense-meta">
                    ${formatDate(exp.expenseDate)} • <span style="color:#FF9F6E">${exp.categoryName || 'General'}</span>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap: 16px;">
                <div class="expense-amount">${formatCurrency(exp.amount)}</div>
                
                <button class="btn-delete" onclick="deleteExpense(${exp.id})" title="Delete">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join("");
}

function renderChart(expenses) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const categoryTotals = {};
    
    // Calculate totals
    expenses.forEach(exp => { 
        const cat = exp.categoryName || 'Uncategorized'; 
        categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount; 
    });

    if (chartInstance) chartInstance.destroy();

    // Chart Configuration
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { 
            labels: Object.keys(categoryTotals), 
            datasets: [{ 
                data: Object.values(categoryTotals), 
                backgroundColor: ['#FF9F6E', '#FF7A3D', '#64D2FF', '#A084FF', '#34C759', '#FFD60A'], 
                borderWidth: 0 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { 
                    position: 'right', 
                    labels: { 
                        color: '#9AA0AE', 
                        // ✅ UPDATED: Bigger font and box for better readability
                        font: { size: 13, family: "'Plus Jakarta Sans', sans-serif" }, 
                        boxWidth: 14,
                        padding: 15
                    } 
                },
                tooltip: {
                    bodyFont: { size: 14 },
                    titleFont: { size: 14 }
                }
            } 
        }
    });
}

function updateStats(expenses) {
    elements.totalAmount.textContent = formatCurrency(expenses.reduce((sum, exp) => sum + exp.amount, 0));
    elements.expenseCount.textContent = expenses.length;
}

// --- FILTERS ---
function populateFilterDropdowns(categories, expenses) {
    const catOpts = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    elements.filterCategory.innerHTML = '<option value="all">All Categories</option>' + catOpts;

    const years = [...new Set(expenses.map(e => new Date(e.expenseDate).getFullYear()))].sort((a, b) => b - a);
    const yearOpts = years.map(y => `<option value="${y}">${y}</option>`).join('');
    elements.filterYear.innerHTML = '<option value="all">All Years</option>' + yearOpts;
}

function applyFilters() {
    let filtered = [...allExpenses];
    const search = elements.filterSearch.value.toLowerCase();

    if (search) {
        filtered = filtered.filter(e =>
            e.description.toLowerCase().includes(search) ||
            (e.categoryName && e.categoryName.toLowerCase().includes(search))
        );
    }

    if (elements.filterCategory.value !== 'all') filtered = filtered.filter(e => e.categoryName === elements.filterCategory.value);
    if (elements.filterMonth.value !== 'all') filtered = filtered.filter(e => new Date(e.expenseDate).getMonth() === parseInt(elements.filterMonth.value));
    if (elements.filterYear.value !== 'all') filtered = filtered.filter(e => new Date(e.expenseDate).getFullYear() === parseInt(elements.filterYear.value));

    const sort = elements.filterSort.value;
    filtered.sort((a, b) => {
        if (sort === 'date-desc') return new Date(b.expenseDate) - new Date(a.expenseDate);
        if (sort === 'date-asc') return new Date(a.expenseDate) - new Date(b.expenseDate);
        if (sort === 'amount-desc') return b.amount - a.amount;
        if (sort === 'amount-asc') return a.amount - b.amount;
        return 0;
    });

    updateStats(filtered);
    renderChart(filtered);
    renderList(filtered);
}

// Event Listeners for Filters
[elements.filterSearch, elements.filterSort, elements.filterMonth, elements.filterYear, elements.filterCategory]
    .forEach(el => el.addEventListener('input', applyFilters));

// Toggle Filter Panel
elements.toggleFiltersBtn.addEventListener("click", () => {
    elements.filterPanel.classList.toggle("active");
    elements.toggleFiltersBtn.classList.toggle("active");
});

// --- ACTIONS (Delete, Add, Modal) ---
window.deleteExpense = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
        await apiRequest(`/expenses/${id}/user/${userId}`, { method: 'DELETE' });
        loadDashboard();
    } catch (err) { alert(err.message); }
};

// Delete Account Logic
document.getElementById("deleteAccountBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("Permanently delete account? This cannot be undone.")) return;
    try {
        await apiRequest(`/users/${userId}`, { method: 'DELETE' });
        localStorage.clear();
        window.location.href = "index.html";
    } catch (err) { alert(err.message); }
});

// Add Category
elements.addCategoryBtn.addEventListener("click", async () => {
    const name = prompt("Enter new category name:");
    if (!name) return;
    try {
        const newCat = await apiRequest(`/categories/user/${userId}`, {
            method: "POST",
            body: JSON.stringify({ name: name })
        });
        const option = document.createElement("option");
        option.value = newCat.id;
        option.textContent = newCat.name;
        option.selected = true;
        elements.categorySelect.appendChild(option);
    } catch (error) { alert("Failed: " + error.message); }
});

// Add Expense
elements.addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        await apiRequest(`/expenses/user/${userId}`, {
            method: "POST",
            body: JSON.stringify({
                description: document.getElementById("desc").value,
                amount: parseFloat(document.getElementById("amount").value),
                expenseDate: document.getElementById("date").value,
                categoryId: parseInt(elements.categorySelect.value)
            })
        });
        elements.modal.classList.remove("active");
        elements.addForm.reset();
        loadDashboard();
    } catch (err) { alert(err.message); }
});

function populateCategoryDropdown(categories) {
    const opts = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    elements.categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>' + opts;
}

// Modal Toggle
document.getElementById("openModalBtn").addEventListener("click", () => elements.modal.classList.add("active"));
document.getElementById("closeModalBtn").addEventListener("click", () => elements.modal.classList.remove("active"));

// --- PROFILE MENU TOGGLE FIX ---
elements.profileTrigger.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevents click from bubbling to document
    elements.profileMenu.classList.toggle("active");
});

document.addEventListener("click", (e) => {
    // If click is outside menu AND outside trigger, close it
    if (!elements.profileTrigger.contains(e.target) && !elements.profileMenu.contains(e.target)) {
        elements.profileMenu.classList.remove("active");
    }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
});

// Start
loadDashboard();