/* Dashboard chart controllers and chart-specific helpers. */
(function () {
    "use strict";

    const utils = window.DashboardUtils;
    const chartState = window.DashboardChartState;

    // Chart.js falls back to its own built-in Helvetica/Arial stack for any
    // font config that doesn't set `family` explicitly (axis ticks, tooltips,
    // most legends below never did). Setting this once here makes every chart
    // element inherit the project's body typeface without touching each config.
    function initChartDefaults() {
        if (typeof Chart !== "undefined" && Chart.defaults) {
            if (Chart.defaults.font) {
                Chart.defaults.font.family = "'Hanken Grotesk', sans-serif";
            }
            if (Chart.defaults.animation) {
                Chart.defaults.animation.duration = 900;
                Chart.defaults.animation.easing = 'easeOutBack';
            }
        }
    }
    initChartDefaults();

    function ensureChartLoaded(callback) {
        if (typeof Chart !== "undefined") {
            initChartDefaults();
            return true;
        }
        console.warn("[dashboard-charts] Chart.js not yet loaded; queuing render callback.");
        if (callback) {
            const check = () => {
                if (typeof Chart !== "undefined") {
                    initChartDefaults();
                    callback();
                    return true;
                }
                return false;
            };
            if (!check()) {
                const interval = setInterval(() => {
                    if (check()) clearInterval(interval);
                }, 50);
                setTimeout(() => clearInterval(interval), 8000);
            }
        }
        return false;
    }

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
        return utils.parseLocalDate(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    }

    function formatCompactCurrency(value) {
        return typeof formatGlobalCompactCurrency === "function" ? formatGlobalCompactCurrency(value) : `${typeof getCurrencySymbol === "function" ? getCurrencySymbol() : "$"}${Number(value || 0).toFixed(0)}`;
    }

    /**
     * Chart colours come from the live CSS variables, so they follow the theme and any palette the user picked.
     * The fallbacks are the shipped dark-theme values for pages where a variable is missing.
     */
    function chartColors() {
        const style = getComputedStyle(document.documentElement);
        const read = (name, fallback) => (style.getPropertyValue(name).trim() || fallback);
        const isLight = document.body.getAttribute("data-theme") === "light";
        return {
            isLight,
            primary: read('--primary', '#C79A3E'),
            primaryEdge: read('--warning', '#A97F2E'),
            accent: read('--accent', '#A23E32'),
            highlight: read('--highlight', '#4C7A78'),
            danger: read('--danger', '#C0392B'),
            card: read('--card-bg', isLight ? '#FCFBF6' : '#10120E'),
            text: read('--text-muted', isLight ? '#6B6558' : '#A8A395'),
            grid: read('--line-soft', isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)'),
            barTrack: read('--fill-strong', isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)'),
        };
    }

    function withAlpha(color, alpha) {
        const hex = /^#([0-9a-f]{6})$/i.exec(String(color).trim());
        if (!hex) return color;
        const n = parseInt(hex[1], 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }

    function getTrendGradient(chart) {
        const { ctx, chartArea } = chart;
        const { primary } = chartColors();
        if (!chartArea) return withAlpha(primary, 0.22);
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, withAlpha(primary, 0.35));
        gradient.addColorStop(0.72, withAlpha(primary, 0.08));
        gradient.addColorStop(1, withAlpha(primary, 0.01));
        return gradient;
    }

    function setChartEmptyState(canvasId, isEmpty, emptyText = "No activity recorded for this period") {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const wrapper = canvas.closest(".chart-wrapper, .trend-chart-wrapper");
        if (!wrapper) return;
        let overlay = wrapper.querySelector(".chart-empty-overlay");
        if (isEmpty) {
            canvas.style.opacity = "0.15";
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.className = "chart-empty-overlay";
                overlay.style.cssText = "position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; pointer-events:none; text-align:center; padding:12px; z-index:2;";
                wrapper.appendChild(overlay);
            }
            overlay.innerHTML = `
                <div style="opacity:0.6;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                <span style="font-size:12px; font-weight:600; color:var(--text-muted); max-width:200px; line-height:1.3;">${emptyText}</span>`;
        } else {
            canvas.style.opacity = "1";
            if (overlay) overlay.remove();
        }
    }

    function renderChartEmptyStates(isOffline = false) {
        const msg = isOffline ? "Chart data unavailable offline" : "No activity recorded for this period";
        ["expenseChart", "trendChart", "recurringSplitChart", "dayOfWeekChart", "budgetVsActualChart"].forEach(id => {
            setChartEmptyState(id, true, msg);
        });
    }

    function renderPieChart(expenses) {
        if (!ensureChartLoaded(() => renderPieChart(expenses))) return;
        const canvas = document.getElementById('expenseChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const hasData = Array.isArray(expenses) && expenses.length > 0;
        setChartEmptyState('expenseChart', !hasData);

        const categoryTotals = {};
        if (hasData) {
            expenses.forEach(exp => {
                const cat = exp.categoryName || 'Uncategorized';
                categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(exp.amount || 0);
            });
        }

        if (chartState.pieChart) chartState.pieChart.destroy();

        const labels = Object.keys(categoryTotals);
        const dataValues = Object.values(categoryTotals);
        const bgColors = labels.map((cat, i) => (utils && utils.getCategoryColor ? utils.getCategoryColor(cat, i).color : '#C79A3E'));

        chartState.pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: bgColors,
                    borderWidth: 2,
                    borderColor: chartColors().card
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '72%',
                onHover: (event) => { if (event && event.native && event.native.target) event.native.target.style.cursor = "var(--cursor-pointer, pointer)"; },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-muted'),
                            font: { size: 13, family: "'Hanken Grotesk', sans-serif", weight: '600' },
                            boxWidth: 12, padding: 14, usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    function renderTrendChart(expenses) {
        if (!ensureChartLoaded(() => renderTrendChart(expenses))) return;
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;
        const hasData = Array.isArray(expenses) && expenses.length > 0;
        setChartEmptyState('trendChart', !hasData);

        const ctx = canvas.getContext('2d');
        const isLight = document.body.getAttribute("data-theme") === "light";
        const { grid: gridColor, text: textColor } = chartColors();

        const dailyTotals = {};
        if (hasData) {
            expenses.forEach(exp => {
                const date = exp.expenseDate;
                dailyTotals[date] = (dailyTotals[date] || 0) + Number(exp.amount || 0);
            });
        }

        const { dates, values } = buildTrendSeries(dailyTotals);

        if (chartState.trendChart) chartState.trendChart.destroy();

        chartState.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates.map(formatTrendDate),
                datasets: [{
                    label: 'Daily Spending',
                    data: values,
                    borderColor: chartColors().primary,
                    backgroundColor: (context) => getTrendGradient(context.chart),
                    fill: 'origin',
                    tension: 0.35,
                    cubicInterpolationMode: 'monotone',
                    borderWidth: 3,
                    pointRadius: dates.length > 31 ? 0 : 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: isLight ? chartColors().card : chartColors().primary,
                    pointBorderColor: chartColors().primaryEdge,
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
        if (!ensureChartLoaded(() => renderRecurringSplitChart(expenses))) return;
        const canvas = document.getElementById('recurringSplitChart');
        if (!canvas) return;
        const hasData = Array.isArray(expenses) && expenses.length > 0;
        setChartEmptyState('recurringSplitChart', !hasData);

        const ctx = canvas.getContext('2d');
        const isLight = document.body.getAttribute("data-theme") === "light";
        const { grid: gridColor, text: textColor } = chartColors();

        if (chartState.recurringSplitChart) chartState.recurringSplitChart.destroy();
        if (!hasData) return;

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
                    backgroundColor: [chartColors().accent, chartColors().primary],
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
        if (!ensureChartLoaded(() => renderDayOfWeekChart(expenses))) return;
        const canvas = document.getElementById('dayOfWeekChart');
        if (!canvas) return;
        const hasData = Array.isArray(expenses) && expenses.length > 0;
        setChartEmptyState('dayOfWeekChart', !hasData);

        const ctx = canvas.getContext('2d');
        const isLight = document.body.getAttribute("data-theme") === "light";
        const { grid: gridColor, text: textColor } = chartColors();
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        if (chartState.dayOfWeekChart) chartState.dayOfWeekChart.destroy();
        if (!hasData) return;

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
                    backgroundColor: chartColors().highlight,
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
        if (!ensureChartLoaded(() => renderBudgetVsActualChart(budgets))) return;
        const canvas = document.getElementById('budgetVsActualChart');
        if (!canvas) return;
        const hasData = Array.isArray(budgets) && budgets.length > 0;
        setChartEmptyState('budgetVsActualChart', !hasData, "No budget limits set yet");

        const ctx = canvas.getContext('2d');
        const isLight = document.body.getAttribute("data-theme") === "light";
        const { grid: gridColor, text: textColor } = chartColors();

        if (chartState.budgetVsActualChart) chartState.budgetVsActualChart.destroy();
        if (!hasData) return;

        const labels = budgets.map(b => b.categoryName || 'Uncategorized');
        const limits = budgets.map(b => Number(b.limit || 0));
        const spent = budgets.map(b => Number(b.spent || 0));
        const overBudgetColors = budgets.map(b => (b.percentage > 100 ? chartColors().danger : chartColors().primary));

        chartState.budgetVsActualChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Budget',
                        data: limits,
                        backgroundColor: chartColors().barTrack,
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
        chartState.budgetVsActualChart.$overBudget = budgets.map(b => b.percentage > 100);
    }

    function updateChartsTheme() {
        if (typeof Chart === "undefined") return;
        const colors = chartColors();
        const { grid: gridColor, text: textColor, card: borderColor, isLight } = colors;

        if (chartState.pieChart) {
            if (chartState.pieChart.data?.datasets?.[0]) {
                chartState.pieChart.data.datasets[0].borderColor = borderColor;
                const labels = chartState.pieChart.data.labels || [];
                chartState.pieChart.data.datasets[0].backgroundColor = labels.map((cat, i) => (utils && utils.getCategoryColor ? utils.getCategoryColor(cat, i).color : colors.primary));
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
                const trend = chartState.trendChart.data.datasets[0];
                trend.borderColor = colors.primary;
                trend.pointBackgroundColor = isLight ? colors.card : colors.primary;
                trend.pointBorderColor = colors.primaryEdge;
            }
            chartState.trendChart.update('none');
        }

        if (chartState.recurringSplitChart) {
            if (chartState.recurringSplitChart.data?.datasets?.[0]) {
                chartState.recurringSplitChart.data.datasets[0].backgroundColor = [colors.accent, colors.primary];
            }
            if (chartState.recurringSplitChart.options?.scales?.x?.ticks) chartState.recurringSplitChart.options.scales.x.ticks.color = textColor;
            if (chartState.recurringSplitChart.options?.scales?.x?.grid) chartState.recurringSplitChart.options.scales.x.grid.color = gridColor;
            if (chartState.recurringSplitChart.options?.scales?.y?.ticks) chartState.recurringSplitChart.options.scales.y.ticks.color = textColor;
            chartState.recurringSplitChart.update('none');
        }

        if (chartState.dayOfWeekChart) {
            if (chartState.dayOfWeekChart.data?.datasets?.[0]) {
                chartState.dayOfWeekChart.data.datasets[0].backgroundColor = colors.highlight;
            }
            if (chartState.dayOfWeekChart.options?.scales?.x?.ticks) chartState.dayOfWeekChart.options.scales.x.ticks.color = textColor;
            if (chartState.dayOfWeekChart.options?.scales?.y?.ticks) chartState.dayOfWeekChart.options.scales.y.ticks.color = textColor;
            if (chartState.dayOfWeekChart.options?.scales?.y?.grid) chartState.dayOfWeekChart.options.scales.y.grid.color = gridColor;
            chartState.dayOfWeekChart.update('none');
        }

        if (chartState.budgetVsActualChart) {
            if (chartState.budgetVsActualChart.data?.datasets?.[0]) {
                chartState.budgetVsActualChart.data.datasets[0].backgroundColor = colors.barTrack;
            }
            if (chartState.budgetVsActualChart.data?.datasets?.[1] && Array.isArray(chartState.budgetVsActualChart.$overBudget)) {
                chartState.budgetVsActualChart.data.datasets[1].backgroundColor =
                    chartState.budgetVsActualChart.$overBudget.map(over => (over ? colors.danger : colors.primary));
            }
            if (chartState.budgetVsActualChart.options?.scales?.x?.ticks) chartState.budgetVsActualChart.options.scales.x.ticks.color = textColor;
            if (chartState.budgetVsActualChart.options?.scales?.y?.ticks) chartState.budgetVsActualChart.options.scales.y.ticks.color = textColor;
            if (chartState.budgetVsActualChart.options?.scales?.y?.grid) chartState.budgetVsActualChart.options.scales.y.grid.color = gridColor;
            if (chartState.budgetVsActualChart.options?.plugins?.legend?.labels) chartState.budgetVsActualChart.options.plugins.legend.labels.color = textColor;
            chartState.budgetVsActualChart.update('none');
        }
    }

    // A new palette or theme re-colours the charts that are already on screen.
    document.addEventListener('palettechange', () => updateChartsTheme());

    // Preserve the established dashboard globals for legacy call sites.
    window.renderPieChart = renderPieChart;
    window.renderTrendChart = renderTrendChart;
    window.renderRecurringSplitChart = renderRecurringSplitChart;
    window.renderDayOfWeekChart = renderDayOfWeekChart;
    window.renderBudgetVsActualChart = renderBudgetVsActualChart;
    window.renderChartEmptyStates = renderChartEmptyStates;
    window.setChartEmptyState = setChartEmptyState;
    window.updateChartsTheme = updateChartsTheme;

    window.DashboardCharts = {
        buildTrendSeries,
        getTrendGradient,
        renderPieChart,
        renderTrendChart,
        renderRecurringSplitChart,
        renderDayOfWeekChart,
        renderBudgetVsActualChart,
        updateChartsTheme,
        chartColors
    };
})();
