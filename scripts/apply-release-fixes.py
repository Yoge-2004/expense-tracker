from pathlib import Path

DASHBOARD = Path("frontend/js/dashboard.js")
DASHBOARD_HTML = Path("frontend/dashboard.html")
UI_FIXES = Path("frontend/css/ui-regression-fixes.css")
UTILS = Path("frontend/js/modules/dashboard-utils.js")


def patch_dashboard_js() -> None:
    text = DASHBOARD.read_text(encoding="utf-8")

    text = text.replace(
        '${formatCurrency(spent)} of ${formatCurrency(limit)}',
        '${formatCurrency(b.spent)} of ${formatCurrency(b.limit)}',
        1,
    )

    text = text.replace(
        "if (!confirm(`Delete category \"${catName}\"? This can't be undone.`)) return;",
        "if (!(await window.appConfirm(`Delete category \"${catName}\"? This can't be undone.`))) return;",
        1,
    )

    start_marker = "// Timezone-safe local date helpers"
    end_marker = "// Modal Scroll Lock Helpers"
    start = text.find(start_marker)
    end = text.find(end_marker)
    if start != -1 and end > start and "window.DashboardUtils" not in text:
        loader = (
            "// Shared dashboard utilities are loaded from js/modules/dashboard-utils.js.\n"
            "const { getLocalDateString, parseLocalDate, escapeHtml, formatCurrency, formatDate } = window.DashboardUtils;\n\n"
        )
        text = text[:start] + loader + text[end:]

    DASHBOARD.write_text(text, encoding="utf-8")


def write_dashboard_utils() -> None:
    UTILS.parent.mkdir(parents=True, exist_ok=True)
    UTILS.write_text(
        '''/* Shared, dependency-free dashboard utilities. */
(function () {
    "use strict";

    function getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function parseLocalDate(value) {
        if (!value) return new Date();
        if (value instanceof Date) return value;
        const parts = String(value).split("T")[0].split("-");
        if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
        return new Date(value);
    }

    function escapeHtml(value) {
        if (value == null) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatCurrency(amount) {
        if (typeof window.formatGlobalCurrency === "function") {
            return window.formatGlobalCurrency(amount);
        }
        const symbol = typeof window.getCurrencySymbol === "function" ? window.getCurrencySymbol() : "$";
        return `${symbol} ${Number(amount || 0).toFixed(2)}`;
    }

    function formatDate(value) {
        if (!value) return "";
        return parseLocalDate(value).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    window.DashboardUtils = Object.freeze({
        getLocalDateString,
        parseLocalDate,
        escapeHtml,
        formatCurrency,
        formatDate
    });
    window.escapeHtml = escapeHtml;
})();
''',
        encoding="utf-8",
    )


def patch_dashboard_html() -> None:
    text = DASHBOARD_HTML.read_text(encoding="utf-8")

    if "js/modules/dashboard-utils.js" not in text:
        marker = "js/dashboard.js"
        index = text.find(marker)
        if index == -1:
            raise SystemExit("dashboard.js script reference not found")
        line_start = text.rfind("\n", 0, index) + 1
        text = (
            text[:line_start]
            + '    <script src="js/modules/dashboard-utils.js?v=20260910"></script>\n'
            + text[line_start:]
        )

    old_biometric = '<a href="#" id="biometricAuthBtn">🧬 Biometrics (Touch/Face ID)</a>'
    new_biometric = '''<a href="#" id="biometricAuthBtn" class="profile-menu-action" aria-label="Biometrics (Touch/Face ID)">
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2M21 17v2a2 2 0 0 0 2-2v-2"/>
        <path d="M8 8c1.2-1.7 2.9-2.5 4-2.5S14.8 6.3 16 8M7.5 12c0-1.7 1.6-3.5 4.5-3.5s4.5 1.8 4.5 3.5c0 2.1-1.7 4-4.5 4s-4.5-1.9-4.5-4Z"/>
    </svg>
    <span>Biometrics (Touch/Face ID)</span>
</a>'''
    text = text.replace(old_biometric, new_biometric, 1)
    DASHBOARD_HTML.write_text(text, encoding="utf-8")


def patch_ui_css() -> None:
    text = UI_FIXES.read_text(encoding="utf-8")

    mobile_old = '@media (max-width:760px) { .top-bar-actions .command-search-wrapper { width:100% !important; min-width:0 !important; } }'
    mobile_new = '@media (max-width:760px) { .command-kbd { display:none !important; } .top-bar-actions .command-search-wrapper { width:100% !important; min-width:0 !important; } }'
    if ".command-kbd { display:none !important; }" not in text:
        text = text.replace(mobile_old, mobile_new, 1)

    if "#ledgerStreamTabs, .ledger-stream-tabs" not in text:
        text += '''

/* Mobile ledger controls scroll instead of clipping. */
@media (max-width:760px) {
    #ledgerStreamTabs, .ledger-stream-tabs {
        display:flex !important;
        flex-wrap:nowrap !important;
        overflow-x:auto !important;
        overflow-y:hidden !important;
        min-width:0 !important;
        width:100% !important;
        scrollbar-width:none !important;
        -webkit-overflow-scrolling:touch !important;
    }
    #ledgerStreamTabs::-webkit-scrollbar, .ledger-stream-tabs::-webkit-scrollbar { display:none !important; }
    #ledgerStreamTabs .stream-pill-btn, .ledger-stream-tabs .stream-pill-btn {
        flex:0 0 auto !important;
        min-width:max-content !important;
        white-space:nowrap !important;
    }
    #incomeList .btn-edit, #incomeList .btn-delete {
        width:34px !important;
        height:34px !important;
        min-width:34px !important;
        min-height:34px !important;
        padding:0 !important;
        border-radius:10px !important;
        display:inline-flex !important;
        align-items:center !important;
        justify-content:center !important;
        flex:0 0 34px !important;
        box-sizing:border-box !important;
    }
    #incomeList .btn-edit svg, #incomeList .btn-delete svg {
        width:14px !important;
        height:14px !important;
        display:block !important;
    }
}
'''

    UI_FIXES.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    patch_dashboard_js()
    write_dashboard_utils()
    patch_dashboard_html()
    patch_ui_css()
    print("Dashboard stabilization fixes applied.")
