var elements = window.elements || window.DashboardDom?.elements || {};
var userId = window.userId || localStorage.getItem("userId");
// --- EXECUTIVE STATEMENT & INCOMES EXPORT / IMPORT CONTROLS ---
document.getElementById("exportReportPdfBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/reports/user/${userId}/export/pdf`, "executive_financial_statement.pdf", "Generating Complete Executive Financial Statement PDF...");
});

document.getElementById("exportIncomeExcelBtn")?.addEventListener("click", () => {
    downloadAuthenticated(
        `${API_BASE_URL}/incomes/user/${userId}/export/excel`,
        "incomes.xlsx",
        "Generating Incomes Excel Workbook...",
        () => exportIncomesClientSideExcel()
    );
});

document.getElementById("exportIncomeCsvBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/incomes/user/${userId}/export/csv`, "incomes.csv", "Exporting Incomes CSV...");
});

document.getElementById("exportIncomeJsonBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/incomes/user/${userId}/export/json`, "incomes.json", "Exporting Incomes JSON...");
});

document.getElementById("exportIncomePdfBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/incomes/user/${userId}/export/pdf`, "incomes_report.pdf", "Generating Incomes PDF Report...");
});

const importIncomeBtn = document.getElementById("importIncomeBtn");
const importIncomeFileInput = document.getElementById("importIncomeFileInput");

importIncomeBtn?.addEventListener("click", () => importIncomeFileInput?.click());

importIncomeFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const fname = file.name.toLowerCase();
    let endpoint = `/incomes/user/${userId}/import/csv`;
    if (fname.endsWith(".xlsx") || fname.endsWith(".xls")) {
        endpoint = `/incomes/user/${userId}/import/excel`;
    }

    try {
        TransferDock.show({
            filename: fname,
            mode: "import",
            status: "Uploading income spreadsheet..."
        });
        const data = await uploadFileWithProgress(`${API_BASE_URL}${endpoint}`, formData, (pct, loaded, total) => {
            const loadedKb = Math.round(loaded / 1024);
            const totalKb = Math.round(total / 1024);
            TransferDock.updateProgress(
                pct,
                `Uploading ${fname}`,
                `${pct}% · ${loadedKb} / ${totalKb} KB`
            );
        });
        TransferDock.updateProgress(98, "Parsing and committing income records...", "Database sync");
        TransferDock.complete(`Imported ${data.imported || 0} incomes`);
        showToast(data.message || "Incomes imported successfully!", "success");
        if (typeof window.clearApiCache === "function") window.clearApiCache();
        try { localStorage.removeItem(getCacheKey()); } catch (_) {}
        await loadDashboard(true);
    } catch (err) {
        TransferDock.fail(err.message || "Import failed");
        showToast(err.message, "error");
    } finally {
        importIncomeFileInput.value = "";
    }
});

// --- MONTHLY FINANCIAL STATEMENT & PERIOD SELECTION SYSTEM ---
const ALL_REPORT_MONTHS = [
    { num: 1, name: "Jan", full: "January" },
    { num: 2, name: "Feb", full: "February" },
    { num: 3, name: "Mar", full: "March" },
    { num: 4, name: "Apr", full: "April" },
    { num: 5, name: "May", full: "May" },
    { num: 6, name: "Jun", full: "June" },
    { num: 7, name: "Jul", full: "July" },
    { num: 8, name: "Aug", full: "August" },
    { num: 9, name: "Sep", full: "September" },
    { num: 10, name: "Oct", full: "October" },
    { num: 11, name: "Nov", full: "November" },
    { num: 12, name: "Dec", full: "December" },
];

const reportDateNow = new Date();
const currentSystemYear = reportDateNow.getFullYear();
const currentSystemMonth = reportDateNow.getMonth() + 1; // 1-indexed

let periodStartYear = currentSystemYear;
let periodStartMonth = currentSystemMonth;
let periodAvailableYears = [currentSystemYear];

let selectedReportYear = currentSystemYear;
let selectedReportMonth = currentSystemMonth;
let viewedReportYear = currentSystemYear;
let viewedReportMonth = currentSystemMonth;
let cachedReportHtml = "";

const monthlyReportPeriodModal = document.getElementById("monthlyReportPeriodModal");
const closePeriodModalBtn = document.getElementById("closePeriodModalBtn");
const reportYearChips = document.getElementById("reportYearChips");
const reportMonthGrid = document.getElementById("reportMonthGrid");
const reportPeriodBanner = document.getElementById("reportPeriodBanner");
const reportSelectedPeriodText = document.getElementById("reportSelectedPeriodText");
const reportInceptionVal = document.getElementById("reportInceptionVal");

const periodViewReportBtn = document.getElementById("periodViewReportBtn");
const periodDownloadReportBtn = document.getElementById("periodDownloadReportBtn");
const periodEmailReportBtn = document.getElementById("periodEmailReportBtn");

