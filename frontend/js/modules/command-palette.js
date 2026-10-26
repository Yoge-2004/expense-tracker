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
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>',
            category: "Actions",
            badge: "Add",
            keywords: "expense spend cost record pay",
            run: () => {
                const btn = document.getElementById("openModalBtn") || document.getElementById("addExpenseBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "scan-receipt",
            title: "Scan Receipt / Bill (OCR)",
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="4"/></svg>',
            category: "Actions",
            badge: "OCR",
            keywords: "scan receipt bill invoice camera ocr image photo",
            run: () => {
                const addBtn = document.getElementById("openModalBtn") || document.getElementById("addExpenseBtn");
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
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
            category: "Actions",
            badge: "Add",
            keywords: "income salary deposit earn inflow",
            run: () => {
                if (typeof window.openNewIncomeModal === "function") {
                    window.openNewIncomeModal();
                } else {
                    const btn = document.getElementById("openIncomeModalBtn") || document.getElementById("addIncomeTableBtn") || document.getElementById("addIncomeBtn");
                    if (btn) btn.click();
                }
            }
        },
        {
            id: "toggle-stealth",
            title: "Toggle Privacy / Stealth Mode",
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
            category: "Preferences",
            badge: "Alt+S",
            keywords: "stealth privacy hide mask blur numbers amounts balances",
            run: () => {
                if (typeof window.toggleStealthMode === "function") {
                    window.toggleStealthMode();
                }
            }
        },
        {
            id: "quick-calculator",
            title: "Quick Calculator & Bill Splitter",
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="3"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"/></svg>',
            category: "Tools",
            badge: "Alt+C",
            keywords: "calc calculator math divide split bill count numbers total",
            run: () => {
                if (window.FloatingCalculator && typeof window.FloatingCalculator.open === "function") {
                    window.FloatingCalculator.open();
                }
            }
        },
        {
            id: "export-workbook",
            title: "Export Executive Workbook (Excel)",
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
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
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
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
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13l3 3M11 13l-3 3"/></svg>',
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
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>',
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
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
            category: "Management",
            badge: "Budgets",
            keywords: "budget spending limit category plan",
            run: () => {
                const btn = document.getElementById("addBudgetBtn") || document.getElementById("setBudgetBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "manage-savings",
            title: "Manage Savings Goals",
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
            category: "Management",
            badge: "Savings",
            keywords: "savings goal target fund emergency",
            run: () => {
                const btn = document.getElementById("addGoalBtn") || document.getElementById("addSavingsGoalBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "studio-appearance",
            title: "Studio & Appearance (Themes, Fonts & Custom Hex)",
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z"/></svg>',
            category: "Preferences",
            badge: "Studio",
            keywords: "studio appearance font typography color hex palette wallpaper theme custom",
            run: () => {
                const btn = document.getElementById("themeStudioBtn") || document.getElementById("themeStudioMenuBtn");
                if (btn) btn.click();
            }
        },
        {
            id: "toggle-theme",
            title: "Toggle Theme (Dark / Light)",
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
            category: "Preferences",
            badge: "Appearance",
            keywords: "theme mode dark light color appearance",
            run: () => {
                if (typeof toggleGlobalTheme === "function") {
                    toggleGlobalTheme();
                } else {
                    const btn = document.getElementById("themeToggle") || document.getElementById("themeToggleBtn");
                    if (btn) btn.click();
                }
            }
        },
        {
            id: "refresh-data",
            title: "Refresh Live Ledger Data",
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>',
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
            icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
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
            icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
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
                    <div class="command-palette-actions-wrap">
                        <kbd class="command-palette-kbd" id="commandPaletteEscBadge" title="Click or press Esc to close">ESC</kbd>
                        <button type="button" class="command-palette-close-btn" id="commandPaletteCloseBtn" aria-label="Close Command Palette" title="Close Command Palette (Esc)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
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

        document.getElementById("commandPaletteCloseBtn")?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            close();
        });

        document.getElementById("commandPaletteEscBadge")?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            close();
        });

        // Prevent wheel scrolling on results or overlay from chaining into background website
        resultsEl?.addEventListener("wheel", (e) => {
            const { scrollTop, scrollHeight, clientHeight } = resultsEl;
            const deltaY = e.deltaY;
            const isAtTop = scrollTop <= 0 && deltaY < 0;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1 && deltaY > 0;
            if (isAtTop || isAtBottom) {
                e.preventDefault();
            }
        }, { passive: false });

        overlayEl.addEventListener("wheel", (e) => {
            if (e.target === overlayEl) {
                e.preventDefault();
            }
        }, { passive: false });

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
            document.body.classList.add("modal-open");
            document.documentElement.classList.add("modal-open");
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
        if (!document.querySelector(".modal-overlay.active")) {
            document.body.classList.remove("modal-open");
            document.documentElement.classList.remove("modal-open");
        }
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
