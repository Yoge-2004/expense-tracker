from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

CSS = r'''/* Targeted fixes for verified auth and dashboard regressions. */

/* Keep budget fills inside the progress track and show actual utilization. */
.budget-bar-track {
    position: relative;
    overflow: hidden;
}
.budget-bar-fill {
    position: relative !important;
    inset: auto !important;
    height: 100%;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
}
.budget-bar-fill::after {
    pointer-events: none;
}

/* Preserve the visible Google button icon; GSI remains available through the JS prompt. */
.google-oauth-wrapper #googleOAuthBtn {
    position: relative !important;
    z-index: 2 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 10px !important;
}
.google-oauth-wrapper #googleOAuthBtn svg {
    display: block !important;
    width: 18px !important;
    height: 18px !important;
    flex: 0 0 18px !important;
    visibility: visible !important;
}
.google-oauth-wrapper #googleRealButton {
    position: absolute !important;
    inset: auto 0 0 auto !important;
    width: 1px !important;
    height: 1px !important;
    opacity: 0 !important;
    pointer-events: none !important;
    overflow: hidden !important;
}

/* Keep compact dashboard action icons visible at every breakpoint. */
.top-bar .add-income-button svg,
.top-bar .add-expense-button svg,
#openIncomeModalBtn svg,
#addIncomeTableBtn svg {
    display: inline-block !important;
    width: 18px !important;
    height: 18px !important;
    flex: 0 0 18px !important;
    visibility: visible !important;
}

/* Mobile profile menu must stay inside the viewport. */
@media (max-width: 480px) {
    .profile-menu {
        position: fixed !important;
        top: 56px !important;
        left: 10px !important;
        right: 10px !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: none !important;
        max-height: calc(100dvh - 68px) !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        box-sizing: border-box !important;
        z-index: 6000 !important;
    }
    .profile-menu a,
    .profile-menu button {
        min-width: 0 !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
    }
}

/* Stream tabs intentionally scroll horizontally instead of clipping their counters/actions. */
#ledgerStreamTabs,
.ledger-stream-tabs {
    display: flex !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    flex-wrap: nowrap !important;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
}
#ledgerStreamTabs .stream-pill-btn,
.ledger-stream-tabs .stream-pill-btn {
    flex: 0 0 auto !important;
    min-width: max-content !important;
    white-space: nowrap !important;
}
#ledgerStreamTabs .stream-badge-count,
.ledger-stream-tabs .stream-badge-count {
    flex: 0 0 auto !important;
    min-width: 2ch !important;
    white-space: nowrap !important;
}

/* Stable, card-like ledgers: inflows use the same compact rhythm as outflows. */
#expenseList,
#incomeList {
    min-width: 0 !important;
    width: 100% !important;
    box-sizing: border-box !important;
}
.expense-item {
    min-width: 0 !important;
    box-sizing: border-box !important;
}
#incomeList table {
    width: 100% !important;
    border-collapse: separate !important;
    border-spacing: 0 8px !important;
}
#incomeList tbody tr {
    background: rgba(var(--ink-rgb), 0.025) !important;
    box-shadow: inset 0 0 0 1px var(--border) !important;
}
#incomeList tbody td {
    border: 0 !important;
    box-sizing: border-box !important;
}
#incomeList tbody tr td:first-child {
    border-radius: 14px 0 0 14px !important;
}
#incomeList tbody tr td:last-child {
    border-radius: 0 14px 14px 0 !important;
}

/* No blue tap flash or geometry jump when subscription pills are pressed. */
.subs-tab-btn {
    min-height: 38px !important;
    box-sizing: border-box !important;
    border: 1px solid transparent !important;
    outline: none !important;
    -webkit-tap-highlight-color: transparent !important;
}
.subs-tab-btn:active {
    transform: none !important;
}
.subs-tab-btn:focus {
    outline: none !important;
    box-shadow: none !important;
}
.subs-tab-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--primary) 60%, transparent) !important;
    outline-offset: 2px;
}
button,
a,
[role="button"] {
    -webkit-tap-highlight-color: transparent;
}

@media (max-width: 700px) {
    .unified-ledger-grid {
        grid-template-columns: minmax(0, 1fr) !important;
        min-width: 0 !important;
    }
    .expense-item {
        grid-template-columns: auto minmax(0, 1fr) !important;
        gap: 10px !important;
        padding: 11px 12px !important;
    }
    .expense-actions {
        grid-column: 2 !important;
        justify-content: flex-start !important;
    }
    #incomeList table,
    #incomeList thead,
    #incomeList tbody,
    #incomeList tr,
    #incomeList td {
        display: block !important;
        width: 100% !important;
    }
    #incomeList thead {
        display: none !important;
    }
    #incomeList tbody tr {
        margin-bottom: 8px !important;
        padding: 10px 12px !important;
        border-radius: 14px !important;
    }
    #incomeList tbody td {
        padding: 3px 0 !important;
        border-radius: 0 !important;
    }
}
'''