const monthlyReportModal = document.getElementById("monthlyReportModal");
const viewMonthlyReportBtn = document.getElementById("viewMonthlyReportBtn");
const closeMonthlyReportModalBtn = document.getElementById("closeMonthlyReportModalBtn");
const changeReportPeriodBtn = document.getElementById("changeReportPeriodBtn");
const changeReportPeriodBtnLabel = document.getElementById("changeReportPeriodBtnLabel");
const monthlyReportMeta = document.getElementById("monthlyReportMeta");
const printReportBtn = document.getElementById("printReportBtn");
const downloadHtmlReportBtn = document.getElementById("downloadHtmlReportBtn");
const emailReportBtn = document.getElementById("emailReportBtn");
const monthlyReportFrame = document.getElementById("monthlyReportFrame");

function determineAccountInception() {
    const dates = [];
    if (Array.isArray(allExpenses)) {
        allExpenses.forEach(e => {
            const d = e.expenseDate || e.date;
            if (d) dates.push(d);
        });
    }
    if (Array.isArray(allIncomes)) {
        allIncomes.forEach(i => {
            const d = i.incomeDate || i.date;
            if (d) dates.push(d);
        });
    }
    dates.sort();
    if (dates.length > 0) {
        const earliest = new Date(dates[0]);
        const eYear = earliest.getFullYear();
        const eMonth = earliest.getMonth() + 1;
        if (!isNaN(eYear) && eYear >= 2020 && eYear <= currentSystemYear) {
            periodStartYear = eYear;
            periodStartMonth = eMonth;
            const years = [];
            for (let y = eYear; y <= currentSystemYear; y++) {
                years.push(y);
            }
            periodAvailableYears = years.reverse();
            return;
        }
    }
    periodStartYear = currentSystemYear;
    periodStartMonth = 1;
    periodAvailableYears = [currentSystemYear];
}

function isPeriodMonthValid(monthNum, year) {
    if (year === currentSystemYear && monthNum > currentSystemMonth) {
        return false; // Future month
    }
    if (year === periodStartYear && monthNum < periodStartMonth) {
        return false; // Prior to inception
    }
    return true;
}

function renderPeriodPickerUI() {
    if (!reportYearChips || !reportMonthGrid) return;

    // Render Year Chips
    reportYearChips.replaceChildren();
    periodAvailableYears.forEach(y => {
        const isSelected = y === selectedReportYear;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `period-chip ${isSelected ? "active" : ""}`;
        chip.textContent = y;
        chip.addEventListener("click", () => {
            selectedReportYear = y;
            // Adjust selected month if invalid in new year
            if (selectedReportYear === currentSystemYear && selectedReportMonth > currentSystemMonth) {
                selectedReportMonth = currentSystemMonth;
            } else if (selectedReportYear === periodStartYear && selectedReportMonth < periodStartMonth) {
                selectedReportMonth = periodStartMonth;
            }
            renderPeriodPickerUI();
        });
        reportYearChips.appendChild(chip);
    });

    // Render Month Grid
    reportMonthGrid.replaceChildren();
    ALL_REPORT_MONTHS.forEach(m => {
        const isValid = isPeriodMonthValid(m.num, selectedReportYear);
        const isSelected = m.num === selectedReportMonth;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `period-month-chip ${isSelected ? "active" : ""} ${!isValid ? "disabled" : ""}`;
        chip.textContent = m.name;
        chip.title = m.full;
        if (!isValid) {
            chip.disabled = true;
        } else {
            chip.addEventListener("click", () => {
                selectedReportMonth = m.num;
                renderPeriodPickerUI();
            });
        }
        reportMonthGrid.appendChild(chip);
    });

    // Update Banner & Inception text
    const selectedMonthObj = ALL_REPORT_MONTHS.find(m => m.num === selectedReportMonth);
    const startMonthObj = ALL_REPORT_MONTHS.find(m => m.num === periodStartMonth);
    if (reportSelectedPeriodText && selectedMonthObj) {
        reportSelectedPeriodText.textContent = `${selectedMonthObj.full} ${selectedReportYear}`;
    }
    if (reportInceptionVal && startMonthObj) {
        reportInceptionVal.textContent = `${startMonthObj.full} ${periodStartYear}`;
    }
}

let currentPeriodModalMode = "view"; // "view" | "export"

