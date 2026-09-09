from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

CSS = r'''/* Targeted fixes for auth and dashboard regressions. */

.budget-bar-track { position: relative; overflow: hidden; }
.budget-bar-fill { position: relative !important; inset: auto !important; height: 100%; max-width: 100%; min-width: 0; overflow: hidden; }
.budget-bar-fill::after { pointer-events: none; }

#googleOAuthBtn { position: relative !important; z-index: 2 !important; display: flex !important; align-items: center !important; justify-content: center !important; gap: 10px !important; }
#googleOAuthBtn svg { display: block !important; width: 18px !important; height: 18px !important; flex: 0 0 18px !important; visibility: visible !important; }
#googleRealButton { position: absolute !important; width: 1px !important; height: 1px !important; opacity: 0 !important; pointer-events: none !important; overflow: hidden !important; }

.top-bar .add-income-button svg,
.top-bar .add-expense-button svg,
#openIncomeModalBtn svg,
#addIncomeTableBtn svg { display: inline-block !important; width: 18px !important; height: 18px !important; flex: 0 0 18px !important; visibility: visible !important; }

@media (max-width: 480px) {
    .profile-menu { position: fixed !important; top: 56px !important; left: 10px !important; right: 10px !important; width: auto !important; min-width: 0 !important; max-width: none !important; max-height: calc(100dvh - 68px) !important; overflow-x: hidden !important; overflow-y: auto !important; box-sizing: border-box !important; z-index: 6000 !important; }
    .profile-menu a, .profile-menu button { min-width: 0 !important; white-space: normal !important; overflow-wrap: anywhere !important; }
}

#ledgerStreamTabs,
.ledger-stream-tabs { display: flex !important; width: 100% !important; max-width: 100% !important; min-width: 0 !important; overflow-x: auto !important; overflow-y: hidden !important; flex-wrap: nowrap !important; scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
#ledgerStreamTabs .stream-pill-btn,
.ledger-stream-tabs .stream-pill-btn { flex: 0 0 auto !important; min-width: max-content !important; white-space: nowrap !important; }
#ledgerStreamTabs .stream-badge-count,
.ledger-stream-tabs .stream-badge-count { flex: 0 0 auto !important; min-width: 2ch !important; white-space: nowrap !important; }

#expenseList, #incomeList { min-width: 0 !important; width: 100% !important; box-sizing: border-box !important; }
.expense-item { min-width: 0 !important; box-sizing: border-box !important; }
#incomeList table { width: 100% !important; border-collapse: separate !important; border-spacing: 0 8px !important; }
#incomeList tbody tr { background: rgba(var(--ink-rgb), 0.025) !important; box-shadow: inset 0 0 0 1px var(--border) !important; }
#incomeList tbody td { border: 0 !important; box-sizing: border-box !important; }
#incomeList tbody tr td:first-child { border-radius: 14px 0 0 14px !important; }
#incomeList tbody tr td:last-child { border-radius: 0 14px 14px 0 !important; }

.subs-tab-btn { min-height: 38px !important; box-sizing: border-box !important; border: 1px solid transparent !important; outline: none !important; -webkit-tap-highlight-color: transparent !important; }
.subs-tab-btn:active { transform: none !important; }
.subs-tab-btn:focus { outline: none !important; box-shadow: none !important; }
.subs-tab-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--primary) 60%, transparent) !important; outline-offset: 2px; }
button, a, [role="button"] { -webkit-tap-highlight-color: transparent; }

@media (max-width: 700px) {
    .unified-ledger-grid { grid-template-columns: minmax(0,1fr) !important; min-width: 0 !important; }
    .expense-item { grid-template-columns: auto minmax(0,1fr) !important; gap: 10px !important; padding: 11px 12px !important; }
    .expense-actions { grid-column: 2 !important; justify-content: flex-start !important; }
    #incomeList table, #incomeList thead, #incomeList tbody, #incomeList tr, #incomeList td { display: block !important; width: 100% !important; }
    #incomeList thead { display: none !important; }
    #incomeList tbody tr { margin-bottom: 8px !important; padding: 10px 12px !important; border-radius: 14px !important; }
    #incomeList tbody td { padding: 3px 0 !important; border-radius: 0 !important; }
}
'''

JS = r'''/* Synchronize theme controls while keeping dashboard refresh event-driven. */
(function () {
    "use strict";
    function syncThemeIcons() {
        const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
        if (typeof window.updateAllThemeIcons === "function") { window.updateAllThemeIcons(theme); return; }
        document.querySelectorAll(".theme-toggle-btn, #themeToggle").forEach(button => {
            const sun = button.querySelector(".sun-icon");
            const moon = button.querySelector(".moon-icon");
            if (!sun || !moon) return;
            const light = theme === "light";
            sun.style.display = light ? "none" : "block";
            moon.style.display = light ? "block" : "none";
            button.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
            button.setAttribute("title", light ? "Switch to dark theme" : "Switch to light theme");
        });
    }
    function init() {
        syncThemeIcons();
        document.addEventListener("themechange", syncThemeIcons);
        if (typeof MutationObserver !== "undefined") new MutationObserver(records => {
            if (records.some(r => r.type === "attributes" && r.attributeName === "data-theme")) syncThemeIcons();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
'''

(FRONTEND / "css/ui-regression-fixes.css").write_text(CSS, encoding="utf-8")
(FRONTEND / "js/ui-regression-fixes.js").write_text(JS, encoding="utf-8")

style_file = FRONTEND / "css/style.css"
style = style_file.read_text(encoding="utf-8")
if 'ui-regression-fixes.css' not in style:
    style_file.write_text(style.rstrip() + '\n@import url("ui-regression-fixes.css");\n', encoding="utf-8")

for page_name in ("index.html", "register.html", "dashboard.html"):
    page = FRONTEND / page_name
    text = page.read_text(encoding="utf-8")
    marker = '<script src="js/ui-regression-fixes.js"></script>'
    if marker not in text:
        target = '<script src="js/api.js"></script>'
        if target not in text: raise RuntimeError(f"Missing api.js script tag in {page_name}")
        page.write_text(text.replace(target, target + '\n    ' + marker, 1), encoding="utf-8")

dashboard = FRONTEND / "js/dashboard.js"
text = dashboard.read_text(encoding="utf-8")
pattern = re.compile(r'\n// Periodic background sync every 25 seconds\s*setInterval\(\(\) => \{\s*if \(document\.visibilityState === "visible"\) \{\s*loadDashboard\(true\);\s*\}\s*\}, 25000\);\s*', re.MULTILINE)
new_text, count = pattern.subn('\n// Dashboard refreshes are event-driven; idle pages are not re-rendered.\n', text, count=1)
if count == 1:
    dashboard.write_text(new_text, encoding="utf-8")
print("UI regression fixes applied; idle refresh loop already absent" if count == 0 else "UI regression fixes applied and idle refresh loop removed")