JS = r'''/* Runtime synchronization for theme controls; suppress the idle dashboard re-render loop. */
(function installUiRegressionFixes() {
    "use strict";

    function syncThemeIcons() {
        const rootTheme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
        if (typeof window.updateAllThemeIcons === "function") {
            window.updateAllThemeIcons(rootTheme);
            return;
        }
        document.querySelectorAll(".theme-toggle-btn, #themeToggle").forEach((button) => {
            const sun = button.querySelector(".sun-icon");
            const moon = button.querySelector(".moon-icon");
            if (!sun || !moon) return;
            const isLight = rootTheme === "light";
            sun.style.display = isLight ? "none" : "block";
            moon.style.display = isLight ? "block" : "none";
            button.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
            button.setAttribute("title", isLight ? "Switch to dark theme" : "Switch to light theme");
        });
    }

    function installThemeObserver() {
        syncThemeIcons();
        document.addEventListener("themechange", syncThemeIcons);
        if (typeof MutationObserver !== "undefined") {
            new MutationObserver((records) => {
                if (records.some((record) => record.type === "attributes" && record.attributeName === "data-theme")) {
                    syncThemeIcons();
                }
            }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        }
    }

    function installDashboardTimerGuard() {
        const nativeSetInterval = window.setInterval;
        if (nativeSetInterval.__expenseTrackerGuard) return;
        function guardedSetInterval(callback, delay, ...args) {
            if (delay === 25000 && typeof callback === "function" && /loadDashboard\s*\(\s*true\s*\)/.test(Function.prototype.toString.call(callback))) {
                return 0;
            }
            return nativeSetInterval.call(window, callback, delay, ...args);
        }
        guardedSetInterval.__expenseTrackerGuard = true;
        window.setInterval = guardedSetInterval;
    }

    function init() {
        installThemeObserver();
        installDashboardTimerGuard();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
'''

STYLE = FRONTEND / "css/style.css"
UI_CSS = FRONTEND / "css/ui-regression-fixes.css"
UI_JS = FRONTEND / "js/ui-regression-fixes.js"

UI_CSS.write_text(CSS, encoding="utf-8")
UI_JS.write_text(JS, encoding="utf-8")

style = STYLE.read_text(encoding="utf-8")
if 'ui-regression-fixes.css' not in style:
    STYLE.write_text(style.rstrip() + '\n@import url("ui-regression-fixes.css");\n', encoding="utf-8")

# Load the runtime patch after api.js and before auth/dashboard logic executes.
for page_name in ("index.html", "register.html", "dashboard.html"):
    page = FRONTEND / page_name
    text = page.read_text(encoding="utf-8")
    marker = '<script src="js/ui-regression-fixes.js"></script>'
    if marker not in text:
        target = '<script src="js/api.js"></script>'
        if target not in text:
            raise RuntimeError(f"Missing api.js script tag in {page_name}")
        text = text.replace(target, target + '\n    ' + marker, 1)
        page.write_text(text, encoding="utf-8")

# Remove the known 25-second idle refresh. The guard above protects older cached copies too.
dashboard = FRONTEND / "js/dashboard.js"
dashboard_text = dashboard.read_text(encoding="utf-8")
pattern = re.compile(
    r'\n// Periodic background sync every 25 seconds\s*'
    r'setInterval\(\(\) => \{\s*'
    r'if \(document\.visibilityState === "visible"\) \{\s*'
    r'loadDashboard\(true\);\s*\}\s*'
    r'\}, 25000\);\s*', re.MULTILINE)
new_dashboard, count = pattern.subn('\n// Dashboard refreshes are event-driven; idle pages are not re-rendered.\n', dashboard_text, count=1)
if count != 1:
    raise RuntimeError("Expected 25-second idle dashboard refresh block was not found")
dashboard.write_text(new_dashboard, encoding="utf-8")

print("Applied UI regression fixes and removed the idle dashboard refresh loop.")