function setPeriodModalMode(mode) {
    currentPeriodModalMode = mode;
    const modalIcon = document.getElementById("periodModalIcon");
    const modalTitle = document.getElementById("periodModalTitle");
    const modalSubtitle = document.getElementById("periodModalSubtitle");
    const viewActions = document.getElementById("periodViewModeActions");
    const exportActions = document.getElementById("periodExportModeActions");

    if (mode === "export") {
        if (modalIcon) modalIcon.textContent = "📥";
        if (modalTitle) modalTitle.textContent = "Export Monthly Summary";
        if (modalSubtitle) modalSubtitle.textContent = "Select statement period & format to download your financial records.";
        if (viewActions) viewActions.style.display = "none";
        if (exportActions) exportActions.style.display = "block";
    } else {
        if (modalIcon) modalIcon.textContent = "📊";
        if (modalTitle) modalTitle.textContent = "View Monthly Report";
        if (modalSubtitle) modalSubtitle.textContent = "Account inception:";
        if (viewActions) viewActions.style.display = "block";
        if (exportActions) exportActions.style.display = "none";
    }
}

function openMonthlyReportPeriodModal(initialAction = "view") {
    if (!monthlyReportPeriodModal) return;
    determineAccountInception();
    // Default to current year and month if selected is invalid
    if (!isPeriodMonthValid(selectedReportMonth, selectedReportYear)) {
        selectedReportYear = currentSystemYear;
        selectedReportMonth = currentSystemMonth;
    }
    renderPeriodPickerUI();
    setPeriodModalMode(initialAction === "export" ? "export" : "view");
    openModal(monthlyReportPeriodModal);

    if (initialAction === "export") {
        setTimeout(() => periodDownloadReportBtn?.focus(), 50);
    } else {
        setTimeout(() => periodViewReportBtn?.focus(), 50);
    }
}

document.getElementById("periodSwitchToExportBtn")?.addEventListener("click", () => {
    setPeriodModalMode("export");
});

document.getElementById("periodSwitchToViewBtn")?.addEventListener("click", () => {
    setPeriodModalMode("view");
});

closePeriodModalBtn?.addEventListener("click", () => {
    closeModal(monthlyReportPeriodModal);
});

function applyLuxuryScrollbarToReportFrame(frame) {
    if (!frame) return;
    try {
        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (!doc || !doc.head) return;
        let styleEl = doc.getElementById("custom-report-preview-scrollbars");
        if (!styleEl) {
            styleEl = doc.createElement("style");
            styleEl.id = "custom-report-preview-scrollbars";
            doc.head.appendChild(styleEl);
        }
        styleEl.textContent = `
            html, body {
                scrollbar-width: thin !important;
                scrollbar-color: rgba(199, 154, 62, 0.5) rgba(11, 13, 9, 0.9) !important;
            }
            html::-webkit-scrollbar,
            body::-webkit-scrollbar,
            ::-webkit-scrollbar {
                width: 7px !important;
                height: 7px !important;
            }
            html::-webkit-scrollbar-track,
            body::-webkit-scrollbar-track,
            ::-webkit-scrollbar-track {
                background: #0b0d09 !important;
                border-radius: 999px !important;
            }
            html::-webkit-scrollbar-thumb,
            body::-webkit-scrollbar-thumb,
            ::-webkit-scrollbar-thumb {
                background: rgba(199, 154, 62, 0.5) !important;
                border-radius: 999px !important;
                border: 1px solid transparent !important;
                background-clip: padding-box !important;
            }
            html::-webkit-scrollbar-thumb:hover,
            body::-webkit-scrollbar-thumb:hover,
            ::-webkit-scrollbar-thumb:hover {
                background: rgba(199, 154, 62, 0.85) !important;
            }
            * {
                scrollbar-width: thin !important;
                scrollbar-color: rgba(199, 154, 62, 0.5) rgba(11, 13, 9, 0.9) !important;
            }
        `;
    } catch (e) {
        // Cross-origin safety
    }
}

async function openMonthlyReportPreview(year = selectedReportYear, month = selectedReportMonth) {
    if (!monthlyReportModal) return;
    try {
        viewedReportYear = year;
        viewedReportMonth = month;
        const monthObj = ALL_REPORT_MONTHS.find(m => m.num === viewedReportMonth) || { name: `M${month}`, full: `Month ${month}` };

        setLoading(true, `Compiling financial report for ${monthObj.full} ${viewedReportYear}...`);
        const res = await fetch(`${API_BASE_URL}/reports/monthly/user/${userId}/html?year=${viewedReportYear}&month=${viewedReportMonth}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token") || token}` }
        });
        if (!res.ok) throw new Error(`Failed to load monthly report (${res.status})`);
        cachedReportHtml = await res.text();
        if (monthlyReportFrame) {
            monthlyReportFrame.onload = () => applyLuxuryScrollbarToReportFrame(monthlyReportFrame);
            monthlyReportFrame.srcdoc = cachedReportHtml;
            setTimeout(() => applyLuxuryScrollbarToReportFrame(monthlyReportFrame), 50);
            setTimeout(() => applyLuxuryScrollbarToReportFrame(monthlyReportFrame), 250);
        }
        if (monthlyReportMeta) {
            monthlyReportMeta.innerHTML = `<span class="meta-label">Executive Statement</span> <span class="meta-dot">•</span> <strong class="meta-period">${monthObj.full} ${viewedReportYear}</strong>`;
        }
        if (changeReportPeriodBtnLabel) {
            changeReportPeriodBtnLabel.textContent = `${monthObj.name} ${viewedReportYear}`;
        }
        openModal(monthlyReportModal);
    } catch (err) {
        showToast(err.message || "Unable to preview monthly report", "error");
    } finally {
        setLoading(false);
    }
}

