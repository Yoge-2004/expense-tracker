from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

CSS = r'''/* Targeted fixes for auth, budget, modal, and interaction regressions. */
html[data-theme="dark"] .theme-toggle-btn .sun-icon,
html[data-theme="dark"] #themeToggle .sun-icon { display:block !important; visibility:visible !important; }
html[data-theme="dark"] .theme-toggle-btn .moon-icon,
html[data-theme="dark"] #themeToggle .moon-icon { display:none !important; visibility:hidden !important; }
html[data-theme="light"] .theme-toggle-btn .sun-icon,
html[data-theme="light"] #themeToggle .sun-icon { display:none !important; visibility:hidden !important; }
html[data-theme="light"] .theme-toggle-btn .moon-icon,
html[data-theme="light"] #themeToggle .moon-icon { display:block !important; visibility:visible !important; }

.google-oauth-wrapper { position:relative !important; overflow:visible !important; isolation:isolate; }
#googleOAuthBtn.btn-oauth {
    position:relative !important; z-index:1 !important; box-sizing:border-box !important; min-height:48px !important;
    transform:none !important; transition:background-color .2s ease,border-color .2s ease,box-shadow .2s ease,color .2s ease !important; overflow:visible !important;
}
#googleOAuthBtn.btn-oauth:hover,#googleOAuthBtn.btn-oauth:focus:hover { transform:none !important; border-color:var(--primary) !important; box-shadow:0 0 0 3px rgba(var(--primary-rgb),.14) !important; }
#googleOAuthBtn svg,#googleOAuthBtn svg.google-g-icon { display:block !important; width:18px !important; height:18px !important; flex:0 0 18px !important; overflow:visible !important; }
#googleOAuthBtn svg path { stroke:none !important; }
#googleRealButton,.google-oauth-wrapper #googleRealButton,.google-oauth-wrapper .google-real-btn { display:none !important; }

.budget-item { position:relative !important; overflow:hidden !important; }
.budget-item .budget-bar-track { display:block !important; position:relative !important; width:100% !important; height:8px !important; margin:10px 0 8px !important; padding:0 !important; overflow:hidden !important; border-radius:999px !important; box-sizing:border-box !important; background:var(--input-bg) !important; }
.budget-item .budget-bar-fill { position:absolute !important; inset:0 auto auto 0 !important; display:block !important; height:100% !important; max-width:100% !important; min-width:0 !important; margin:0 !important; padding:0 !important; border-radius:inherit !important; transform:none !important; animation:none !important; transform-origin:left center !important; overflow:hidden !important; }
.budget-item .budget-bar-fill::after { inset:0 !important; border-radius:inherit !important; pointer-events:none !important; }

#ledgerStreamTabs,.ledger-stream-tabs { flex:1 1 auto !important; overscroll-behavior-x:contain !important; scrollbar-width:thin !important; }
#ledgerStreamTabs .stream-pill-btn,.ledger-stream-tabs .stream-pill-btn { flex:0 0 auto !important; min-width:max-content !important; width:max-content !important; }
#ledgerStreamTabs .stream-badge-count,.ledger-stream-tabs .stream-badge-count { flex:0 0 auto !important; min-width:2ch !important; white-space:nowrap !important; }

.subs-tab-bar { min-width:0 !important; overflow-x:auto !important; overscroll-behavior-x:contain !important; scrollbar-width:none !important; }
.subs-tab-bar::-webkit-scrollbar { display:none !important; }
.subs-tab-btn,.subs-tab-btn:hover,.subs-tab-btn:active,.subs-tab-btn.active { box-sizing:border-box !important; min-height:38px !important; padding:7px 16px !important; border-width:1px !important; transform:none !important; outline:none !important; transition:color .2s ease,background-color .2s ease,border-color .2s ease,box-shadow .2s ease !important; -webkit-tap-highlight-color:transparent !important; }
.subs-tab-btn:focus-visible { outline:2px solid color-mix(in srgb,var(--primary) 60%,transparent) !important; outline-offset:2px !important; }

.modal { overflow-y:auto !important; overflow-x:hidden !important; scrollbar-gutter:stable !important; clip-path:inset(0 round 24px) !important; -webkit-clip-path:inset(0 round 24px) !important; }
.modal::-webkit-scrollbar-track { margin:28px 0 !important; border-radius:999px !important; }
.modal::-webkit-scrollbar-thumb { min-height:24px !important; }
#expenseList,#incomeList { min-width:0 !important; width:100% !important; box-sizing:border-box !important; }
#expenseList .expense-item,#incomeList tbody tr { min-width:0 !important; box-sizing:border-box !important; }
@media (max-width:700px) { .budget-item { padding:13px !important; } .budget-item .budget-bar-track { height:7px !important; margin-top:9px !important; } #incomeList tbody tr { width:100% !important; } }
'''

