// Auth Check
const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName") || "User";

if (!token || !userId) window.location.href = "index.html";

// Update UI Name
document.querySelector(".top-bar p").textContent = `Welcome back, ${userName}`;
document.querySelector(".avatar").textContent = userName.charAt(0).toUpperCase();

// Formatters
const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
};

// Global Data Store (To hold raw data)
let allExpenses = []; 
let chartInstance = null;

const elements = {
    totalAmount: document.getElementById("totalAmount"),
    expenseCount: document.getElementById("expenseCount"),
    expenseList: document.getElementById("expenseList"),
    
    // Filters
    filterSearch: document.getElementById("filterSearch"),
    filterSort: document.getElementById("filterSort"),
    filterMonth: document.getElementById("filterMonth"),
    filterYear: document.getElementById("filterYear"),
    filterCategory: document.getElementById("filterCategory"),

    // Modal & Forms
    modal: document.getElementById("expenseModal"),
    categorySelect: document.getElementById("categorySelect"),
    addCategoryBtn: document.getElementById("addCategoryBtn"),
    addForm: document.getElementById("addExpenseForm"),
    profileMenu: document.getElementById("profileMenu")
};

// 1. Load Data
async function loadDashboard() {
    try {
        const [expenses, globalCats, userCats] = await Promise.all([
            apiRequest(`/expenses/user/${userId}`),
            apiRequest(`/categories/global`),
            apiRequest(`/categories/user/${userId}`)
        ]);

        // Save raw data globally
        allExpenses = expenses; 
        const allCategories = [...globalCats, ...userCats];

        // Setup UI
        populateCategoryDropdown(allCategories);
        populateFilterDropdowns(allCategories, expenses); // New: Setup filters
        
        applyFilters(); // Initial Render

    } catch (error) {
        console.error(error);
    }
}

// 2. Populate Dropdowns
function populateCategoryDropdown(categories) {
    const opts = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    elements.categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>' + opts;
}

function populateFilterDropdowns(categories, expenses) {
    // 1. Filter Category Dropdown
    const catOpts = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    elements.filterCategory.innerHTML = '<option value="all">All Categories</option>' + catOpts;

    // 2. Filter Year Dropdown (Extract unique years from expenses)
    const years = [...new Set(expenses.map(e => new Date(e.expenseDate).getFullYear()))].sort((a,b) => b-a);
    const yearOpts = years.map(y => `<option value="${y}">${y}</option>`).join('');
    elements.filterYear.innerHTML = '<option value="all">All Years</option>' + yearOpts;
}

// 3. The Core Filtering Logic 🧠
function applyFilters() {
    let filtered = [...allExpenses];

    // A. Text Search
    const search = elements.filterSearch.value.toLowerCase();
    if (search) {
        filtered = filtered.filter(e => 
            e.description.toLowerCase().includes(search) || 
            (e.categoryName && e.categoryName.toLowerCase().includes(search))
        );
    }

    // B. Category Filter
    const cat = elements.filterCategory.value;
    if (cat !== 'all') {
        filtered = filtered.filter(e => e.categoryName === cat);
    }

    // C. Month Filter
    const month = elements.filterMonth.value;
    if (month !== 'all') {
        filtered = filtered.filter(e => new Date(e.expenseDate).getMonth() === parseInt(month));
    }

    // D. Year Filter
    const year = elements.filterYear.value;
    if (year !== 'all') {
        filtered = filtered.filter(e => new Date(e.expenseDate).getFullYear() === parseInt(year));
    }

    // E. Sorting
    const sort = elements.filterSort.value;
    filtered.sort((a, b) => {
        if (sort === 'date-desc') return new Date(b.expenseDate) - new Date(a.expenseDate);
        if (sort === 'date-asc') return new Date(a.expenseDate) - new Date(b.expenseDate);
        if (sort === 'amount-desc') return b.amount - a.amount;
        if (sort === 'amount-asc') return a.amount - b.amount;
        return 0;
    });

    // Update UI
    updateStats(filtered);
    renderChart(filtered);
    renderList(filtered);
}

// 4. Attach Event Listeners to Filters
[elements.filterSearch, elements.filterSort, elements.filterMonth, elements.filterYear, elements.filterCategory]
    .forEach(el => el.addEventListener('input', applyFilters));


// 5. Render Functions
function updateStats(expenses) {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    elements.totalAmount.textContent = formatCurrency(total);
    elements.expenseCount.textContent = expenses.length;
}

function renderChart(expenses) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const categoryTotals = {};
    expenses.forEach(exp => {
        const catName = exp.categoryName || 'Uncategorized';
        categoryTotals[catName] = (categoryTotals[catName] || 0) + exp.amount;
    });

    if (chartInstance) chartInstance.destroy();

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
            plugins: { legend: { position: 'right', labels: { color: '#AAB0BC', font: { size: 10 } } } }
        }
    });
}

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
            <div style="display:flex; align-items:center;">
                <div class="expense-amount">${formatCurrency(exp.amount)}</div>
                <button class="btn-delete" onclick="deleteExpense(${exp.id})" title="Delete Expense">🗑</button>
            </div>
        </div>
    `).join("");
}

// 6. Actions (Add, Delete, etc.)
window.deleteExpense = async (id) => {
    if(!confirm("Delete this expense?")) return;
    try {
        await apiRequest(`/expenses/${id}/user/${userId}`, { method: 'DELETE' });
        loadDashboard(); 
    } catch (err) { alert(err.message); }
};

document.getElementById("deleteAccountBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    if(!confirm("Permanently delete account?")) return;
    try {
        await apiRequest(`/users/${userId}`, { method: 'DELETE' });
        localStorage.clear();
        window.location.href = "index.html";
    } catch (err) { alert(err.message); }
});

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
        
        // Refresh global data to include new category in filters
        loadDashboard();
    } catch (error) {
        alert("Failed to add category: " + error.message);
    }
});

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

// Global Toggles
document.getElementById("profileTrigger").addEventListener("click", () => elements.profileMenu.classList.toggle("active"));
document.addEventListener("click", (e) => {
    if (!e.target.closest(".user-profile")) elements.profileMenu.classList.remove("active");
});
document.getElementById("openModalBtn").addEventListener("click", () => elements.modal.classList.add("active"));
document.getElementById("closeModalBtn").addEventListener("click", () => elements.modal.classList.remove("active"));
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
});

// Init
loadDashboard();