async function downloadMonthlyReport(year = selectedReportYear, month = selectedReportMonth) {
    const monthObj = ALL_REPORT_MONTHS.find(m => m.num === month) || { full: `Month ${month}` };
    try {
        setLoading(true, `Preparing ${monthObj.full} ${year} statement download...`);
        let htmlContent = cachedReportHtml;
        if (!htmlContent || viewedReportYear !== year || viewedReportMonth !== month) {
            const res = await fetch(`${API_BASE_URL}/reports/monthly/user/${userId}/html?year=${year}&month=${month}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token") || token}` }
            });
            if (!res.ok) throw new Error(`Failed to generate report download (${res.status})`);
            htmlContent = await res.text();
        }
        const blob = new Blob([htmlContent], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `financial-statement-${year}-${String(month).padStart(2, "0")}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Financial statement for ${monthObj.full} ${year} saved.`, "success");
    } catch (err) {
        showToast(err.message || "Failed to download report", "error");
    } finally {
        setLoading(false);
    }
}

async function emailMonthlyReport(year = selectedReportYear, month = selectedReportMonth) {
    const monthObj = ALL_REPORT_MONTHS.find(m => m.num === month) || { full: `Month ${month}` };
    try {
        setLoading(true, `Dispatching ${monthObj.full} ${year} report to your email...`);
        const res = await apiRequest(`/reports/monthly/user/${userId}/send-email?year=${year}&month=${month}`, { method: "POST" });
        showToast(res?.message || `Financial statement for ${monthObj.full} ${year} emailed successfully!`, "success");
    } catch (err) {
        showToast("Email is not configured. Starting report download instead...", "warning");
        await downloadMonthlyReport(year, month);
    } finally {
        setLoading(false);
    }
}