(FRONTEND / "css/ui-regression-fixes.css").write_text(CSS, encoding="utf-8")

# Auth Google rendering is already fixed on newer revisions; only apply the legacy removal when present.
auth_path = FRONTEND / "js/auth.js"
auth = auth_path.read_text(encoding="utf-8")
legacy = re.compile(r'\n        const realButtons = document\.querySelectorAll\("#googleRealButton, \.google-real-btn"\);\n        realButtons\.forEach\(btnContainer => \{.*?\n        \}\);', re.S)
auth, removed = legacy.subn('\n        // The visible button owns the interaction; GSI is invoked through prompt().', auth, count=1)
if removed:
    auth_path.write_text(auth, encoding="utf-8")

GOOGLE_BUTTON = '''<svg class="google-g-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98-1.06-2.23-1.06-3.71-1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>'''
for page_name in ("index.html", "register.html"):
    page = FRONTEND / page_name
    text = page.read_text(encoding="utf-8")
    if 'id="googleOAuthBtn"' in text and 'google-g-icon' not in text:
        pattern = re.compile(r'(<button[^>]*id="googleOAuthBtn"[^>]*>).*?(</button>)', re.S)
        text, changed = pattern.subn(lambda m: m.group(1) + "\n                        " + GOOGLE_BUTTON + "\n                        <span>Continue with Google</span>\n                    " + m.group(2), text, count=1)
        if changed != 1:
            raise RuntimeError(f"Google OAuth button markup not found in {page_name}")
        page.write_text(text, encoding="utf-8")

dash_path = FRONTEND / "js/dashboard.js"
dash = dash_path.read_text(encoding="utf-8")
dash_new, confirm_count = re.subn(r'if \(!confirm\(("[^"]*(?:\\"[^"]*)*")\)\) return;', r'if (!(await window.appConfirm(\1))) return;', dash)
dash_new, prompt_count = re.subn(r'const name = prompt\(("[^"]*(?:\\"[^"]*)*")\);', r'const name = await window.appPrompt(\1);', dash_new)
if dash_new != dash:
    dash_path.write_text(dash_new, encoding="utf-8")

# Mobile top actions: eliminate the bright hover-shine spill and guarantee two equal columns.
regression_path = FRONTEND / "css/ui-regression-fixes.css"
regression_css = regression_path.read_text(encoding="utf-8")
regression_css += r'''

@media (max-width:760px) {
    /* Top action buttons are touch controls; keep the decorative shine inside the control. */
    .top-bar .add-expense-button,
    .top-bar .add-income-button {
        flex:1 1 0 !important;
        width:auto !important;
        min-width:0 !important;
        max-width:none !important;
        overflow:hidden !important;
        isolation:isolate !important;
    }
    .top-bar .add-expense-button::after,
    .top-bar .add-income-button::after {
        display:none !important;
    }
}
'''
regression_path.write_text(regression_css, encoding="utf-8")

