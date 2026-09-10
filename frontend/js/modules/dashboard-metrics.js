/* Dashboard metric calculations and recurring summary state. */
(function () {
    "use strict";

    const elements = window.DashboardDom.elements;
    const { formatCurrency } = window.DashboardUtils;
    const userId = localStorage.getItem("userId");

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

    window.DashboardMetrics = Object.freeze({
        updateProMetrics
    });
    window.updateProMetrics = updateProMetrics;
})();