async function exportMonthlyCsv(year = selectedReportYear, month = selectedReportMonth) {
    const monthObj = ALL_REPORT_MONTHS.find(m => m.num === month) || { full: `Month ${month}` };
    try {
        setLoading(true, `Exporting CSV transactions for ${monthObj.full} ${year}...`);
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const monthlyExpenses = (allExpenses || []).filter(e => {
            const d = e.expenseDate || e.date;
            return d && d >= startDate && d <= endDate;
        });
        const monthlyIncomes = (allIncomes || []).filter(i => {
            const d = i.incomeDate || i.date;
            return d && d >= startDate && d <= endDate;
        });

        const sanitizeCsvCell = (val) => {
            if (val === null || val === undefined) return '""';
            let str = String(val);
            if (/^[=+\-@\t\r%]/.test(str)) {
                str = "'" + str;
            }
            return '"' + str.replace(/"/g, '""') + '"';
        };

        let csv = "Type,Date,Description,Category/Source,Amount,Payment Method\n";
        monthlyExpenses.forEach(e => {
            const catName = getCategoryName(e.categoryId) || "Uncategorized";
            csv += `Expense,${e.expenseDate || e.date || ""},${sanitizeCsvCell(e.description || "")},${sanitizeCsvCell(catName)},${e.amount || 0},${sanitizeCsvCell(e.paymentMethod || "CASH")}\n`;
        });
        monthlyIncomes.forEach(i => {
            const catName = i.source || "Income";
            csv += `Income,${i.incomeDate || i.date || ""},${sanitizeCsvCell(i.description || i.source || "")},${sanitizeCsvCell(catName)},${i.amount || 0},${sanitizeCsvCell(i.paymentMethod || "CASH")}\n`;
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `financial-ledger-${year}-${String(month).padStart(2, "0")}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Monthly transactions CSV downloaded for ${monthObj.full} ${year}.`, "success");
    } catch (err) {
        showToast(err.message || "Failed to export CSV", "error");
    } finally {
        setLoading(false);
    }
}

async function exportMonthlyJson(year = selectedReportYear, month = selectedReportMonth) {
    const monthObj = ALL_REPORT_MONTHS.find(m => m.num === month) || { full: `Month ${month}` };
    try {
        setLoading(true, `Exporting JSON analytics for ${monthObj.full} ${year}...`);
        const report = await apiRequest(`/reports/monthly/user/${userId}?year=${year}&month=${month}`, { method: "GET" });
        const jsonStr = JSON.stringify(report, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `monthly-analytics-${year}-${String(month).padStart(2, "0")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Monthly JSON analytics downloaded for ${monthObj.full} ${year}.`, "success");
    } catch (err) {
        showToast(err.message || "Failed to export JSON analytics", "error");
    } finally {
        setLoading(false);
    }
}

// Action button listeners in Period Picker Modal
periodViewReportBtn?.addEventListener("click", () => {
    closeModal(monthlyReportPeriodModal);
    openMonthlyReportPreview(selectedReportYear, selectedReportMonth);
});

async function downloadMonthlyPdf(year = selectedReportYear, month = selectedReportMonth) {
    if (!userId) {
        showToast("Session expired, please sign in again.", "error");
        return;
    }
    try {
        const targetYear = year || selectedReportYear || new Date().getFullYear();
        const targetMonth = month || selectedReportMonth || (new Date().getMonth() + 1);
        const padMonth = String(targetMonth).padStart(2, "0");
        const lastDay = new Date(targetYear, targetMonth, 0).getDate();
        const from = `${targetYear}-${padMonth}-01`;
        const to = `${targetYear}-${padMonth}-${String(lastDay).padStart(2, "0")}`;
        const curr = (typeof userCurrency !== "undefined" && userCurrency) ? userCurrency : (localStorage.getItem("preferredCurrency") || "INR");
        const url = `${API_BASE_URL}/reports/user/${userId}/export/range/pdf?from=${from}&to=${to}&currency=${encodeURIComponent(curr)}`;
        const monthObj = (typeof ALL_REPORT_MONTHS !== "undefined" && Array.isArray(ALL_REPORT_MONTHS))
            ? (ALL_REPORT_MONTHS.find(m => m.num === targetMonth) || { name: `Month_${padMonth}` })
            : { name: `Month_${padMonth}` };
        downloadAuthenticated(
            url,
            `ExpenseTracker_Statement_${monthObj.name}_${targetYear}.pdf`,
            `Generating ${monthObj.name} ${targetYear} Executive PDF Statement...`
        );
    } catch (err) {
        showToast(err.message || "Failed to download PDF report", "error");
    }
}

async function downloadMonthlyExcel(year = selectedReportYear, month = selectedReportMonth) {
    if (!userId) {
        showToast("Session expired, please sign in again.", "error");
        return;
    }
    try {
        const targetYear = year || selectedReportYear || new Date().getFullYear();
        const targetMonth = month || selectedReportMonth || (new Date().getMonth() + 1);
        const padMonth = String(targetMonth).padStart(2, "0");
        const lastDay = new Date(targetYear, targetMonth, 0).getDate();
        const from = `${targetYear}-${padMonth}-01`;
        const to = `${targetYear}-${padMonth}-${String(lastDay).padStart(2, "0")}`;
        const curr = (typeof userCurrency !== "undefined" && userCurrency) ? userCurrency : (localStorage.getItem("preferredCurrency") || "INR");
        const url = `${API_BASE_URL}/reports/user/${userId}/export/range/excel?from=${from}&to=${to}&currency=${encodeURIComponent(curr)}`;
        const monthObj = (typeof ALL_REPORT_MONTHS !== "undefined" && Array.isArray(ALL_REPORT_MONTHS))
            ? (ALL_REPORT_MONTHS.find(m => m.num === targetMonth) || { name: `Month_${padMonth}` })
            : { name: `Month_${padMonth}` };
        downloadAuthenticated(
            url,
            `ExpenseTracker_Workbook_${monthObj.name}_${targetYear}.xlsx`,
            `Generating ${monthObj.name} ${targetYear} PowerBI Excel Workbook...`
        );
    } catch (err) {
        showToast(err.message || "Failed to download Excel workbook", "error");
    }
}

periodDownloadReportBtn?.addEventListener("click", () => {
    downloadMonthlyReport(selectedReportYear, selectedReportMonth);
});

document.getElementById("periodDownloadPdfBtn")?.addEventListener("click", () => {
    downloadMonthlyPdf(selectedReportYear, selectedReportMonth);
});

document.getElementById("periodDownloadExcelBtn")?.addEventListener("click", () => {
    downloadMonthlyExcel(selectedReportYear, selectedReportMonth);
});

document.getElementById("periodExportCsvBtn")?.addEventListener("click", () => {
    exportMonthlyCsv(selectedReportYear, selectedReportMonth);
});

document.getElementById("periodExportJsonBtn")?.addEventListener("click", () => {
    exportMonthlyJson(selectedReportYear, selectedReportMonth);
});

periodEmailReportBtn?.addEventListener("click", () => {
    emailMonthlyReport(selectedReportYear, selectedReportMonth);
});

// Profile avatar menu triggers -> open Period Picker Modal
viewMonthlyReportBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleProfileMenu(false);
    openMonthlyReportPeriodModal("view");
});

// Toolbar buttons inside Preview Modal
changeReportPeriodBtn?.addEventListener("click", () => {
    closeModal(monthlyReportModal);
    selectedReportYear = viewedReportYear;
    selectedReportMonth = viewedReportMonth;
    openMonthlyReportPeriodModal("view");
});

