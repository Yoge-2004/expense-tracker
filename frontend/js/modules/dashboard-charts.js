/* Dashboard chart controllers and chart-specific helpers. */
(function () {
    "use strict";

    const utils = window.DashboardUtils;
    const chartState = window.DashboardChartState;

    function buildTrendSeries(dailyTotals) {
        const availableDates = Object.keys(dailyTotals).sort();
        if (!availableDates.length) return { dates: [], values: [] };

        const end = utils.parseLocalDate(availableDates.at(-1));
        const earliest = utils.parseLocalDate(availableDates[0]);
        // A compact 90-day window avoids an unreadable graph for long-lived accounts.
        const start = new Date(Math.max(earliest.getTime(), end.getTime() - 89 * 86400000));
        const dates = [];
        for (let date = start; date <= end; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)) {
            const key = toLocalDateKey(date);
            dates.push(key);
        }
        return { dates, values: dates.map(date => dailyTotals[date] || 0) };
    }

    function toLocalDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatTrendDate(value) {
        return utils.parseLocalDate(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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

    function renderPieChart(expenses) {
        const ctx = document.getElementById('expenseChart').getContext('2d');
        const categoryTotals = {};
        expenses.forEach(exp => {
            const cat = exp.categoryName || 'Uncategorized';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(exp.amount || 0);
        });

        if (chartState.pieChart) chartState.pieChart.destroy();

        chartState.pieChart = new Chart(ctx, {
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
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const isLight = document.body.getAttribute("data-theme") === "light";
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
        const textColor = isLight ? '#6B6558' : '#A8A395';

        const dailyTotals = {};
        expenses.forEach(exp => {
            const date = exp.expenseDate;
            dailyTotals[date] = (dailyTotals[date] || 0) + Number(exp.amount || 0);
        });

        const { dates, values } = buildTrendSeries(dailyTotals);

        if (chartState.trendChart) chartState.trendChart.destroy();

        chartState.trendChart = new Chart(ctx, {
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
                    tooltip: { displayColors: false, callbacks: { label: context => ` ${utils.formatCurrency(context.parsed.y)}` } }
                }
            }
        });
    }

    function renderRecurringSplitChart(expenses) {
        const canvas = document.getElementById('recurringSplitChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const isLight = document.body.getAttribute("data-theme") === "light";
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
        const textColor = isLight ? '#6B6558' : '#A8A395';

        if (chartState.recurringSplitChart) chartState.recurringSplitChart.destroy();
        if (!Array.isArray(expenses) || expenses.length === 0) return;

        let recurringTotal = 0;
        let oneTimeTotal = 0;
        expenses.forEach(exp => {
            const amt = Number(exp.amount || 0);
            const isRecurring = exp.recurring || exp.isRecurring;
            if (isRecurring) recurringTotal += amt; else oneTimeTotal += amt;
        });

        chartState.recurringSplitChart = new Chart(ctx, {
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
                    tooltip: { displayColors: false, callbacks: { label: context => ` ${utils.formatCurrency(context.parsed.x)}` } },
                },
            },
        });
    }

    function renderDayOfWeekChart(expenses) {
        const canvas = document.getElementById('dayOfWeekChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const isLight = document.body.getAttribute("data-theme") === "light";
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
        const textColor = isLight ? '#6B6558' : '#A8A395';
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        if (chartState.dayOfWeekChart) chartState.dayOfWeekChart.destroy();
        if (!Array.isArray(expenses) || expenses.length === 0) return;

        const totalsByDay = [0, 0, 0, 0, 0, 0, 0];
        expenses.forEach(exp => {
            const d = new Date(exp.date || exp.expenseDate);
            if (isNaN(d.getTime())) return;
            totalsByDay[d.getDay()] += Number(exp.amount || 0);
        });

        chartState.dayOfWeekChart = new Chart(ctx, {
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
                    tooltip: { displayColors: false, callbacks: { label: context => ` ${utils.formatCurrency(context.parsed.y)}` } },
                },
            },
        });
    }

    function renderBudgetVsActualChart(budgets) {
        const canvas = document.getElementById('budgetVsActualChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const isLight = document.body.getAttribute("data-theme") === "light";
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
        const textColor = isLight ? '#6B6558' : '#A8A395';

        if (chartState.budgetVsActualChart) chartState.budgetVsActualChart.destroy();

        if (!budgets || budgets.length === 0) {
            return; // Empty state is already handled by the budget list above this chart.
        }

        const labels = budgets.map(b => b.categoryName || 'Uncategorized');
        const limits = budgets.map(b => Number(b.limit || 0));
        const spent = budgets.map(b => Number(b.spent || 0));
        const overBudgetColors = budgets.map(b => (b.percentage > 100 ? '#C0392B' : '#C79A3E'));

        chartState.budgetVsActualChart = new Chart(ctx, {
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
                    tooltip: { callbacks: { label: context => ` ${context.dataset.label}: ${utils.formatCurrency(context.parsed.y)}` } },
                },
            },
        });
    }

    function updateChartsTheme() {
        const isLight = document.body.getAttribute("data-theme") === "light";
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
        const textColor = isLight ? '#6B6558' : '#A8A395';
        const borderColor = isLight ? '#FCFBF6' : '#10120E';

        if (chartState.pieChart) {
            if (chartState.pieChart.data?.datasets?.[0]) {
                chartState.pieChart.data.datasets[0].borderColor = borderColor;
            }
            if (chartState.pieChart.options?.plugins?.legend?.labels) {
                chartState.pieChart.options.plugins.legend.labels.color = textColor;
            }
            chartState.pieChart.update('none');
        }

        if (chartState.trendChart) {
            if (chartState.trendChart.options?.scales?.x?.ticks) chartState.trendChart.options.scales.x.ticks.color = textColor;
            if (chartState.trendChart.options?.scales?.y?.ticks) chartState.trendChart.options.scales.y.ticks.color = textColor;
            if (chartState.trendChart.options?.scales?.y?.grid) chartState.trendChart.options.scales.y.grid.color = gridColor;
            if (chartState.trendChart.data?.datasets?.[0]) {
                chartState.trendChart.data.datasets[0].pointBackgroundColor = isLight ? '#FCFBF6' : '#C79A3E';
            }
            chartState.trendChart.update('none');
        }

        if (chartState.recurringSplitChart) {
            if (chartState.recurringSplitChart.options?.scales?.x?.ticks) chartState.recurringSplitChart.options.scales.x.ticks.color = textColor;
            if (chartState.recurringSplitChart.options?.scales?.x?.grid) chartState.recurringSplitChart.options.scales.x.grid.color = gridColor;
            if (chartState.recurringSplitChart.options?.scales?.y?.ticks) chartState.recurringSplitChart.options.scales.y.ticks.color = textColor;
            chartState.recurringSplitChart.update('none');
        }

        if (chartState.dayOfWeekChart) {
            if (chartState.dayOfWeekChart.options?.scales?.x?.ticks) chartState.dayOfWeekChart.options.scales.x.ticks.color = textColor;
            if (chartState.dayOfWeekChart.options?.scales?.y?.ticks) chartState.dayOfWeekChart.options.scales.y.ticks.color = textColor;
            if (chartState.dayOfWeekChart.options?.scales?.y?.grid) chartState.dayOfWeekChart.options.scales.y.grid.color = gridColor;
            chartState.dayOfWeekChart.update('none');
        }

        if (chartState.budgetVsActualChart) {
            if (chartState.budgetVsActualChart.data?.datasets?.[0]) {
                chartState.budgetVsActualChart.data.datasets[0].backgroundColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)';
            }
            if (chartState.budgetVsActualChart.options?.scales?.x?.ticks) chartState.budgetVsActualChart.options.scales.x.ticks.color = textColor;
            if (chartState.budgetVsActualChart.options?.scales?.y?.ticks) chartState.budgetVsActualChart.options.scales.y.ticks.color = textColor;
            if (chartState.budgetVsActualChart.options?.scales?.y?.grid) chartState.budgetVsActualChart.options.scales.y.grid.color = gridColor;
            if (chartState.budgetVsActualChart.options?.plugins?.legend?.labels) chartState.budgetVsActualChart.options.plugins.legend.labels.color = textColor;
            chartState.budgetVsActualChart.update('none');
        }
    }

    window.renderPieChart = renderPieChart;
    window.renderTrendChart = renderTrendChart;
    window.renderRecurringSplitChart = renderRecurringSplitChart;
    window.renderDayOfWeekChart = renderDayOfWeekChart;
    window.renderBudgetVsActualChart = renderBudgetVsActualChart;
    window.updateChartsTheme = updateChartsTheme;
})();
