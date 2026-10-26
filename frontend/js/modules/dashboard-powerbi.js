/* ==========================================================================
   POWERBI / ENTERPRISE BI EXECUTIVE DASHBOARD SUITE
   - Multi-Dimensional Global Slicers Ribbon
   - Real-Time Bi-Directional Cross-Filtering Visual Highlights
   - KPI Micro-Sparklines & Variance Delta Indicators
   - Cumulative Spend vs. Ideal Budget Run-Rate Pacing Controls
   ========================================================================== */
(function () {
    "use strict";

    let activeCrossFilter = null; // { type: 'category'|'dayOfWeek'|'recurring', value: any, label: string }
    let trendMode = 'daily'; // 'daily' | 'cumulative'
    let initialized = false;

    const utils = window.DashboardUtils || {};

    // Helper: format compact currency
    function fmt(val) {
        if (typeof utils.formatCurrency === "function") return utils.formatCurrency(val);
        return `$${Number(val || 0).toFixed(0)}`;
    }

    // Helper: Local date string YYYY-MM-DD
    function toDateStr(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 1. INJECT SLICERS RIBBON DOM
    function ensureSlicersRibbon() {
        if (document.getElementById("powerBiSlicersRibbon")) return;

        const targetSection = document.getElementById("unifiedLedgerCard") || document.querySelector(".unified-ledger-card") || document.querySelector(".recent-transactions") || document.querySelector(".grid-4-metrics");
        if (!targetSection) return;

        const ribbon = document.createElement("section");
        ribbon.id = "powerBiSlicersRibbon";
        ribbon.className = "bi-slicers-ribbon animate-cascade delay-1";
        ribbon.setAttribute("aria-label", "PowerBI Executive Slicers and Cross-Filters");

        ribbon.innerHTML = `
            <!-- External Slicers Header - Positioned Above & Outside the Filter Container -->
            <div class="bi-slicers-top bi-slicers-external-top" style="margin-bottom: 12px;">
                <div class="bi-slicers-heading">
                    <span class="bi-badge">
                        <span class="bi-badge-dot"></span>
                        PowerBI Executive Slicers
                    </span>
                    <h3 class="bi-slicers-title">Dimensional Analytics &amp; Cross-Filtering</h3>
                </div>
                <div class="bi-slicers-actions">
                    <div id="biCrossFilterContainer" style="display:none;"></div>
                    <button type="button" class="bi-action-btn" id="biWhatIfBtn" title="Interactive What-If Scenario Simulator">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        <span>What-If Simulator</span>
                    </button>
                    <button type="button" class="bi-action-btn" id="biAnomalyBtn" title="Filter Statistical Surges (> 2σ)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span id="biAnomalyBtnText">Anomalies</span>
                    </button>
                    <button type="button" class="bi-action-btn" id="biDecompBtn" title="Explain Period Variance (Waterfall Decomposition)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        <span>Explain Variance</span>
                    </button>
                    <button type="button" class="bi-reset-slicers-btn" id="biResetSlicersBtn" title="Reset all slicers and active cross-filters">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        <span>Reset</span>
                    </button>
                </div>
            </div>

            <!-- Dedicated Slicers Filter Container Housing the 3 Interactive Filters -->
            <div class="bi-slicers-filter-container" id="biSlicersFilterContainer">
                <div class="bi-slicers-row">
                    <!-- Horizon Slicer -->
                    <div class="bi-slicer-group" id="biHorizonSlicer" role="group" aria-label="Time Horizon Slicer">
                        <span class="bi-slicer-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Horizon</span>
                        <div class="bi-slicer-pills-wrap">
                            <button type="button" class="bi-slicer-pill active" style="border:none; outline:none;" data-horizon="all">All Time</button>
                            <button type="button" class="bi-slicer-pill" style="border:none; outline:none;" data-horizon="mtd">This Month</button>
                            <button type="button" class="bi-slicer-pill" style="border:none; outline:none;" data-horizon="last30">Last 30 Days</button>
                            <button type="button" class="bi-slicer-pill" style="border:none; outline:none;" data-horizon="qtd">This Quarter</button>
                            <button type="button" class="bi-slicer-pill" style="border:none; outline:none;" data-horizon="ytd">Year to Date</button>
                            <button type="button" class="bi-slicer-pill" style="border:none; outline:none;" data-horizon="last7">Last 7 Days</button>
                        </div>
                    </div>

                    <!-- Commitment Slicer -->
                    <div class="bi-slicer-group" id="biCommitmentSlicer" role="group" aria-label="Commitment Type Slicer">
                        <span class="bi-slicer-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Commitment</span>
                        <div class="bi-slicer-pills-wrap">
                            <button type="button" class="bi-slicer-pill active" style="border:none; outline:none;" data-commitment="all">All Types</button>
                            <button type="button" class="bi-slicer-pill" style="border:none; outline:none;" data-commitment="onetime">One-Time</button>
                            <button type="button" class="bi-slicer-pill" style="border:none; outline:none;" data-commitment="recurring">Subscriptions</button>
                        </div>
                    </div>

                    <!-- Cashflow Direction Slicer -->
                    <div class="bi-slicer-group" id="biStreamSlicer" role="group" aria-label="Cashflow Stream Slicer">
                        <span class="bi-slicer-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Cash Flow</span>
                        <div class="bi-slicer-pills-wrap">
                            <button type="button" class="bi-slicer-pill active" style="border:none; outline:none;" data-stream="all">All Cash</button>
                            <button type="button" class="bi-slicer-pill" style="border:none; outline:none;" data-stream="expenses">Outflow Only</button>
                            <button type="button" class="bi-slicer-pill" style="border:none; outline:none;" data-stream="incomes">Inflow Only</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- What-If Scenario Simulator Drawer -->
            <div class="bi-whatif-drawer" id="biWhatIfDrawer">
                <div class="bi-whatif-header">
                    <h4 class="bi-whatif-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Interactive Financial Sensitivity &amp; What-If Parameters
                    </h4>
                    <button type="button" class="bi-reset-slicers-btn" id="biResetWhatIfBtn">Reset Sliders</button>
                </div>
                <div class="bi-whatif-sliders-grid">
                    <div class="bi-slider-control">
                        <div class="bi-slider-label-row">
                            <span>Discretionary Spend Reduction</span>
                            <span class="bi-slider-val" id="valSpendCut">0%</span>
                        </div>
                        <input type="range" class="bi-range-input" id="sliderSpendCut" min="-30" max="30" value="0" step="5">
                    </div>
                    <div class="bi-slider-control">
                        <div class="bi-slider-label-row">
                            <span>Operating Inflow Shock</span>
                            <span class="bi-slider-val" id="valRevShock">0%</span>
                        </div>
                        <input type="range" class="bi-range-input" id="sliderRevShock" min="-20" max="30" value="0" step="5">
                    </div>
                    <div class="bi-slider-control">
                        <div class="bi-slider-label-row">
                            <span>Inflation / Fixed Cost Delta</span>
                            <span class="bi-slider-val" id="valInflation">0%</span>
                        </div>
                        <input type="range" class="bi-range-input" id="sliderInflation" min="0" max="15" value="0" step="1">
                    </div>
                </div>
                <div class="bi-whatif-results-grid">
                    <div class="bi-whatif-kpi-card">
                        <span class="bi-whatif-kpi-lbl">Simulated Net Flow</span>
                        <span class="bi-whatif-kpi-val" id="simNetFlow">$0</span>
                    </div>
                    <div class="bi-whatif-kpi-card">
                        <span class="bi-whatif-kpi-lbl">Monthly Retained Delta</span>
                        <span class="bi-whatif-kpi-val" id="simDeltaFlow">±$0</span>
                    </div>
                    <div class="bi-whatif-kpi-card">
                        <span class="bi-whatif-kpi-lbl">Emergency Reserves Runway</span>
                        <span class="bi-whatif-kpi-val" id="simRunway">0.0 Mo</span>
                    </div>
                    <div class="bi-whatif-kpi-card">
                        <span class="bi-whatif-kpi-lbl">50/30/20 Health Score</span>
                        <span class="bi-whatif-kpi-val" id="simHealthScore">75 / 100</span>
                    </div>
                </div>
            </div>
            </div>
        `;

        targetSection.parentNode.insertBefore(ribbon, targetSection);

        // Inject Variance Decomposition Modal if not present
        if (!document.getElementById("biDecompModal")) {
            const modal = document.createElement("div");
            modal.id = "biDecompModal";
            modal.className = "bi-decomp-modal";
            modal.innerHTML = `
                <div class="bi-decomp-box">
                    <div class="bi-decomp-top">
                        <h3 class="bi-decomp-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>Variance Decomposition &amp; Cost Driver Tree</h3>
                        <button type="button" class="bi-crossfilter-close" id="biCloseDecompBtn">&times;</button>
                    </div>
                    <p style="font-size:12px;color:var(--text-muted,#9E988A);margin:0;">
                        Decomposes period-over-period spend variance across categories to isolate primary cost drivers.
                    </p>
                    <div class="bi-decomp-waterfall" id="biWaterfallContainer"></div>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById("biCloseDecompBtn")?.addEventListener("click", () => modal.classList.remove("open"));
            modal.addEventListener("click", (e) => {
                if (e.target === modal) modal.classList.remove("open");
            });
        }

        wireSlicerControls();
        wireWhatIfControls();
    }

    // 2. WIRE SLICER CONTROLS
    function wireSlicerControls() {
        // Horizon Pills
        document.querySelectorAll("#biHorizonSlicer .bi-slicer-pill").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#biHorizonSlicer .bi-slicer-pill").forEach(p => p.classList.remove("active"));
                btn.classList.add("active");
                applyHorizonPreset(btn.getAttribute("data-horizon"));
            });
        });

        // Commitment Pills
        document.querySelectorAll("#biCommitmentSlicer .bi-slicer-pill").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#biCommitmentSlicer .bi-slicer-pill").forEach(p => p.classList.remove("active"));
                btn.classList.add("active");
                triggerFilterRefresh();
            });
        });

        // Stream Pills
        document.querySelectorAll("#biStreamSlicer .bi-slicer-pill").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#biStreamSlicer .bi-slicer-pill").forEach(p => p.classList.remove("active"));
                btn.classList.add("active");
                const stream = btn.getAttribute("data-stream");
                // Synchronize with existing ledgerStreamTabs if present
                const tabBtn = document.getElementById(stream === "all" ? "tabBtnAll" : stream === "expenses" ? "tabBtnExpenses" : "tabBtnIncomes");
                if (tabBtn) tabBtn.click();
            });
        });

        // Smooth horizontal mouse wheel scroll on slicer groups
        document.querySelectorAll(".bi-slicer-group").forEach(group => {
            group.addEventListener("wheel", (e) => {
                if (e.deltaY !== 0 && group.scrollWidth > group.clientWidth) {
                    const canScrollRight = e.deltaY > 0 && (group.scrollLeft + group.clientWidth < group.scrollWidth - 2);
                    const canScrollLeft = e.deltaY < 0 && (group.scrollLeft > 2);
                    if (canScrollRight || canScrollLeft) {
                        e.preventDefault();
                        group.scrollLeft += e.deltaY;
                    }
                }
            }, { passive: false });
        });

        // Reset Slicers Button
        document.getElementById("biResetSlicersBtn")?.addEventListener("click", resetAllSlicers);
    }

    function applyHorizonPreset(horizon) {
        const startInput = document.getElementById("filterStartDate");
        const endInput = document.getElementById("filterEndDate");
        const now = new Date();
        const todayStr = toDateStr(now);

        if (horizon === "all") {
            if (startInput) startInput.value = "";
            if (endInput) endInput.value = "";
        } else if (horizon === "mtd") {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            if (startInput) startInput.value = toDateStr(firstDay);
            if (endInput) endInput.value = todayStr;
        } else if (horizon === "last30") {
            const past30 = new Date(now.getTime() - 30 * 86400000);
            if (startInput) startInput.value = toDateStr(past30);
            if (endInput) endInput.value = todayStr;
        } else if (horizon === "qtd") {
            const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
            const firstQuarterDay = new Date(now.getFullYear(), quarterMonth, 1);
            if (startInput) startInput.value = toDateStr(firstQuarterDay);
            if (endInput) endInput.value = todayStr;
        } else if (horizon === "ytd") {
            const firstYearDay = new Date(now.getFullYear(), 0, 1);
            if (startInput) startInput.value = toDateStr(firstYearDay);
            if (endInput) endInput.value = todayStr;
        } else if (horizon === "last7") {
            const past7 = new Date(now.getTime() - 7 * 86400000);
            if (startInput) startInput.value = toDateStr(past7);
            if (endInput) endInput.value = todayStr;
        }

        // Trigger filter refresh
        triggerFilterRefresh();
    }

    function resetAllSlicers() {
        // Reset horizon
        document.querySelectorAll("#biHorizonSlicer .bi-slicer-pill").forEach(p => p.classList.toggle("active", p.getAttribute("data-horizon") === "all"));
        // Reset commitment
        document.querySelectorAll("#biCommitmentSlicer .bi-slicer-pill").forEach(p => p.classList.toggle("active", p.getAttribute("data-commitment") === "all"));
        // Reset stream
        document.querySelectorAll("#biStreamSlicer .bi-slicer-pill").forEach(p => p.classList.toggle("active", p.getAttribute("data-stream") === "all"));

        const startInput = document.getElementById("filterStartDate");
        const endInput = document.getElementById("filterEndDate");
        if (startInput) startInput.value = "";
        if (endInput) endInput.value = "";

        clearCrossFilter();
    }

    // 3. BI-DIRECTIONAL CROSS-FILTERING
    function applyCrossFilter(type, value, label) {
        if (activeCrossFilter && activeCrossFilter.type === type && activeCrossFilter.value === value) {
            clearCrossFilter();
            return;
        }

        activeCrossFilter = { type, value, label };
        renderCrossFilterBadge();
        triggerFilterRefresh();
    }

    function clearCrossFilter() {
        activeCrossFilter = null;
        renderCrossFilterBadge();
        triggerFilterRefresh();
    }

    function renderCrossFilterBadge() {
        const container = document.getElementById("biCrossFilterContainer");
        if (!container) return;

        if (!activeCrossFilter) {
            container.style.display = "none";
            container.innerHTML = "";
            return;
        }

        container.style.display = "inline-flex";
        container.innerHTML = `
            <span class="bi-active-crossfilter-pill">
                <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="display:inline-block; vertical-align:-2px; margin-right:5px;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>Filtered: <strong>${escapeHtml(activeCrossFilter.label)}</strong></span>
                <button type="button" class="bi-crossfilter-close" id="biClearCrossFilterBtn" title="Clear cross-filter">&times;</button>
            </span>
        `;

        document.getElementById("biClearCrossFilterBtn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            clearCrossFilter();
        });
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function filterByPowerBI(expenses) {
        if (!Array.isArray(expenses)) return [];
        let list = [...expenses];

        // 1. Commitment Slicer
        const activeCommitment = document.querySelector("#biCommitmentSlicer .bi-slicer-pill.active")?.getAttribute("data-commitment") || "all";
        if (activeCommitment === "recurring") {
            list = list.filter(e => e.recurring || e.isRecurring);
        } else if (activeCommitment === "onetime") {
            list = list.filter(e => !(e.recurring || e.isRecurring));
        }

        // 2. Active Cross-Filter
        if (activeCrossFilter) {
            if (activeCrossFilter.type === "category") {
                list = list.filter(e => (e.categoryName || "Uncategorized") === activeCrossFilter.value);
            } else if (activeCrossFilter.type === "dayOfWeek") {
                list = list.filter(e => {
                    const d = new Date(e.expenseDate || e.date);
                    return !isNaN(d.getTime()) && d.getDay() === activeCrossFilter.value;
                });
            } else if (activeCrossFilter.type === "recurring") {
                list = list.filter(e => (!!(e.recurring || e.isRecurring)) === activeCrossFilter.value);
            } else if (activeCrossFilter.type === "anomaly") {
                const anomalies = computeAnomalies(expenses);
                const anomalyIds = new Set(anomalies.map(a => a.id));
                list = list.filter(e => anomalyIds.has(e.id));
            }
        }

        return list;
    }

    function triggerFilterRefresh() {
        updatePieVisualBrushing();
        const filterCtrl = window.dashboardFiltersController || window.DashboardFilters;
        if (filterCtrl && typeof filterCtrl.applyFilters === "function") {
            filterCtrl.applyFilters();
        } else {
            const startInput = document.getElementById("filterStartDate");
            if (startInput) {
                startInput.dispatchEvent(new Event("input", { bubbles: true }));
            }
        }
    }

    // 4. CHART CROSS-FILTER CLICK INTERCEPTORS
    function attachChartInterceptors() {
        const chartState = window.DashboardChartState;
        if (!chartState) return;

        // Hook Pie Chart (Category Breakdown)
        const pieCanvas = document.getElementById("expenseChart");
        if (pieCanvas && !pieCanvas._biWired) {
            pieCanvas._biWired = true;
            pieCanvas.addEventListener("click", (evt) => {
                if (!chartState.pieChart) return;
                const points = chartState.pieChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
                if (points.length > 0) {
                    const index = points[0].index;
                    const catName = chartState.pieChart.data.labels[index];
                    if (catName) {
                        applyCrossFilter("category", catName, catName);
                    }
                }
            });
        }

        // Hook Day of Week Chart
        const dowCanvas = document.getElementById("dayOfWeekChart");
        if (dowCanvas && !dowCanvas._biWired) {
            dowCanvas._biWired = true;
            dowCanvas.addEventListener("click", (evt) => {
                if (!chartState.dayOfWeekChart) return;
                const points = chartState.dayOfWeekChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
                if (points.length > 0) {
                    const index = points[0].index;
                    const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    applyCrossFilter("dayOfWeek", index, dayLabels[index] || `Day ${index}`);
                }
            });
        }

        // Hook Recurring Split Chart
        const recurCanvas = document.getElementById("recurringSplitChart");
        if (recurCanvas && !recurCanvas._biWired) {
            recurCanvas._biWired = true;
            recurCanvas.addEventListener("click", (evt) => {
                if (!chartState.recurringSplitChart) return;
                const points = chartState.recurringSplitChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
                if (points.length > 0) {
                    const index = points[0].index;
                    const label = chartState.recurringSplitChart.data.labels[index];
                    const isRecur = (label === 'Recurring');
                    applyCrossFilter("recurring", isRecur, label);
                }
            });
        }
    }

    // 4.5. ENTERPRISE WHAT-IF SIMULATOR & ANOMALY ENGINE
    let anomalyFilterActive = false;

    function wireWhatIfControls() {
        const whatIfBtn = document.getElementById("biWhatIfBtn");
        const drawer = document.getElementById("biWhatIfDrawer");
        whatIfBtn?.addEventListener("click", () => {
            drawer?.classList.toggle("open");
            if (drawer?.classList.contains("open")) updateWhatIfSimulation();
        });

        ["sliderSpendCut", "sliderRevShock", "sliderInflation"].forEach(id => {
            document.getElementById(id)?.addEventListener("input", updateWhatIfSimulation);
        });

        document.getElementById("biResetWhatIfBtn")?.addEventListener("click", () => {
            const s1 = document.getElementById("sliderSpendCut");
            const s2 = document.getElementById("sliderRevShock");
            const s3 = document.getElementById("sliderInflation");
            if (s1) s1.value = 0;
            if (s2) s2.value = 0;
            if (s3) s3.value = 0;
            updateWhatIfSimulation();
        });

        // Anomaly Button
        document.getElementById("biAnomalyBtn")?.addEventListener("click", () => {
            anomalyFilterActive = !anomalyFilterActive;
            if (anomalyFilterActive) {
                applyCrossFilter("anomaly", true, "Statistical Surges (Z > 2.0)");
            } else {
                clearCrossFilter();
            }
        });

        // Decomp Button
        document.getElementById("biDecompBtn")?.addEventListener("click", showDecompositionTree);
    }

    function updateWhatIfSimulation() {
        const rawExpenses = (window.allExpenses && Array.isArray(window.allExpenses)) ? window.allExpenses : [];
        const rawIncomes = (window.allIncomes && Array.isArray(window.allIncomes)) ? window.allIncomes : [];

        const spendCut = parseFloat(document.getElementById("sliderSpendCut")?.value || 0) / 100;
        const revShock = parseFloat(document.getElementById("sliderRevShock")?.value || 0) / 100;
        const inflation = parseFloat(document.getElementById("sliderInflation")?.value || 0) / 100;

        const valSpendEl = document.getElementById("valSpendCut");
        if (valSpendEl) valSpendEl.textContent = `${spendCut >= 0 ? '+' : ''}${Math.round(spendCut * 100)}%`;
        const valRevEl = document.getElementById("valRevShock");
        if (valRevEl) valRevEl.textContent = `${revShock >= 0 ? '+' : ''}${Math.round(revShock * 100)}%`;
        const valInfEl = document.getElementById("valInflation");
        if (valInfEl) valInfEl.textContent = `+${Math.round(inflation * 100)}%`;

        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();

        const baseExp = rawExpenses.filter(e => {
            const d = new Date(e.expenseDate || e.date);
            return d.getMonth() === curM && d.getFullYear() === curY;
        }).reduce((acc, e) => acc + Number(e.amount || 0), 0) || 1200;

        const baseInc = rawIncomes.filter(i => {
            const d = new Date(i.incomeDate || i.date);
            return d.getMonth() === curM && d.getFullYear() === curY;
        }).reduce((acc, i) => acc + Number(i.amount || 0), 0) || (baseExp * 1.35);

        const baseNet = baseInc - baseExp;
        const simInc = baseInc * (1 + revShock);
        const simExp = baseExp * (1 - spendCut) * (1 + inflation);
        const simNet = simInc - simExp;
        const delta = simNet - baseNet;

        const goals = window.cachedSavingsGoals || [];
        const totalSaved = goals.reduce((acc, g) => acc + Number(g.currentAmount || 0), 0) || (baseExp * 2.5);
        const dailyBurn = simExp / 30.4;
        const simRunwayMonths = dailyBurn > 0 ? (totalSaved / dailyBurn / 30.4).toFixed(1) : "0.0";

        let score = 70;
        const savRate = simInc > 0 ? (simNet / simInc) : 0;
        if (savRate >= 0.20) score += 20;
        else if (savRate >= 0.10) score += 10;
        else if (savRate < 0) score -= 25;
        score = Math.max(10, Math.min(99, Math.round(score)));

        const simNetEl = document.getElementById("simNetFlow");
        if (simNetEl) {
            simNetEl.textContent = fmt(simNet);
            simNetEl.className = `bi-whatif-kpi-val ${simNet >= 0 ? 'positive' : 'negative'}`;
        }
        const deltaEl = document.getElementById("simDeltaFlow");
        if (deltaEl) {
            deltaEl.textContent = `${delta >= 0 ? '+' : ''}${fmt(delta)}`;
            deltaEl.className = `bi-whatif-kpi-val ${delta >= 0 ? 'positive' : 'negative'}`;
        }
        const runwayEl = document.getElementById("simRunway");
        if (runwayEl) runwayEl.textContent = `${simRunwayMonths} Mo`;
        const scoreEl = document.getElementById("simHealthScore");
        if (scoreEl) scoreEl.textContent = `${score} / 100`;
    }

    function computeAnomalies(expenses) {
        if (!Array.isArray(expenses) || expenses.length < 3) return [];
        const amounts = expenses.map(e => Number(e.amount || 0));
        const n = amounts.length;
        const mean = amounts.reduce((a, b) => a + b, 0) / n;
        const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
        const stdev = Math.sqrt(variance);
        const threshold = mean + 2 * stdev;

        return expenses.filter(e => Number(e.amount || 0) > threshold).map(e => ({
            ...e,
            zScore: stdev > 0 ? ((Number(e.amount || 0) - mean) / stdev).toFixed(2) : '2.0'
        }));
    }

    function updateAnomalyBadge(expenses) {
        const anomalies = computeAnomalies(expenses);
        const txt = document.getElementById("biAnomalyBtnText");
        const btn = document.getElementById("biAnomalyBtn");
        if (!txt || !btn) return;

        if (anomalies.length > 0) {
            txt.textContent = `${anomalies.length} Surges (>2σ)`;
            btn.style.borderColor = "rgba(239, 68, 68, 0.45)";
            btn.style.color = "#EF4444";
        } else {
            txt.textContent = `0 Surges`;
            btn.style.borderColor = "rgba(16, 185, 129, 0.45)";
            btn.style.color = "#10B981";
        }
    }

    function showDecompositionTree() {
        const rawExpenses = (window.allExpenses && Array.isArray(window.allExpenses)) ? window.allExpenses : [];
        const modal = document.getElementById("biDecompModal");
        const container = document.getElementById("biWaterfallContainer");
        if (!modal || !container) return;

        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();
        const prevDate = new Date(curY, curM - 1, 1);
        const prevM = prevDate.getMonth();
        const prevY = prevDate.getFullYear();

        const curCat = {};
        const prevCat = {};

        rawExpenses.forEach(e => {
            const d = new Date(e.expenseDate || e.date);
            const cat = e.categoryName || "Uncategorized";
            const amt = Number(e.amount || 0);
            if (d.getMonth() === curM && d.getFullYear() === curY) {
                curCat[cat] = (curCat[cat] || 0) + amt;
            } else if (d.getMonth() === prevM && d.getFullYear() === prevY) {
                prevCat[cat] = (prevCat[cat] || 0) + amt;
            }
        });

        const allCats = new Set([...Object.keys(curCat), ...Object.keys(prevCat)]);
        const deltas = [];
        allCats.forEach(cat => {
            const cur = curCat[cat] || 0;
            const prev = prevCat[cat] || 0;
            deltas.push({ category: cat, delta: cur - prev, cur, prev });
        });

        deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
        const maxAbsDelta = Math.max(...deltas.map(d => Math.abs(d.delta)), 100);

        let rowsHtml = `
            <div style="display:flex;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:11px;font-weight:700;color:var(--text-muted,#9E988A);">
                <span>CATEGORY COST DRIVER</span>
                <span>VARIANCE DELTA (MOM)</span>
            </div>
        `;

        deltas.slice(0, 8).forEach(d => {
            const pctBar = Math.min(100, Math.round((Math.abs(d.delta) / maxAbsDelta) * 100));
            const isSurge = d.delta > 0;
            rowsHtml += `
                <div class="bi-waterfall-row">
                    <span class="bi-waterfall-label" title="${escapeHtml(d.category)}">${escapeHtml(d.category)}</span>
                    <div class="bi-waterfall-bar-track">
                        <div class="bi-waterfall-bar-fill ${isSurge ? 'surge' : 'savings'}" style="width:${pctBar}%;"></div>
                    </div>
                    <span class="bi-waterfall-val" style="color:${isSurge ? '#EF4444' : '#10B981'};">
                        ${isSurge ? '+' : ''}${fmt(d.delta)}
                    </span>
                </div>
            `;
        });

        if (deltas.length === 0) {
            rowsHtml += `<p style="text-align:center;color:var(--text-muted);font-size:12px;padding:12px;">No historical transactions available to decompose.</p>`;
        }

        container.innerHTML = rowsHtml;
        modal.classList.add("open");
    }

    function updatePieVisualBrushing() {
        const chartState = window.DashboardChartState;
        if (!chartState || !chartState.pieChart) return;
        const chart = chartState.pieChart;
        if (!chart.data || !chart.data.datasets || !chart.data.datasets[0]) return;

        const dataset = chart.data.datasets[0];
        if (!dataset._origBg) {
            dataset._origBg = [...(dataset.backgroundColor || [])];
        }

        if (!activeCrossFilter || activeCrossFilter.type !== "category") {
            dataset.backgroundColor = [...dataset._origBg];
        } else {
            const selectedCat = activeCrossFilter.value;
            dataset.backgroundColor = chart.data.labels.map((lbl, idx) => {
                const orig = dataset._origBg[idx] || '#C79A3E';
                return lbl === selectedCat ? orig : hexOrRgbToDim(orig, 0.20);
            });
        }
        chart.update('none');
    }

    function hexOrRgbToDim(color, alpha) {
        if (!color) return `rgba(150, 150, 150, ${alpha})`;
        if (color.startsWith('#')) {
            let r = parseInt(color.slice(1, 3), 16) || 120;
            let g = parseInt(color.slice(3, 5), 16) || 120;
            let b = parseInt(color.slice(5, 7), 16) || 120;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        if (color.startsWith('rgb')) {
            return color.replace(/rgb\(([^)]+)\)/, `rgba($1, ${alpha})`).replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3,${alpha})`);
        }
        return `rgba(150, 150, 150, ${alpha})`;
    }

    // 5. SVG MICRO-SPARKLINES & VARIANCE METRICS
    function renderSparklines(expenses, incomes) {
        renderCardSparkline("metricCardOutflow", expenses, "expenseDate", "#EF4444", "#C79A3E");
        renderCardSparkline("metricCardInflow", incomes, "incomeDate", "#10B981", "#34D399");
        renderNetFlowSparkline("metricCardNetflow", expenses, incomes);
        renderPacingGauge(expenses);
        renderPeriodVariances(expenses, incomes);
        updateAnomalyBadge(expenses);
        if (document.getElementById("biWhatIfDrawer")?.classList.contains("open")) {
            updateWhatIfSimulation();
        }
    }

    function renderCardSparkline(cardId, items, dateField, strokeColor, fillColor) {
        const card = document.getElementById(cardId);
        if (!card) return;

        let container = card.querySelector(".bi-sparkline-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "bi-sparkline-container";
            const valRow = card.querySelector(".metric-value-row");
            if (valRow && valRow.nextSibling) {
                card.insertBefore(container, valRow.nextSibling);
            } else {
                card.appendChild(container);
            }
        }

        const safeItems = Array.isArray(items) ? items : [];
        if (safeItems.length === 0) {
            container.innerHTML = "";
            return;
        }

        // Aggregate 14-day trajectory
        const now = new Date();
        const days = 14;
        const dailyMap = {};
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 86400000);
            dailyMap[toDateStr(d)] = 0;
        }

        safeItems.forEach(item => {
            const rawDate = item[dateField] || item.date || item.createdAt;
            if (!rawDate) return;
            const ds = String(rawDate).split("T")[0];
            if (dailyMap[ds] !== undefined) {
                dailyMap[ds] += Number(item.amount || 0);
            }
        });

        const values = Object.values(dailyMap);
        const maxVal = Math.max(...values, 10);
        const w = 240;
        const h = 32;
        const padding = 2;

        const points = values.map((val, idx) => {
            const x = (idx / (values.length - 1)) * w;
            const y = h - padding - (val / maxVal) * (h - 2 * padding);
            return { x, y };
        });

        const linePath = points.reduce((acc, pt, idx) => {
            return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        }, "");

        const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;
        const gradId = `sparkGrad_${cardId}`;

        container.innerHTML = `
            <svg class="bi-sparkline-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${fillColor}" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="${fillColor}" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>
                <path class="bi-sparkline-area" d="${areaPath}" fill="url(#${gradId})"/>
                <path class="bi-sparkline-path" d="${linePath}" stroke="${strokeColor}"/>
            </svg>
        `;
    }

    function renderNetFlowSparkline(cardId, expenses, incomes) {
        const card = document.getElementById(cardId);
        if (!card) return;

        let container = card.querySelector(".bi-sparkline-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "bi-sparkline-container";
            const valRow = card.querySelector(".metric-value-row");
            if (valRow && valRow.nextSibling) {
                card.insertBefore(container, valRow.nextSibling);
            } else {
                card.appendChild(container);
            }
        }

        const now = new Date();
        const days = 14;
        const netMap = {};
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 86400000);
            netMap[toDateStr(d)] = 0;
        }

        (incomes || []).forEach(inc => {
            const ds = String(inc.incomeDate || inc.date || "").split("T")[0];
            if (netMap[ds] !== undefined) netMap[ds] += Number(inc.amount || 0);
        });

        (expenses || []).forEach(exp => {
            const ds = String(exp.expenseDate || exp.date || "").split("T")[0];
            if (netMap[ds] !== undefined) netMap[ds] -= Number(exp.amount || 0);
        });

        const values = Object.values(netMap);
        const minVal = Math.min(...values, 0);
        const maxVal = Math.max(...values, 10);
        const range = (maxVal - minVal) || 10;
        const w = 240;
        const h = 32;

        const points = values.map((val, idx) => {
            const x = (idx / (values.length - 1)) * w;
            const y = h - 2 - ((val - minVal) / range) * (h - 4);
            return { x, y };
        });

        const linePath = points.reduce((acc, pt, idx) => {
            return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        }, "");

        const gradId = `sparkGrad_${cardId}`;

        container.innerHTML = `
            <svg class="bi-sparkline-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>
                <path class="bi-sparkline-area" d="${linePath} L ${w} ${h} L 0 ${h} Z" fill="url(#${gradId})"/>
                <path class="bi-sparkline-path" d="${linePath}" stroke="#3B82F6"/>
            </svg>
        `;
    }

    // Budget velocity gauge in Outflow card
    function renderPacingGauge(expenses) {
        const card = document.getElementById("metricCardOutflow");
        if (!card) return;

        let gauge = card.querySelector(".bi-pacing-gauge");
        if (!gauge) {
            gauge = document.createElement("div");
            gauge.className = "bi-pacing-gauge";
            const footer = card.querySelector(".metric-footer");
            if (footer) {
                card.insertBefore(gauge, footer);
            } else {
                card.appendChild(gauge);
            }
        }

        const now = new Date();
        const currentDay = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const monthProgress = Math.round((currentDay / daysInMonth) * 100);

        // Calculate total monthly budget
        const budgets = window.cachedBudgets || [];
        const totalBudget = budgets.reduce((acc, b) => acc + Number(b.limit || 0), 0);

        const currentMonthExpenses = (expenses || []).filter(e => {
            const d = new Date(e.expenseDate || e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const spent = currentMonthExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

        let spendPct = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;
        let pacingStatus = "safe";
        let pacingText = `${monthProgress}% through cycle`;

        if (totalBudget > 0) {
            if (spendPct > monthProgress + 15) {
                pacingStatus = "danger";
                pacingText = `${spendPct}% spent vs ${monthProgress}% cycle (Accelerated)`;
            } else if (spendPct > monthProgress) {
                pacingStatus = "warning";
                pacingText = `${spendPct}% spent vs ${monthProgress}% cycle (On Pace)`;
            } else {
                pacingStatus = "safe";
                pacingText = `${spendPct}% spent vs ${monthProgress}% cycle (Conservative)`;
            }
        }

        gauge.innerHTML = `
            <div class="bi-pacing-header">
                <span>Budget Velocity</span>
                <span>${pacingText}</span>
            </div>
            <div class="bi-pacing-track" title="${pacingText}">
                <div class="bi-pacing-fill ${pacingStatus}" style="width: ${Math.min(spendPct || monthProgress, 100)}%;"></div>
            </div>
        `;
    }

    // Period-over-period variance badges
    function renderPeriodVariances(expenses, incomes) {
        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();

        const prevDate = new Date(curY, curM - 1, 1);
        const prevM = prevDate.getMonth();
        const prevY = prevDate.getFullYear();

        // Expenses MoM
        const curExp = (expenses || []).filter(e => {
            const d = new Date(e.expenseDate || e.date);
            return d.getMonth() === curM && d.getFullYear() === curY;
        }).reduce((acc, e) => acc + Number(e.amount || 0), 0);

        const prevExp = (expenses || []).filter(e => {
            const d = new Date(e.expenseDate || e.date);
            return d.getMonth() === prevM && d.getFullYear() === prevY;
        }).reduce((acc, e) => acc + Number(e.amount || 0), 0);

        let expDelta = prevExp > 0 ? ((curExp - prevExp) / prevExp) * 100 : 0;
        updateCardVarianceBadge("metricCardOutflow", expDelta, false);

        // Incomes MoM
        const curInc = (incomes || []).filter(i => {
            const d = new Date(i.incomeDate || i.date);
            return d.getMonth() === curM && d.getFullYear() === curY;
        }).reduce((acc, i) => acc + Number(i.amount || 0), 0);

        const prevInc = (incomes || []).filter(i => {
            const d = new Date(i.incomeDate || i.date);
            return d.getMonth() === prevM && d.getFullYear() === prevY;
        }).reduce((acc, i) => acc + Number(i.amount || 0), 0);

        let incDelta = prevInc > 0 ? ((curInc - prevInc) / prevInc) * 100 : 0;
        updateCardVarianceBadge("metricCardInflow", incDelta, true);
    }

    function updateCardVarianceBadge(cardId, deltaPct, higherIsBetter) {
        const card = document.getElementById(cardId);
        if (!card) return;

        let badge = card.querySelector(".bi-variance-badge");
        if (!badge) {
            badge = document.createElement("span");
            badge.className = "bi-variance-badge";
            const header = card.querySelector(".metric-header");
            if (header) header.appendChild(badge);
        }

        const absDelta = Math.abs(deltaPct).toFixed(1);
        if (Math.abs(deltaPct) < 0.1 || isNaN(deltaPct)) {
            badge.className = "bi-variance-badge neutral";
            badge.textContent = `0% MoM`;
            return;
        }

        if (deltaPct > 0) {
            badge.className = higherIsBetter ? "bi-variance-badge up-favorable" : "bi-variance-badge up-unfavorable";
            badge.textContent = `▲ +${absDelta}% MoM`;
        } else {
            badge.className = higherIsBetter ? "bi-variance-badge down-unfavorable" : "bi-variance-badge down-favorable";
            badge.textContent = `▼ -${absDelta}% MoM`;
        }
    }

    // 6. CUMULATIVE SPEND S-CURVE VS BUDGET RUN-RATE
    function injectTrendControls() {
        const trendCard = document.querySelector(".card.trend-card");
        if (!trendCard || trendCard.querySelector(".bi-chart-segmented-control")) return;

        const heading = trendCard.querySelector(".section-heading");
        if (!heading) return;

        const control = document.createElement("div");
        control.className = "bi-chart-segmented-control";
        control.setAttribute("role", "group");
        control.setAttribute("aria-label", "Chart Pacing Display Mode");
        control.innerHTML = `
            <button type="button" class="bi-segmented-btn active" data-mode="daily">Daily Velocity</button>
            <button type="button" class="bi-segmented-btn" data-mode="cumulative">Cumulative Burn S-Curve</button>
        `;

        heading.appendChild(control);

        control.querySelectorAll(".bi-segmented-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                control.querySelectorAll(".bi-segmented-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                trendMode = btn.getAttribute("data-mode");
                renderActiveTrendChart();
            });
        });
    }

    function renderActiveTrendChart() {
        const chartCtrl = window.DashboardCharts;
        if (!chartCtrl) return;

        const rawExpenses = (window.allExpenses && Array.isArray(window.allExpenses)) ? window.allExpenses : [];
        const expenses = filterByPowerBI(rawExpenses);

        if (trendMode === "daily") {
            if (typeof chartCtrl.renderTrendChart === "function") {
                chartCtrl.renderTrendChart(expenses);
            }
            return;
        }

        // Cumulative Burn Mode
        const chartState = window.DashboardChartState;
        const canvas = document.getElementById("trendChart");
        if (!canvas || !chartState) return;

        const ctx = canvas.getContext("2d");
        const isLight = document.body.getAttribute("data-theme") === "light";
        const gridColor = isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.04)";
        const textColor = isLight ? "#6B6558" : "#A8A395";

        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentMonthExpenses = expenses.filter(e => {
            const d = new Date(e.expenseDate || e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        // Daily accumulator
        const dailyCum = [];
        let runningTotal = 0;
        const labels = [];
        for (let day = 1; day <= daysInMonth; day++) {
            labels.push(`Day ${day}`);
            const dayExpenses = currentMonthExpenses.filter(e => new Date(e.expenseDate || e.date).getDate() === day);
            const daySum = dayExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
            if (day <= now.getDate()) {
                runningTotal += daySum;
                dailyCum.push(runningTotal);
            } else {
                dailyCum.push(null); // future days
            }
        }

        // Ideal budget run-rate line
        const budgets = window.cachedBudgets || [];
        const totalBudget = budgets.reduce((acc, b) => acc + Number(b.limit || 0), 0) || (runningTotal * 1.25);
        const idealRate = labels.map((_, idx) => Math.round((totalBudget / daysInMonth) * (idx + 1)));

        if (chartState.trendChart) chartState.trendChart.destroy();

        chartState.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Cumulative Actual Spend',
                        data: dailyCum,
                        borderColor: '#C79A3E',
                        backgroundColor: 'rgba(199, 154, 62, 0.15)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 3,
                        pointRadius: 2,
                        pointHoverRadius: 6,
                    },
                    {
                        label: 'Target Budget Run-Rate',
                        data: idealRate,
                        borderColor: isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.35)',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 10 } },
                    y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: v => fmt(v) } }
                },
                plugins: {
                    legend: { display: true, labels: { color: textColor, boxWidth: 12, padding: 10 } },
                    tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y)}` } }
                }
            }
        });
    }

    // 7. PUBLIC API & INIT
    function init() {
        if (initialized) return;
        ensureSlicersRibbon();
        injectTrendControls();
        attachChartInterceptors();
        initialized = true;
    }

    // Hook into global filter chain
    function enhanceFilterHook() {
        const origFilters = window.DashboardFilters;
        if (!origFilters || origFilters._biEnhanced) return;

        // When charts re-render, re-attach click handlers and update micro-sparklines
        const origUpdateCharts = window.DashboardCharts?.updateChartsTheme;
        if (origUpdateCharts) {
            window.DashboardCharts.updateChartsTheme = function () {
                origUpdateCharts.apply(this, arguments);
                attachChartInterceptors();
            };
        }
    }

    window.DashboardPowerBI = Object.freeze({
        init,
        applyCrossFilter,
        clearCrossFilter,
        filterByPowerBI,
        renderSparklines,
        renderActiveTrendChart,
        updateWhatIfSimulation,
        showDecompositionTree,
        computeAnomalies,
        getCrossFilter: () => activeCrossFilter
    });

    // Auto-init on DOMContentLoaded or immediate if already ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            init();
            enhanceFilterHook();
        });
    } else {
        init();
        enhanceFilterHook();
    }
})();