# --- Dashboard JavaScript modularization ----------------------------------
# Move stable infrastructure out of the monolithic dashboard controller while
# preserving the existing global function names used by inline HTML handlers.
MODULES = {
    "dashboard-ui.js": '''/* Dashboard UI primitives: modal lifecycle and scroll locking. */
(function () {
    "use strict";

    function openModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.add("active");
        document.body.classList.add("modal-open");
    }

    function closeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove("active");
        if (!document.querySelector(".modal-overlay.active")) {
            document.body.classList.remove("modal-open");
        }
    }

    window.openModal = openModal;
    window.closeModal = closeModal;
})();
''',
    "dashboard-cache.js": '''/* Dashboard cache: stale-while-revalidate persistence for expense state. */
(function () {
    "use strict";

    const CACHE_VERSION = 1;

    function getCacheKey() {
        const userId = localStorage.getItem("userId") || "anonymous";
        return `expenseCache_${userId}`;
    }

    function saveExpenseCache(expenses, categories) {
        try {
            localStorage.setItem(getCacheKey(), JSON.stringify({
                v: CACHE_VERSION,
                savedAt: Date.now(),
                expenses,
                categories
            }));
        } catch (error) {
            console.warn("Could not save expense cache:", error);
        }
    }

    function loadExpenseCache() {
        try {
            const raw = localStorage.getItem(getCacheKey());
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed.v !== CACHE_VERSION || !Array.isArray(parsed.expenses)) return null;
            return parsed;
        } catch (_) {
            return null;
        }
    }

    window.getCacheKey = getCacheKey;
    window.saveExpenseCache = saveExpenseCache;
    window.loadExpenseCache = loadExpenseCache;
})();
''',
    "dashboard-search.js": '''/* Dashboard search/shortcut controller. */
(function () {
    "use strict";

    const searchInput = () => document.getElementById("filterSearch");
    const isMacPlatform = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const kbdBadge = document.querySelector(".command-kbd");

    if (kbdBadge) kbdBadge.textContent = isMacPlatform ? "⌘K" : "Ctrl K";

    function updateSearchPlaceholder() {
        const input = searchInput();
        if (!input) return;
        if (window.innerWidth <= 600) {
            input.placeholder = "Search expenses & incomes...";
        } else {
            input.placeholder = isMacPlatform
                ? "Search expenses & incomes (Press / or ⌘K)..."
                : "Search expenses & incomes (Press / or Ctrl+K)...";
        }
    }

    window.addEventListener("resize", updateSearchPlaceholder);
    updateSearchPlaceholder();

    window.addEventListener("keydown", (event) => {
        const isK = event.key === "k" || event.key === "K" || event.code === "KeyK";
        if ((event.metaKey || event.ctrlKey) && isK) {
            event.preventDefault();
            event.stopPropagation();
            const input = searchInput();
            if (input) {
                input.focus();
                input.select();
            }
            return;
        }

        if (event.key === "/") {
            const activeEl = document.activeElement;
            const isEditing = activeEl && (
                activeEl.tagName === "INPUT" ||
                activeEl.tagName === "TEXTAREA" ||
                activeEl.tagName === "SELECT" ||
                activeEl.isContentEditable
            );
            if (!isEditing) {
                event.preventDefault();
                const input = searchInput();
                if (input) {
                    input.focus();
                    input.select();
                }
                return;
            }
        }

        const input = searchInput();
        if (event.key === "Escape" && document.activeElement === input) {
            if (input.value) {
                input.value = "";
                input.dispatchEvent(new Event("input", { bubbles: true }));
            } else {
                input.blur();
            }
        }
    }, { capture: true });
})();
'''
}

for filename, content in MODULES.items():
    path = FRONTEND / "js/modules" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

# Expand the shared dependency-free utility module with pure dashboard helpers.
utils_path = FRONTEND / "js/modules/dashboard-utils.js"
utils = utils_path.read_text(encoding="utf-8")
if "function getCategoryColor" not in utils:
    anchor = "    function formatDate(value) {"
    utility_block = '''    const CATEGORY_PALETTE = [
        { bg: "rgba(199,154,62,0.12)", color: "#C79A3E" },
        { bg: "rgba(162,62,50,0.12)", color: "#A23E32" },
        { bg: "rgba(76,122,120,0.12)", color: "#4C7A78" },
        { bg: "rgba(91,140,90,0.12)", color: "#5B8C5A" },
        { bg: "rgba(139,94,52,0.12)", color: "#8B5E34" },
        { bg: "rgba(176,107,92,0.12)", color: "#B06B5C" },
        { bg: "rgba(201,147,46,0.12)", color: "#C9932E" },
        { bg: "rgba(107,114,128,0.12)", color: "#6B7280" }
    ];

    function getCategoryColor(name) {
        const index = name
            ? String(name).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % CATEGORY_PALETTE.length
            : 0;
        return CATEGORY_PALETTE[index];
    }

    function getCategoryEmoji(name) {
        const value = String(name || "").toLowerCase();
        if (value.includes("food") || value.includes("dining") || value.includes("restaurant")) return "🍔";
        if (value.includes("transport") || value.includes("travel") || value.includes("uber")) return "🚗";
        if (value.includes("shop") || value.includes("cloth") || value.includes("amazon")) return "🛍️";
        if (value.includes("util") || value.includes("electric") || value.includes("water") || value.includes("bill")) return "⚡";
        if (value.includes("entertain") || value.includes("movie") || value.includes("netflix")) return "🎬";
        if (value.includes("health") || value.includes("medical") || value.includes("gym")) return "💊";
        if (value.includes("edu") || value.includes("course") || value.includes("book")) return "📚";
        if (value.includes("subscribe") || value.includes("saas") || value.includes("software")) return "💻";
        if (value.includes("grocer") || value.includes("market") || value.includes("super")) return "🛒";
        return "💳";
    }

    function debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    }

'''
    if anchor not in utils:
        raise RuntimeError("dashboard-utils insertion anchor not found")
    utils = utils.replace(anchor, utility_block + anchor, 1)
    utils = utils.replace(
        "window.DashboardUtils = Object.freeze({ getLocalDateString, parseLocalDate, escapeHtml, formatCurrency, formatDate });",
        "window.DashboardUtils = Object.freeze({ getLocalDateString, parseLocalDate, escapeHtml, formatCurrency, formatDate, getCategoryColor, getCategoryEmoji, debounce });"
    )
    utils_path.write_text(utils, encoding="utf-8")

