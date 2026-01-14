// Check Auth
const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");

if (!token || !userId) {
    window.location.href = "index.html";
}

// Format Currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

// State
const elements = {
    totalAmount: document.getElementById("totalAmount"),
    expenseCount: document.getElementById("expenseCount"),
    expenseList: document.getElementById("expenseList"),
    modal: document.getElementById("expenseModal"),
    openBtn: document.getElementById("openModalBtn"),
    closeBtn: document.getElementById("closeModalBtn"),
    form: document.getElementById("addExpenseForm"),
    logoutBtn: document.getElementById("logoutBtn")
};

// 1. Fetch Expenses
async function loadDashboard() {
    try {
        const expenses = await apiRequest(`/expenses/user/${userId}`);
        
        // Calculate Totals
        const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        // Update UI
        elements.totalAmount.textContent = formatCurrency(total);
        elements.expenseCount.textContent = expenses.length;
        
        renderList(expenses);

    } catch (error) {
        console.error(error);
        elements.expenseList.innerHTML = `<p style="color:#FF6B50; text-align:center;">Failed to load data</p>`;
    }
}

// 2. Render List
function renderList(expenses) {
    if (expenses.length === 0) {
        elements.expenseList.innerHTML = `<p style="text-align:center; color:#555; margin-top:20px;">No expenses found.</p>`;
        return;
    }

    elements.expenseList.innerHTML = expenses.map(exp => `
        <div class="expense-item">
            <div class="expense-info">
                <h4>${exp.description}</h4>
                <div class="expense-meta">${exp.expenseDate} • ${exp.categoryName || 'General'}</div>
            </div>
            <div class="expense-amount">
                ${formatCurrency(exp.amount)}
            </div>
        </div>
    `).join("");
}

// 3. Add Expense
elements.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const payload = {
        description: document.getElementById("desc").value,
        amount: parseFloat(document.getElementById("amount").value),
        expenseDate: document.getElementById("date").value,
        categoryId: 1 // IMPORTANT: Ensure you have a Category with ID 1 in DB, or fetch categories first
    };

    try {
        await apiRequest(`/expenses/user/${userId}`, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        
        elements.modal.classList.remove("active");
        elements.form.reset();
        loadDashboard(); // Refresh data
    } catch (error) {
        alert("Error adding expense: " + error.message);
    }
});

// Modal Toggles
elements.openBtn.addEventListener("click", () => elements.modal.classList.add("active"));
elements.closeBtn.addEventListener("click", () => elements.modal.classList.remove("active"));

// Logout
elements.logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
});

// Init
loadDashboard();