closeMonthlyReportModalBtn?.addEventListener("click", () => closeModal(monthlyReportModal));

printReportBtn?.addEventListener("click", () => {
    if (monthlyReportFrame && monthlyReportFrame.contentWindow) {
        monthlyReportFrame.contentWindow.focus();
        monthlyReportFrame.contentWindow.print();
    }
});

downloadHtmlReportBtn?.addEventListener("click", () => {
    downloadMonthlyReport(viewedReportYear, viewedReportMonth);
});

emailReportBtn?.addEventListener("click", () => {
    emailMonthlyReport(viewedReportYear, viewedReportMonth);
});


// Dashboard refreshes are event-driven; tab visibility alone does not reset state or clear caches.
// Throttled focus refresh: at most once per 60 seconds to avoid hammering the API on every alt-tab.
let lastFocusRefresh = 0;
window.addEventListener("focus", () => {
    const now = Date.now();
    if (now - lastFocusRefresh < 60000) return;
    lastFocusRefresh = now;
    loadDashboard(true);
});

// Dashboard refreshes are event-driven; idle pages are not re-rendered.
// --- CATEGORY PILLS HORIZONTAL OVERFLOW INDICATOR & SCROLL SYSTEM ---
function bindCategoryPillsScrollCues() {
    const configs = [
        { barId: "categoryPillsBar", wrapperId: "categoryPillsWrapper", cueId: "expensePillsScrollCue" },
        { barId: "incomePillsBar", wrapperId: "incomePillsWrapper", cueId: "incomePillsScrollCue" }
    ];

    configs.forEach(({ barId, wrapperId, cueId }) => {
        const bar = document.getElementById(barId);
        const wrapper = document.getElementById(wrapperId) || (bar ? bar.closest(".category-pills-wrapper") : null);
        const cue = document.getElementById(cueId);
        if (!bar || !wrapper || !cue) return;

        function updateCue() {
            const maxScrollLeft = bar.scrollWidth - bar.clientWidth;
            const hasOverflow = maxScrollLeft > 8;
            if (hasOverflow) {
                wrapper.classList.add("has-overflow-right");
                const atEnd = (maxScrollLeft - bar.scrollLeft) <= 10;
                const cueText = cue.querySelector(".cue-text");
                const cueArrow = cue.querySelector(".cue-arrow");
                if (atEnd) {
                    if (cueText) cueText.textContent = "Start";
                    if (cueArrow) cueArrow.style.transform = "rotate(180deg)";
                    cue.title = "Scroll back to start";
                    cue.setAttribute("aria-label", "Scroll back to start");
                } else {
                    if (cueText) cueText.textContent = "More";
                    if (cueArrow) cueArrow.style.transform = "rotate(0deg)";
                    cue.title = "Scroll to see more";
                    cue.setAttribute("aria-label", "Scroll to see more");
                }
            } else {
                wrapper.classList.remove("has-overflow-right");
            }
        }

        bar.addEventListener("scroll", updateCue, { passive: true });
        window.addEventListener("resize", updateCue, { passive: true });

        if (!cue.dataset.bound) {
            cue.dataset.bound = "true";
            cue.addEventListener("click", () => {
                const maxScrollLeft = bar.scrollWidth - bar.clientWidth;
                if ((maxScrollLeft - bar.scrollLeft) <= 10) {
                    bar.scrollTo({ left: 0, behavior: "smooth" });
                } else {
                    bar.scrollBy({ left: 180, behavior: "smooth" });
                }
            });
        }

        updateCue();
        setTimeout(updateCue, 100);
        setTimeout(updateCue, 400);

        if (!bar.dataset.observed) {
            bar.dataset.observed = "true";
            const obs = new MutationObserver(() => {
                setTimeout(updateCue, 50);
            });
            obs.observe(bar, { childList: true, subtree: true });
        }
    });
}
// Use the standard ready() pattern — dashboard.js is loaded at the end of <body>, so
// readyState is usually already "interactive" or "complete". Running both branches would
// attach MutationObserver twice in some timing scenarios.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindCategoryPillsScrollCues, { once: true });
} else {
    bindCategoryPillsScrollCues();
}

function updateStreamBadges() {
    const expCount = (allExpenses || []).length;
    const incCount = (allIncomes || []).length;
    const totalCount = expCount + incCount;
    
    const bAll = document.getElementById("badgeAllCount");
    const bExp = document.getElementById("badgeExpensesCount");
    const bInc = document.getElementById("badgeIncomesCount");
    const colExp = document.getElementById("colExpenseCount");
    const colInc = document.getElementById("colIncomeCount");
    
    if (bAll) bAll.textContent = totalCount;
    if (bExp) bExp.textContent = expCount;
    if (bInc) bInc.textContent = incCount;
    if (colExp) colExp.textContent = `${expCount} item${expCount === 1 ? "" : "s"}`;
    if (colInc) colInc.textContent = `${incCount} item${incCount === 1 ? "" : "s"}`;
}
window.updateStreamBadges = updateStreamBadges;

