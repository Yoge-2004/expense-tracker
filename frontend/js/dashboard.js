// Auth Check
const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
if (!token || !userId) window.location.href = "index.html";

// Formatters
const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);

// ✅ NEW: Nice Date Formatter
const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
};

// State
let chartInstance = null;
const elements = {
    totalAmount: document.getElementById("totalAmount"),
    expenseCount: document.getElementById("expenseCount"),
    expenseList: document.getElementById("expenseList"),
    modal: document.getElementById("expenseModal"),
    categorySelect: document.getElementById("categorySelect"),
    profileMenu: document.getElementById("profileMenu"), // Dropdown
    addForm: document.getElementById("addExpenseForm")
};

// 1. Load Data
async function loadDashboard() {
    try {
        const [expenses, categories] = await Promise.all([
            apiRequest(`/expenses/user/${userId}`),
            apiRequest(`/categories/global`)
        ]);

        populateCategoryDropdown(categories);
        updateStats(expenses);
        renderChart(expenses); // ✅ Render Chart
        renderList(expenses);

    } catch (error) {
        console.error(error);
    }
}

// 2. Helper Functions
function populateCategoryDropdown(categories) {
    elements.categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';
    categories.forEach(cat => {
        elements.categorySelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
}

function updateStats(expenses) {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    elements.totalAmount.textContent = formatCurrency(total);
    elements.expenseCount.textContent = expenses.length;
}

// ✅ 3. Chart Rendering
function renderChart(expenses) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    // Group by Category
    const categoryTotals = {};
    expenses.forEach(exp => {
        const catName = exp.categoryName || 'Uncategorized';
        categoryTotals[catName] = (categoryTotals[catName] || 0) + exp.amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    if (chartInstance) chartInstance.destroy(); // Destroy old chart before re-rendering

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#FF9F6E', '#FF7A3D', '#64D2FF', '#A084FF', '#34C759'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#AAB0BC', font: { size: 10 } } }
            }
        }
    });
}

// ✅ 4. Render List with Delete Button
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

// ✅ 5. Delete Actions
window.deleteExpense = async (id) => {
    if(!confirm("Are you sure you want to delete this expense?")) return;
    try {
        await apiRequest(`/expenses/${id}/user/${userId}`, { method: 'DELETE' });
        loadDashboard();
    } catch (err) { alert(err.message); }
};

document.getElementById("deleteAccountBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    if(!confirm("WARNING: This will permanently delete your account and all data. Continue?")) return;
    try {
        await apiRequest(`/users/${userId}`, { method: 'DELETE' });
        localStorage.clear();
        window.location.href = "index.html";
    } catch (err) { alert(err.message); }
});

// 6. Event Listeners
document.getElementById("profileTrigger").addEventListener("click", () => {
    elements.profileMenu.classList.toggle("active"); // Toggle Dropdown
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
    if (!e.target.closest(".user-profile")) {
        elements.profileMenu.classList.remove("active");
    }
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

// Modal Toggles
document.getElementById("openModalBtn").addEventListener("click", () => elements.modal.classList.add("active"));
document.getElementById("closeModalBtn").addEventListener("click", () => elements.modal.classList.remove("active"));
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
});

// Init
loadDashboard();