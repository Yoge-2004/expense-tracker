from pathlib import Path
import re

DASH = Path("frontend/js/dashboard.js")
HTML = Path("frontend/dashboard.html")
CSS = Path("frontend/css/ui-regression-fixes.css")
MODULE_DIR = Path("frontend/js/modules")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label}: expected source was not found")
    return text.replace(old, new, 1)



def patch_dashboard() -> None:
    text = DASH.read_text(encoding="utf-8")

    text = replace_once(
        text,
        '                    <div class="budget-status-row">\n                        <span>${formatCurrency(spent)} of ${formatCurrency(limit)}</span>',
        '                    <div class="budget-status-row">\n                        <span>${formatCurrency(b.spent)} of ${formatCurrency(b.limit)}</span>',
        "budget status renderer",
    )

    native_confirm = '            if (!confirm(`Delete category "${catName}"? This can\\\'t be undone.`)) return;'
    app_confirm = '            if (!(await window.appConfirm(`Delete category "${catName}"? This can\\\'t be undone.`))) return;'
    if native_confirm in text:
        text = text.replace(native_confirm, app_confirm, 1)

    start = text.find("// Timezone-safe local date helpers")
    end = text.find("// Modal Scroll Lock Helpers")
    if start == -1 or end == -1 or end <= start:
        raise SystemExit("dashboard helper block boundaries not found")

    loader = '''// Shared dashboard utilities are maintained in js/modules/dashboard-utils.js.
const {
    getLocalDateString,
    parseLocalDate,
    escapeHtml,
    formatCurrency,
    formatDate,
} = window.DashboardUtils;
'''
    text = text[:start] + loader + "\n" + text[end:]
    DASH.write_text(text, encoding="utf-8")



def write_dashboard_utils() -> None:
    MODULE_DIR.mkdir(parents=True, exist_ok=True)
    MODULE_DIR.joinpath("dashboard-utils.js").write_text(
        '''/* Shared, dependency-light dashboard utilities. */
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
            day: "numeric",
        });
    }

    window.DashboardUtils = Object.freeze({
        getLocalDateString,
        parseLocalDate,
        escapeHtml,
        formatCurrency,
        formatDate,
    });
    window.escapeHtml = escapeHtml;
})();
''',
        encoding="utf-8",
    )



def patch_html() -> None:
    text = HTML.read_text(encoding="utf-8")

    if "js/modules/dashboard-utils.js" not in text:
        match = re.search(
            r'(?P<tag><script[^>]+src=["\']js/dashboard\.js(?:\?[^"\']*)?["\'][^>]*></script>)',
            text,
        )
        if not match:
            raise SystemExit("dashboard.js script tag not found")
        text = text[: match.start()] + '    <script src="js/modules/dashboard-utils.js?v=20260910"></script>\n' + text[match.start() :]

    old = '<a href="#" id="biometricAuthBtn">🧬 Biometrics (Touch/Face ID)</a>'
    new = '''<a href="#" id="biometricAuthBtn" class="profile-menu-action">
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2M21 17v2a2 2 0 0 1-2 2h-2"/>
        <path d="M8 8c1.2-1.7 2.9-2.5 4-2.5S14.8 6.3 16 8M7.5 12c0-1.7 1.6-3.5 4.5-3.5s4.5 1.8 4.5 3.5c0 2.1-1.7 4-4.5 4s-4.5-1.9-4.5-4Z"/>
    </svg>
    <span>Biometrics (Touch/Face ID)</span>
</a>'''
    if old in text:
        text = text.replace(old, new, 1)

    HTML.write_text(text, encoding="utf-8")



def patch_css() -> None:
    text = CSS.read_text(encoding="utf-8")
    old_mobile = '@media (max-width:760px) { .top-bar-actions .command-search-wrapper { width:100% !important; min-width:0 !important; } }'
    new_mobile = '@media (max-width:760px) { .command-kbd { display:none !important; } .top-bar-actions .command-search-wrapper { width:100% !important; min-width:0 !important; } }'
    if new_mobile not in text:
        if old_mobile in text:
            text = text.replace(old_mobile, new_mobile, 1)
        else:
            text += "\n" + new_mobile + "\n"

    theme_rule = '''
/* Theme changes must not replay card reveal/hover transforms. */
html.theme-transitioning .grid-4-metrics > .metric-card,
html.theme-transitioning .grid-4-metrics > .metric-card * {
    animation:none !important;
    transition:none !important;
}
'''
    if "html.theme-transitioning .grid-4-metrics > .metric-card" not in text:
        text += theme_rule
    CSS.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    patch_dashboard()
    write_dashboard_utils()
    patch_html()
    patch_css()
    print("Dashboard stabilization patch applied successfully.")
