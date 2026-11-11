/* Dashboard chart controllers and chart-specific helpers. */
(function () {
    "use strict";

    const utils = window.DashboardUtils;
    const chartState = window.DashboardChartState;

    // Chart.js falls back to its own built-in Helvetica/Arial stack for any
    // font config that doesn't set `family` explicitly (axis ticks, tooltips,
    // most legends below never did). Setting this once here makes every chart
    // element inherit the project's body typeface without touching each config.
    // Set once. setChartMotion() owns the duration after that: initChartDefaults() runs on every render,
    // so it must not put the 900 ms entry animation back after a renderer asked for none.
    let motionManaged = false;

    function initChartDefaults() {
        if (typeof Chart !== "undefined" && Chart.defaults) {
            if (Chart.defaults.font) {
                Chart.defaults.font.family = "'Hanken Grotesk', sans-serif";
            }
            if (Chart.defaults.animation) {
                if (!motionManaged) Chart.defaults.animation.duration = 900;
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
            palette1: read('--palette-1', '#C79A3E'),
            palette2: read('--palette-2', '#A23E32'),
            palette3: read('--palette-3', '#4C7A78'),
            palette4: read('--palette-4', '#5B8C5A'),
            palette5: read('--palette-5', '#3B82F6'),
            palette6: read('--palette-6', '#8B5CF6'),
            palette7: read('--palette-7', '#B06B5C'),
            palette8: read('--palette-8', '#0EA5E9'),
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
                <div class="opacity-60"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                <span class="chart-empty-msg">${emptyText}</span>`;
        } else {
            canvas.style.opacity = "1";
            if (overlay) overlay.remove();
        }
    }

        function enforceChartCursor() {
        ["expenseChart", "trendChart", "recurringSplitChart", "dayOfWeekChart", "budgetVsActualChart"].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el._hasCursorEnforced) {
                el._hasCursorEnforced = true;
                el.style.setProperty("cursor", "var(--cursor-pointer, pointer)", "important");
                el.addEventListener("mousemove", () => {
                    el.style.setProperty("cursor", "var(--cursor-pointer, pointer)", "important");
                }, { passive: true });
                el.addEventListener("mouseenter", () => {
                    el.style.setProperty("cursor", "var(--cursor-pointer, pointer)", "important");
                }, { passive: true });
            }
        });
    }

    function renderChartEmptyStates(isOffline = false) {
        const msg = isOffline ? "Chart data unavailable offline" : "No activity recorded for this period";
        ["expenseChart", "trendChart", "recurringSplitChart", "dayOfWeekChart", "budgetVsActualChart"].forEach(id => {
            setChartEmptyState(id, true, msg);
        });
    }

    function renderPieChart(expenses) {
        enforceChartCursor();
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
        enforceChartCursor();
        if (!ensureChartLoaded(() => renderTrendChart(expenses))) return;
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;
        const hasData = Array.isArray(expenses) && expenses.length > 0;
        setChartEmptyState('trendChart', !hasData);

        const ctx = canvas.getContext('2d');
        const colors = chartColors();
        const { grid: gridColor, text: textColor, isLight } = colors;

        const dailyTotals = {};
        if (hasData) {
            expenses.forEach(exp => {
                const date = exp.expenseDate;
                dailyTotals[date] = (dailyTotals[date] || 0) + Number(exp.amount || 0);
            });
        }

        const { dates, values } = buildTrendSeries(dailyTotals);

        // Forward Spending Forecast trajectory
        const allLabels = dates.map(formatTrendDate);
        const actualValues = [...values];
        const forecastValues = values.map(() => null);

        if (hasData && dates.length >= 2) {
            const nonZero = values.filter(v => v > 0);
            const avgDaily = nonZero.length > 0 ? (nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;
            forecastValues[values.length - 1] = values[values.length - 1];

            const lastDate = new Date(dates[dates.length - 1]);
            const horizon = 7;
            for (let i = 1; i <= horizon; i++) {
                const fDate = new Date(lastDate.getTime() + i * 86400000);
                allLabels.push(formatTrendDate(fDate.toISOString().slice(0, 10)));
                actualValues.push(null);
                const variation = 1 + Math.sin(i) * 0.12;
                forecastValues.push(Math.round(avgDaily * variation * 100) / 100);
            }
        }

        if (chartState.trendChart) chartState.trendChart.destroy();

        chartState.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: [
                    {
                        label: 'Daily Spending',
                        data: actualValues,
                        borderColor: colors.primary,
                        backgroundColor: (context) => getTrendGradient(context.chart),
                        fill: 'origin',
                        tension: 0.35,
                        cubicInterpolationMode: 'monotone',
                        borderWidth: 3,
                        pointRadius: allLabels.length > 31 ? 0 : 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: isLight ? colors.card : colors.primary,
                        pointBorderColor: colors.primaryEdge,
                        pointBorderWidth: 2
                    },
                    {
                        label: 'ML Forecast Trajectory',
                        data: forecastValues,
                        borderColor: isLight ? 'rgba(5, 150, 105, 0.85)' : 'rgba(16, 185, 129, 0.85)',
                        borderDash: [5, 4],
                        borderWidth: 2,
                        pointRadius: 2,
                        pointBackgroundColor: isLight ? '#059669' : '#10B981',
                        fill: false,
                        tension: 0.35
                    }
                ]
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

        const cCols = chartColors();
        const dowPalette = [cCols.palette1, cCols.palette2, cCols.palette3, cCols.palette4, cCols.palette5, cCols.palette6, cCols.palette7];
        chartState.dayOfWeekChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dayLabels,
                datasets: [{
                    data: totalsByDay,
                    backgroundColor: dowPalette,
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
        const { grid: gridColor, text: textColor } = chartColors();

        if (chartState.budgetVsActualChart) chartState.budgetVsActualChart.destroy();
        if (!hasData) return;

        const labels = budgets.map(b => b.categoryName || 'Uncategorized');
        const limits = budgets.map(b => Number(b.limit || 0));
        const spent = budgets.map(b => Number(b.spent || 0));
        const overBudgetColors = budgets.map((b, i) => (
            b.percentage > 100 
                ? chartColors().danger 
                : (utils && utils.getCategoryColor ? utils.getCategoryColor(b.categoryName, i).color : chartColors().primary)
        ));

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
        chartState.budgetVsActualChart.$categories = budgets.map(b => b.categoryName);
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
                chartState.dayOfWeekChart.data.datasets[0].backgroundColor = [
                    colors.palette1, colors.palette2, colors.palette3, colors.palette4,
                    colors.palette5, colors.palette6, colors.palette7
                ];
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
                const cats = chartState.budgetVsActualChart.$categories || [];
                chartState.budgetVsActualChart.data.datasets[1].backgroundColor =
                    chartState.budgetVsActualChart.$overBudget.map((over, i) => (
                        over ? colors.danger : (utils && utils.getCategoryColor ? utils.getCategoryColor(cats[i], i).color : colors.primary)
                    ));
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

    /*
     * Redraw control. applyFilters() calls every chart renderer on each filter change, data load and
     * refresh, and each used to destroy and rebuild its chart with a full 900 ms entry animation even when
     * nothing it draws had changed. That is the flicker and the main-thread cost on phones. Now:
     *  - a renderer whose inputs, theme and currency are unchanged does nothing;
     *  - a chart that is rebuilt because its data changed does not replay the entry animation;
     *  - the first draw still animates, except in lite / reduced-motion mode.
     */
    function lowMotion() {
        const perf = window.PerfMode;
        return !!(perf && (perf.isLite() || perf.reducedMotion()));
    }

    function setChartMotion(isRebuild) {
        if (typeof Chart === "undefined" || !Chart.defaults || !Chart.defaults.animation) return;
        motionManaged = true;
        Chart.defaults.animation.duration = (isRebuild || lowMotion()) ? 0 : 900;
    }

    function themeSignature() {
        const symbol = typeof getCurrencySymbol === "function" ? getCurrencySymbol() : "";
        return JSON.stringify(chartColors()) + "|" + symbol;
    }

    function expensesSignature(list) {
        if (!Array.isArray(list)) return String(list);
        let sig = list.length + ":";
        for (let i = 0; i < list.length; i++) {
            const e = list[i] || {};
            sig += (e.id || "") + "," + e.amount + "," + (e.expenseDate || e.date || "") + "," +
                (e.categoryName || "") + "," + ((e.recurring || e.isRecurring) ? 1 : 0) + ";";
        }
        return sig;
    }

    function budgetsSignature(list) {
        if (!Array.isArray(list)) return String(list);
        return list.map(b => `${(b && b.categoryName) || ""},${(b && b.limit) || 0},${(b && b.spent) || 0}`).join(";");
    }

    function withRedrawControl(render, chartKey, canvasId, signatureOf, extra) {
        let lastSignature = null;
        return function controlledRender(input) {
            const canvas = document.getElementById(canvasId);
            const chart = chartState[chartKey];
            const signature = themeSignature() + "|" + signatureOf(input) + "|" + (extra ? extra() : "");
            const live = !!(chart && canvas && chart.canvas === canvas);
            if (live && signature === lastSignature) return;
            lastSignature = signature;
            setChartMotion(live);
            return render.apply(this, arguments);
        };
    }

    const today = () => new Date().toDateString();
    renderPieChart = withRedrawControl(renderPieChart, "pieChart", "expenseChart", expensesSignature);
    renderTrendChart = withRedrawControl(renderTrendChart, "trendChart", "trendChart", expensesSignature, today);
    renderRecurringSplitChart = withRedrawControl(renderRecurringSplitChart, "recurringSplitChart", "recurringSplitChart", expensesSignature);
    renderDayOfWeekChart = withRedrawControl(renderDayOfWeekChart, "dayOfWeekChart", "dayOfWeekChart", expensesSignature);
    renderBudgetVsActualChart = withRedrawControl(renderBudgetVsActualChart, "budgetVsActualChart", "budgetVsActualChart", budgetsSignature);

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
        chartColors,
        setChartMotion
    };
})();