function initLedgerStreamTabs() {
    const tabs = document.querySelectorAll("#ledgerStreamTabs .stream-pill-btn");
    const grid = document.getElementById("unifiedLedgerGrid");
    const incPills = document.getElementById("incomePillsWrapper");
    const expPills = document.getElementById("categoryPillsWrapper");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => {
                t.classList.remove("active");
                t.style.background = "transparent";
                t.style.color = "var(--text-muted)";
                t.style.borderColor = "transparent";
            });
            tab.classList.add("active");
            tab.style.background = "var(--card-bg, rgba(255,255,255,0.08))";
            tab.style.color = "var(--text-main)";
            tab.style.borderColor = "var(--border)";

            const mode = tab.getAttribute("data-tab");
            if (grid) {
                grid.classList.remove("view-expenses", "view-incomes");
                if (mode === "expenses") {
                    grid.classList.add("view-expenses");
                    if (expPills) expPills.style.display = "flex";
                    if (incPills) incPills.style.display = "none";
                } else if (mode === "incomes") {
                    grid.classList.add("view-incomes");
                    if (expPills) expPills.style.display = "none";
                    if (incPills) incPills.style.display = "flex";
                } else {
                    if (expPills) expPills.style.display = "flex";
                    if (incPills) incPills.style.display = "none";
                }
            }
        });
    });
    // Touch gesture swipe support for cycling between stream tabs (All <-> Expenses <-> Incomes)
    const targetSwipeElements = [
        document.getElementById("ledgerStreamTabs"),
        document.getElementById("unifiedLedgerCard"),
        grid,
        document.getElementById("recentTransactionsTable")
    ].filter(Boolean);

    targetSwipeElements.forEach(el => {
        let touchStartX = 0;
        let touchStartY = 0;
        let swiped = false;

        el.addEventListener("touchstart", (e) => {
            if (e.touches.length !== 1 || window._isGlobalRowSwiping) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            swiped = false;
        }, { passive: true });

        el.addEventListener("touchend", (e) => {
            if (swiped || e.changedTouches.length !== 1 || window._isGlobalRowSwiping) return;
            const diffX = e.changedTouches[0].clientX - touchStartX;
            const diffY = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
                swiped = true;
                const modes = ["all", "expenses", "incomes"];
                const activeTab = document.querySelector("#ledgerStreamTabs .stream-pill-btn.active");
                const currentMode = activeTab ? activeTab.getAttribute("data-tab") : "all";
                const currentIndex = modes.indexOf(currentMode);
                if (currentIndex !== -1) {
                    if (diffX < 0 && currentIndex < modes.length - 1) {
                        navigator.vibrate?.(15);
                        const nextTab = document.querySelector(`#ledgerStreamTabs .stream-pill-btn[data-tab="${modes[currentIndex + 1]}"]`);
                        if (nextTab) nextTab.click();
                    } else if (diffX > 0 && currentIndex > 0) {
                        navigator.vibrate?.(15);
                        const prevTab = document.querySelector(`#ledgerStreamTabs .stream-pill-btn[data-tab="${modes[currentIndex - 1]}"]`);
                        if (prevTab) prevTab.click();
                    }
                }
            }
        }, { passive: true });
    });

    updateStreamBadges();
}
window.initLedgerStreamTabs = initLedgerStreamTabs;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLedgerStreamTabs);
} else {
    initLedgerStreamTabs();
}


// Security PIN Modal & Account Recovery Management
const securityPinModal = document.getElementById("securityPinModal");
const securityPinBtn = document.getElementById("securityPinBtn");
const closeSecurityPinModalBtn = document.getElementById("closeSecurityPinModalBtn");
const securityPinForm = document.getElementById("securityPinForm");
const pinStatusIndicator = document.getElementById("pinStatusIndicator");

async function openSecurityPinDialog() {
    toggleProfileMenu(false);
    if (!securityPinModal) return;
    try {
        const userProf = await apiRequest(`/users/${userId}`);
        const hasPin = !!(userProf && userProf.hasSecurityPin);
        if (pinStatusIndicator) {
            pinStatusIndicator.style.background = hasPin ? "rgba(76, 122, 120, 0.15)" : "rgba(230, 162, 60, 0.15)";
            pinStatusIndicator.style.border = `1px solid ${hasPin ? "#4C7A78" : "#E6A23C"}`;
            pinStatusIndicator.style.color = hasPin ? "#4C7A78" : "#E6A23C";
            pinStatusIndicator.innerHTML = hasPin
                ? `<span>🔒 <strong>Active:</strong> 6-Digit PIN is set. Enter a new PIN below if you want to update it.</span>`
                : `<span>⚠️ <strong>Not Configured:</strong> Set a 6-digit PIN below for zero-email instant recovery.</span>`;
        }
    } catch (err) {
        console.warn("Could not fetch user security status:", err);
    }
    const newPinEl = document.getElementById("newSecurityPin");
    const confirmPinEl = document.getElementById("confirmSecurityPin");
    if (newPinEl) newPinEl.value = "";
    if (confirmPinEl) confirmPinEl.value = "";
    openModal(securityPinModal);
}

securityPinBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openSecurityPinDialog();
});

closeSecurityPinModalBtn?.addEventListener("click", () => {
    closeModal(securityPinModal);
});

securityPinModal?.addEventListener("click", (e) => {
    if (e.target === securityPinModal) closeModal(securityPinModal);
});

securityPinForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPin = (document.getElementById("newSecurityPin")?.value || "").trim();
    const confirmPin = (document.getElementById("confirmSecurityPin")?.value || "").trim();

    if (!/^[0-9]{6}$/.test(newPin)) {
        return showToast("PIN must be exactly 6 numeric digits.", "error");
    }
    if (newPin !== confirmPin) {
        return showToast("PINs do not match.", "error");
    }

    const submitBtn = securityPinForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        await apiRequest(`/users/${userId}/security-pin`, {
            method: "PUT",
            body: JSON.stringify({ securityPin: newPin })
        });
        showToast("Security PIN updated successfully! 🔒", "success");
        closeModal(securityPinModal);
    } catch (err) {
        showToast(err.message || "Failed to update Security PIN", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
});

// ─── Biometric Authentication (Touch ID / Face ID / Windows Hello) ─────────
const biometricAuthBtn = document.getElementById("biometricAuthBtn");
biometricAuthBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!window.WebBiometrics) {
        showToast("Biometric module not initialized.", "error");
        return;
    }
    const isAvail = await WebBiometrics.isAvailable();
    if (!isAvail) {
        showToast("Biometric hardware (Touch ID / Face ID / Windows Hello) is not detected or supported on this browser.", "warning");
        return;
    }
    const token = localStorage.getItem("token");
    const userEmail = localStorage.getItem("userEmail") || (window.currentUser && window.currentUser.email) || "user";
    try {
        await WebBiometrics.enroll(userEmail, token);
        showToast("Biometric authentication (Touch ID / Face ID) activated successfully for this device! 🧬", "success");
    } catch (err) {
        showToast(err.message || "Biometric registration was cancelled.", "info");
    }
});

// ─── Proactive Server Reconnection Auto-Refresh ──────────────────────
document.addEventListener("serverreconnected", () => {
    console.log("[Dashboard] Server reconnected proactively. Refreshing dashboard data...");
    showToast("Server reconnected. Live data restored.", "success");
    if (typeof loadDashboard === "function") {
        loadDashboard(true);
    }
});

// Help Guide & About Modals
const helpGuideModal = document.getElementById("helpGuideModal");
const aboutSystemModal = document.getElementById("aboutSystemModal");

function openHelpModal() {
    if (typeof toggleProfileMenu === "function") toggleProfileMenu(false);
    if (typeof openModal === "function" && helpGuideModal) openModal(helpGuideModal);
}
function openAboutModal() {
    if (typeof toggleProfileMenu === "function") toggleProfileMenu(false);
    if (typeof openModal === "function" && aboutSystemModal) openModal(aboutSystemModal);
}

document.getElementById("headerHelpBtn")?.addEventListener("click", openHelpModal);
document.getElementById("helpGuideModalBtn")?.addEventListener("click", (e) => { e.preventDefault(); openHelpModal(); });
document.getElementById("closeHelpGuideModal")?.addEventListener("click", () => { if (typeof closeModal === "function" && helpGuideModal) closeModal(helpGuideModal); });
document.getElementById("gotItHelpBtn")?.addEventListener("click", () => { if (typeof closeModal === "function" && helpGuideModal) closeModal(helpGuideModal); });
helpGuideModal?.addEventListener("click", (e) => { if (e.target === helpGuideModal && typeof closeModal === "function") closeModal(helpGuideModal); });

document.getElementById("aboutSystemModalBtn")?.addEventListener("click", (e) => { e.preventDefault(); openAboutModal(); });
document.getElementById("closeAboutModal")?.addEventListener("click", () => { if (typeof closeModal === "function" && aboutSystemModal) closeModal(aboutSystemModal); });
document.getElementById("closeAboutBtn")?.addEventListener("click", () => { if (typeof closeModal === "function" && aboutSystemModal) closeModal(aboutSystemModal); });
aboutSystemModal?.addEventListener("click", (e) => { if (e.target === aboutSystemModal && typeof closeModal === "function") closeModal(aboutSystemModal); });

window.openHelpModal = openHelpModal;
window.openAboutModal = openAboutModal;

loadDashboard();