# Remove moved modal helpers.
dash_text = dash_path.read_text(encoding="utf-8")
modal_pattern = re.compile(
    r'// Modal Scroll Lock Helpers\nfunction openModal\(modalEl\) \{.*?\n\}\n\nfunction closeModal\(modalEl\) \{.*?\n\}\n\n',
    re.S,
)
dash_text, modal_removed = modal_pattern.subn("", dash_text, count=1)

# Remove moved category palette/emoji helpers.
category_pattern = re.compile(
    r'// ── Category palette \(consistent colors per category name\) — muted ink/stamp tones ──\nconst CATEGORY_PALETTE = \[.*?\nfunction showSkeletonLoading\(\)',
    re.S,
)
dash_text, category_removed = category_pattern.subn("function showSkeletonLoading()", dash_text, count=1)
emoji_pattern = re.compile(r'\nfunction getCategoryEmoji\(name\) \{.*?\n\}\n\nfunction populateCategoryDropdown', re.S)
dash_text, emoji_removed = emoji_pattern.subn("\nfunction populateCategoryDropdown", dash_text, count=1)

# Remove moved local cache implementation while keeping the initialization marker.
cache_pattern = re.compile(
    r'// --- 1\. INITIALIZATION ---.*?\nfunction renderDashboardData\(',
    re.S,
)
replacement = "// --- 1. INITIALIZATION ---\n\nfunction renderDashboardData("
dash_text, cache_removed = cache_pattern.subn(replacement, dash_text, count=1)

# Remove moved keyboard/search listener block.
search_pattern = re.compile(
    r'// Keyboard Shortcuts & Search Bar Responsive Adaptation.*?\n// --- 2\. BUDGET LOGIC ---',
    re.S,
)
dash_text, search_removed = search_pattern.subn("// --- 2. BUDGET LOGIC ---", dash_text, count=1)

# Remove moved debounce helper.
debounce_pattern = re.compile(
    r'/\*\*\n \* Delays calling `fn`.*?\nfunction debounce\(fn, delay\) \{.*?\n\}\n\n',
    re.S,
)
dash_text, debounce_removed = debounce_pattern.subn("", dash_text, count=1)

# Expand utility destructuring with the moved pure helpers.
dash_text = dash_text.replace(
    'const { getLocalDateString, parseLocalDate, escapeHtml, formatCurrency, formatDate } = window.DashboardUtils;',
    'const { getLocalDateString, parseLocalDate, escapeHtml, formatCurrency, formatDate, getCategoryColor, getCategoryEmoji, debounce } = window.DashboardUtils;'
)

dash_path.write_text(dash_text, encoding="utf-8")

# Load extracted dashboard modules before the controller. Insert once only.
html_path = FRONTEND / "dashboard.html"
html = html_path.read_text(encoding="utf-8")
marker = '    <script src="js/dashboard.js"></script>'
module_tags = '''    <script src="js/modules/dashboard-ui.js"></script>\n    <script src="js/modules/dashboard-cache.js"></script>\n    <script src="js/modules/dashboard-search.js"></script>\n'''
if 'js/modules/dashboard-ui.js' not in html:
    if marker not in html:
        raise RuntimeError("dashboard.js script tag not found")
    html = html.replace(marker, module_tags + marker, 1)
    html_path.write_text(html, encoding="utf-8")

# Validate every extracted classic script before allowing the workflow to commit.
import subprocess
for path in [*(FRONTEND / "js/modules").glob("dashboard-*.js"), dash_path]:
    subprocess.run(["node", "--check", str(path)], check=True)

print(
    "UI/refactor patch completed: "
    f"confirm={confirm_count}, prompt={prompt_count}, legacy_google={removed}, "
    f"modal={modal_removed}, category={category_removed}, emoji={emoji_removed}, "
    f"cache={cache_removed}, search={search_removed}, debounce={debounce_removed}"
)
