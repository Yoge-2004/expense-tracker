/**
 * Command Palette Controller (Cmd + K / Ctrl + K)
 * Fast, keyboard-first spotlight launcher with captured navigation priority.
 */
(function (global) {
    "use strict";

    const COMMANDS = [
        {
            id: "record-expense",
            title: "Record Expense",
            icon: "💸",
            category: "Actions",
            badge: "Add",
            keywords: "expense spend cost record pay",
            run: () => {
                const btn = document.getElementById("addExpenseBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "scan-receipt",
            title: "Scan Receipt / Bill (OCR)",
            icon: "📷",
            category: "Actions",
            badge: "OCR",
            keywords: "scan receipt bill invoice camera ocr image photo",
            run: () => {
                const addBtn = document.getElementById("addExpenseBtn");
                if (addBtn) addBtn.click();
                setTimeout(() => {
                    const fileInput = document.getElementById("receiptFileInput");
                    if (fileInput) fileInput.click();
                }, 300);
            }
        },
        {
            id: "add-income",
            title: "Add Income Stream",
            icon: "💰",
            category: "Actions",
            badge: "Add",
            keywords: "income salary deposit earn inflow",
            run: () => {
                const btn = document.getElementById("addIncomeBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "export-workbook",
            title: "Export Executive Workbook (Excel)",
            icon: "📊",
            category: "Reports",
            badge: "Excel",
            keywords: "excel report workbook statement download export poi",
            run: () => {
                const btn = document.getElementById("exportReportExcelBtn") || document.getElementById("exportExcelBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "export-statement-pdf",
            title: "Export Executive Statement (PDF)",
            icon: "📑",
            category: "Reports",
            badge: "PDF",
            keywords: "pdf report statement download print export",
            run: () => {
                const btn = document.getElementById("exportReportPdfBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "export-expenses-excel",
            title: "Export Expenses Spreadsheet (Excel)",
            icon: "📗",
            category: "Exports",
            badge: "Expenses",
            keywords: "expenses excel xlsx export download",
            run: () => {
                const btn = document.getElementById("exportExcelBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "export-incomes-excel",
            title: "Export Incomes Spreadsheet (Excel)",
            icon: "💵",
            category: "Exports",
            badge: "Incomes",
            keywords: "incomes excel xlsx export download",
            run: () => {
                const btn = document.getElementById("exportIncomeExcelBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "manage-budgets",
            title: "Manage Category Budgets",
            icon: "💼",
            category: "Management",
            badge: "Budgets",
            keywords: "budget spending limit category plan",
            run: () => {
                const btn = document.getElementById("setBudgetBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "manage-savings",
            title: "Manage Savings Goals",
            icon: "🎯",
            category: "Management",
            badge: "Savings",
            keywords: "savings goal target fund emergency",
            run: () => {
                const btn = document.getElementById("addSavingsGoalBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "toggle-theme",
            title: "Toggle Theme (Dark / Light)",
            icon: "🌓",
            category: "Preferences",
            badge: "Appearance",
            keywords: "theme mode dark light color appearance",
            run: () => {
                if (typeof toggleGlobalTheme === "function") {
                    toggleGlobalTheme();
                } else {
                    const btn = document.getElementById("themeToggleBtn");
                    if (btn) btn.click();
                }
            }
        },
        {
            id: "refresh-data",
            title: "Refresh Live Ledger Data",
            icon: "🔄",
            category: "Data",
            badge: "Sync",
            keywords: "refresh reload sync pull data update",
            run: () => {
                if (typeof fetchDashboardData === "function") {
                    fetchDashboardData();
                    if (typeof showToast === "function") showToast("Syncing latest transactions...", "info");
                }
            }
        },
        {
            id: "help-guide",
            title: "User Guide & Feature Walkthrough",
            icon: "📖",
            category: "Help",
            badge: "Guide",
            keywords: "help guide walkthrough faq docs how to manual tutorial",
            run: () => {
                if (typeof window.openHelpModal === "function") {
                    window.openHelpModal();
                } else {
                    const btn = document.getElementById("helpGuideModalBtn");
                    if (btn) btn.click();
                }
            }
        },
        {
            id: "about-system",
            title: "About ExpenseTracker System",
            icon: "ℹ️",
            category: "Help",
            badge: "About",
            keywords: "about system info version license creator privacy architecture",
            run: () => {
                if (typeof window.openAboutModal === "function") {
                    window.openAboutModal();
                } else {
                    const btn = document.getElementById("aboutSystemModalBtn");
                    if (btn) btn.click();
                }
            }
        }
    ];

    let overlayEl = null;
    let inputEl = null;
    let resultsEl = null;
    let selectedIndex = 0;
    let filteredCommands = [...COMMANDS];

    function isOpen() {
        return !!(overlayEl && overlayEl.classList.contains("open"));
    }

    function createPaletteDOM() {
        if (typeof document === "undefined") return;
        if (overlayEl && document.body.contains(overlayEl)) return;

        overlayEl = document.createElement("div");
        overlayEl.id = "commandPaletteOverlay";
        overlayEl.className = "command-palette-overlay";
        overlayEl.style.display = "none";

        overlayEl.innerHTML = `
            <div class="command-palette-modal" id="commandPaletteModal" role="dialog" aria-modal="true" aria-label="Command Palette">
                <div class="command-palette-search-wrap">
                    <svg class="command-palette-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" id="commandPaletteInput" class="command-palette-input" placeholder="Type an action or search... (↑↓ to select, Enter to run, Esc to close)" autocomplete="off" spellcheck="false">
                    <kbd class="command-palette-kbd">ESC</kbd>
                </div>
                <div class="command-palette-results" id="commandPaletteResults"></div>
                <div class="command-palette-footer">
                    <span class="cp-footer-hint"><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
                    <span class="cp-footer-hint"><kbd>↵</kbd> Select</span>
                    <span class="cp-footer-hint"><kbd>Esc</kbd> Dismiss</span>
                </div>
            </div>
        `;

        document.body.appendChild(overlayEl);

        inputEl = document.getElementById("commandPaletteInput");
        resultsEl = document.getElementById("commandPaletteResults");

        overlayEl.addEventListener("click", (e) => {
            if (e.target === overlayEl) close();
        });

        inputEl?.addEventListener("input", (e) => {
            filter(e.target.value);
        });
    }

    function filter(query) {
        const q = (query || "").trim().toLowerCase();
        if (!q) {
            filteredCommands = [...COMMANDS];
        } else {
            filteredCommands = COMMANDS.filter(cmd =>
                cmd.title.toLowerCase().includes(q) ||
                cmd.category.toLowerCase().includes(q) ||
                cmd.keywords.toLowerCase().includes(q)
            );
        }
        selectedIndex = 0;
        renderResults();
    }

    function renderResults() {
        if (!resultsEl) return;
        if (filteredCommands.length === 0) {
            resultsEl.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">No commands matching your search.</div>`;
            return;
        }

        resultsEl.innerHTML = filteredCommands.map((cmd, idx) => `
            <div class="command-palette-item ${idx === selectedIndex ? 'active' : ''}" data-idx="${idx}">
                <div class="cp-item-left">
                    <span class="cp-item-icon">${cmd.icon}</span>
                    <span class="cp-item-title">${escapeHtml(cmd.title)}</span>
                </div>
                <span class="cp-item-badge">${escapeHtml(cmd.badge)}</span>
            </div>
        `).join("");

        const items = resultsEl.querySelectorAll(".command-palette-item");
        items.forEach(el => {
            el.addEventListener("mouseenter", () => {
                const idx = parseInt(el.getAttribute("data-idx"), 10);
                if (!isNaN(idx)) {
                    selectedIndex = idx;
                    updateActiveItemVisuals();
                }
            });
            el.addEventListener("click", () => {
                const idx = parseInt(el.getAttribute("data-idx"), 10);
                if (!isNaN(idx)) {
                    selectedIndex = idx;
                    executeCurrent();
                }
            });
        });

        scrollToActiveItem();
    }

    function updateActiveItemVisuals() {
        if (!resultsEl) return;
        const items = resultsEl.querySelectorAll(".command-palette-item");
        items.forEach((item, idx) => {
            if (idx === selectedIndex) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });
        scrollToActiveItem();
    }

    function scrollToActiveItem() {
        if (!resultsEl) return;
        const items = resultsEl.querySelectorAll(".command-palette-item");
        const activeItem = items[selectedIndex];
        if (activeItem) {
            activeItem.scrollIntoView({ block: "nearest" });
        }
    }

    function executeCurrent() {
        if (filteredCommands[selectedIndex]) {
            const cmd = filteredCommands[selectedIndex];
            close();
            try {
                cmd.run();
            } catch (err) {
                console.error("[CommandPalette] Action execution failed:", err);
            }
        }
    }

    function open() {
        createPaletteDOM();
        filteredCommands = [...COMMANDS];
        selectedIndex = 0;
        if (inputEl) inputEl.value = "";
        renderResults();

        if (overlayEl) {
            overlayEl.style.display = "flex";
            requestAnimationFrame(() => {
                overlayEl.classList.add("open");
                if (inputEl) {
                    inputEl.focus();
                    inputEl.select();
                }
            });
            setTimeout(() => {
                if (inputEl) inputEl.focus();
            }, 50);
        }
    }

    function close() {
        if (!overlayEl) return;
        overlayEl.classList.remove("open");
        setTimeout(() => {
            overlayEl.style.display = "none";
        }, 180);
    }

    function toggle() {
        if (isOpen()) {
            close();
        } else {
            open();
        }
    }

    function escapeHtml(str) {
        return (str || "").replace(/[&<>'"]/g, tag => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
        }[tag] || tag));
    }

    // High-priority Capture Phase Key Listener:
    // Intercepts navigation keys (ArrowUp, ArrowDown, Enter, Escape) before any other dashboard script can consume them.
    if (typeof window !== "undefined") {
        window.addEventListener("keydown", (e) => {
            const isK = e.key === "k" || e.key === "K" || e.code === "KeyK";
            const isModifier = e.metaKey || e.ctrlKey;

            // 1. Toggle with Cmd+K or Ctrl+K
            if (isModifier && isK) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                toggle();
                return;
            }

            // 2. If open, capture all navigation keys so nothing in dashboard intercepts them
            if (isOpen()) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (filteredCommands.length > 0) {
                        selectedIndex = (selectedIndex + 1) % filteredCommands.length;
                        updateActiveItemVisuals();
                    }
                    return;
                }

                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (filteredCommands.length > 0) {
                        selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
                        updateActiveItemVisuals();
                    }
                    return;
                }

                if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    executeCurrent();
                    return;
                }

                if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    close();
                    return;
                }
            }
        }, true); // TRUE = CAPTURE PHASE! Intercept before bubble phase listeners
    }

    if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", createPaletteDOM);
        } else {
            createPaletteDOM();
        }
    }

    global.CommandPalette = {
        open,
        close,
        toggle,
        isOpen,
        register(cmd) {
            COMMANDS.push(cmd);
        }
    };

})(typeof window !== "undefined" ? window : globalThis);
