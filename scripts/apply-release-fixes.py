from pathlib import Path

# One-time deterministic release stabilization patch; safe to re-run.
INDEX = Path('mobile/app/(tabs)/index.tsx')
REPORT = Path('src/main/java/com/example/expensetracker/controller/RangeReportController.java')
API = Path('frontend/js/api.js')
TABLES = Path('frontend/css/tables.css')

old_metrics = '''  // Calculations for Matrix & Cash Flow Metrics
  const totalSpent = expenses.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
  const totalIncome = incomes.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
  const netCashFlow = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? ((netCashFlow / totalIncome) * 100).toFixed(1) : "0.0";

  const now = new Date();
  const currentDay = Math.max(now.getDate(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentMonthExpenses = expenses.filter((e) => {
    if (!e.expenseDate) return false;
    try {
      const d = new Date(e.expenseDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch {
      return false;
    }
  });
  const currentMonthSpent = currentMonthExpenses.reduce((s, e) => s + Math.max(0, Number(e.amount || 0)), 0);
  const dailyBurn = currentMonthSpent / currentDay;
  const monthEndForecast = dailyBurn * daysInMonth;

  // Category summary
  const catSummary: Record<string, number> = {};
  expenses.forEach((e) => {
    const name = e.categoryName || 'General';
    catSummary[name] = (catSummary[name] || 0) + Math.max(0, Number(e.amount || 0));
  });
  const sortedCats = Object.entries(catSummary).sort((a, b) => b[1] - a[1]);
  const highestCatName = sortedCats.length > 0 ? sortedCats[0][0] : 'None';
  const highestCatAmt = sortedCats.length > 0 ? sortedCats[0][1] : 0;

'''

new_metrics = '''  // Dashboard metrics intentionally derive from the exact same filtered datasets as the ledger.
  // This keeps KPIs, insights and charts synchronized with search/category/date filters.
  const dashboardExpenses = filteredExpenses;
  const dashboardIncomes = filteredIncomes;
  const totalSpent = dashboardExpenses.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
  const totalIncome = dashboardIncomes.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
  const netCashFlow = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? ((netCashFlow / totalIncome) * 100).toFixed(1) : "0.0";

  const currentDay = Math.max(now.getDate(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentMonthExpenses = dashboardExpenses.filter((e) => {
    if (!e.expenseDate) return false;
    const d = new Date(e.expenseDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const currentMonthSpent = currentMonthExpenses.reduce((s, e) => s + Math.max(0, Number(e.amount || 0)), 0);
  const dailyBurn = currentMonthSpent / currentDay;
  const monthEndForecast = dailyBurn * daysInMonth;

  const catSummary: Record<string, number> = {};
  dashboardExpenses.forEach((e) => {
    const name = e.categoryName || 'General';
    catSummary[name] = (catSummary[name] || 0) + Math.max(0, Number(e.amount || 0));
  });
  const sortedCats = Object.entries(catSummary).sort((a, b) => b[1] - a[1]);
  const highestCatName = sortedCats.length > 0 ? sortedCats[0][0] : 'None';
  const highestCatAmt = sortedCats.length > 0 ? sortedCats[0][1] : 0;

'''

s = INDEX.read_text()
if old_metrics in s:
    s = s.replace(old_metrics, '', 1)
needle = '  interface UnifiedTxItem {\n'
if 'const dashboardExpenses = filteredExpenses;' not in s:
    if needle not in s:
        raise SystemExit('dashboard insertion point not found')
    s = s.replace(needle, new_metrics + needle, 1)
for old, new in [
    ('<InsightCards\n          expenses={expenses}', '<InsightCards\n          expenses={dashboardExpenses}'),
    ('<CategoryDonutChart expenses={expenses}', '<CategoryDonutChart expenses={dashboardExpenses}'),
    ('<SpendTrendChart expenses={expenses}', '<SpendTrendChart expenses={dashboardExpenses}'),
    ('<RecurringSplitChart expenses={expenses}', '<RecurringSplitChart expenses={dashboardExpenses}'),
    ('<DayOfWeekChart expenses={expenses}', '<DayOfWeekChart expenses={dashboardExpenses}'),
]:
    s = s.replace(old, new, 1)
s = s.replace('  // Filtered Expenses List (including Custom Date Range)', '  const now = new Date();\n\n  // Filtered Expenses List (including Custom Date Range)', 1)
while '  const now = new Date();\n\n  const now = new Date();' in s:
    s = s.replace('  const now = new Date();\n\n  const now = new Date();', '  const now = new Date();', 1)
s = s.replace('  const now = new Date();\n  const currentDay = Math.max(now.getDate(), 1);', '  const currentDay = Math.max(now.getDate(), 1);', 1)
INDEX.write_text(s)

r = REPORT.read_text()
r = r.replace('org.apache.poi.xssf.usermodel.XSSForg.apache.poi.xssf.usermodel.XSSFFont f=', 'org.apache.poi.xssf.usermodel.XSSFFont f=')
REPORT.write_text(r)

# Web dashboard stability: GET requests are background reads and must not flash the global loading veil.
a = API.read_text()
old_api = '''    activeRequests += 1;
    setLoading(true, retriesLeft < 2 ? "Waking up server (cold start)..." : "Connecting to server...");
    let response;'''
new_api = '''    // Background GETs must not flash the global loading veil. The dashboard
    // performs several parallel reads, and showing the global loader for every
    // one made the page appear to randomly refresh/flicker during normal use.
    // Mutations still show the loader, and callers can opt a GET in with showLoading: true.
    const showRequestLoading = options.showLoading === true || method !== "GET";
    if (showRequestLoading) {
        activeRequests += 1;
        setLoading(true, retriesLeft < 2 ? "Waking up server (cold start)..." : "Connecting to server...");
    }
    let response;'''
if old_api in a and 'const showRequestLoading = options.showLoading === true' not in a:
    a = a.replace(old_api, new_api, 1)
old_finally = '''    } finally {
        activeRequests -= 1;
        if (activeRequests === 0) setLoading(false);
    }'''
new_finally = '''    } finally {
        if (showRequestLoading) {
            activeRequests -= 1;
            if (activeRequests === 0) setLoading(false);
        }
    }'''
if old_finally in a and 'if (showRequestLoading) {' not in a:
    a = a.replace(old_finally, new_finally, 1)
API.write_text(a)

# Mobile income ledger: turn the six-column table into compact cards below 700px,
# and give income actions the same visual treatment as the expense ledger actions.
c = TABLES.read_text()
marker = '/* Mobile income cards: prevent table-width overflow and keep actions visually consistent with the expense ledger. */'
if marker not in c:
    c += '''

/* Mobile income cards: prevent table-width overflow and keep actions visually consistent with the expense ledger. */
.income-table-container { width: 100% !important; max-width: 100% !important; overflow-x: hidden !important; box-sizing: border-box !important; }
.income-table { width: 100% !important; max-width: 100% !important; }
.income-table .btn-edit,
.income-table .btn-delete {
    width: 36px !important; height: 36px !important; min-width: 36px !important; min-height: 36px !important;
    padding: 0 !important; border-radius: 12px !important; display: inline-flex !important;
    align-items: center !important; justify-content: center !important; flex: 0 0 36px !important;
}
.income-table .btn-edit svg, .income-table .btn-delete svg { width: 15px !important; height: 15px !important; flex-shrink: 0 !important; }
@media (max-width: 700px) {
    .income-table-container { overflow-x: hidden !important; padding: 0 !important; }
    .income-table, .income-table thead, .income-table tbody, .income-table tr, .income-table td {
        display: block !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important;
    }
    .income-table thead { display: none !important; }
    .income-table tbody { display: grid !important; gap: 10px !important; }
    .income-table tbody tr {
        display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; gap: 0 12px !important;
        padding: 13px 12px !important; border: 1px solid var(--border) !important; border-radius: 14px !important;
        background: var(--card-bg) !important; box-shadow: 0 4px 18px rgba(0,0,0,0.08) !important; overflow: hidden !important;
    }
    .income-table tbody td {
        min-width: 0 !important; width: auto !important; max-width: none !important; padding: 4px 0 !important;
        border: 0 !important; white-space: normal !important; overflow-wrap: anywhere !important;
        word-break: break-word !important; vertical-align: middle !important;
    }
    .income-table tbody td:nth-child(1) { grid-column: 1 / -1 !important; color: var(--text-muted) !important; font-size: 11px !important; padding-bottom: 7px !important; }
    .income-table tbody td:nth-child(2) { grid-column: 1 !important; font-size: 14px !important; font-weight: 750 !important; color: var(--text-main) !important; }
    .income-table tbody td:nth-child(3) { grid-column: 1 / -1 !important; color: var(--text-muted) !important; font-size: 12px !important; line-height: 1.4 !important; }
    .income-table tbody td:nth-child(4) { grid-column: 1 !important; color: #10B981 !important; font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase !important; letter-spacing: 0.04em !important; }
    .income-table tbody td:nth-child(5) { grid-column: 1 !important; grid-row: 3 !important; color: #10B981 !important; font-family: var(--font-mono) !important; font-size: 15px !important; font-weight: 800 !important; white-space: nowrap !important; }
    .income-table tbody td:nth-child(6) { grid-column: 2 !important; grid-row: 2 / span 2 !important; align-self: center !important; justify-self: end !important; display: flex !important; align-items: center !important; justify-content: flex-end !important; gap: 7px !important; padding: 0 !important; }
    .income-table tbody td:nth-child(6) .btn-edit, .income-table tbody td:nth-child(6) .btn-delete {
        width: 34px !important; height: 34px !important; min-width: 34px !important; min-height: 34px !important; border-radius: 10px !important;
    }
    .income-table tbody td:nth-child(6) .btn-edit svg, .income-table tbody td:nth-child(6) .btn-delete svg { width: 14px !important; height: 14px !important; }
}
'''
TABLES.write_text(c)

# ── Dashboard runtime fixes and safe first-stage modularization ──
DASH = Path('frontend/js/dashboard.js')
DASH_HTML = Path('frontend/dashboard.html')
DASH_CSS = Path('frontend/css/ui-regression-fixes.css')
MODULE_DIR = Path('frontend/js/modules')

dash = DASH.read_text(encoding='utf-8')
dash = dash.replace(
    '${formatCurrency(spent)} of ${formatCurrency(limit)}',
    '${formatCurrency(b.spent)} of ${formatCurrency(b.limit)}',
    1,
)
dash = dash.replace(
    'if (!confirm(`Delete category "${catName}"? This can\'t be undone.`)) return;',
    'if (!(await window.appConfirm(`Delete category "${catName}"? This can\'t be undone.`))) return;',
    1,
)

# Extract the small, dependency-free utility block first; larger feature modules can follow after review.
helper_start = dash.find('// Timezone-safe local date helpers')
helper_end = dash.find('// Modal Scroll Lock Helpers')
if helper_start != -1 and helper_end > helper_start and 'window.DashboardUtils' not in dash:
    MODULE_DIR.mkdir(parents=True, exist_ok=True)
    utility = '''/* Shared dashboard utilities. */
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
        if (parts.length === 3) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
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
        if (typeof window.formatGlobalCurrency === "function") return window.formatGlobalCurrency(amount);
        const symbol = typeof window.getCurrencySymbol === "function" ? window.getCurrencySymbol() : "$";
        return `${symbol} ${Number(amount || 0).toFixed(2)}`;
    }

    function formatDate(value) {
        if (!value) return "";
        return parseLocalDate(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    window.DashboardUtils = Object.freeze({ getLocalDateString, parseLocalDate, escapeHtml, formatCurrency, formatDate });
})();
'''
    (MODULE_DIR / 'dashboard-utils.js').write_text(utility, encoding='utf-8')
    dash = dash[:helper_start] + '''// Shared utilities are loaded from js/modules/dashboard-utils.js.
const { getLocalDateString, parseLocalDate, escapeHtml, formatCurrency, formatDate } = window.DashboardUtils;

''' + dash[helper_end:]
DASH.write_text(dash, encoding='utf-8')

html = DASH_HTML.read_text(encoding='utf-8')
if 'js/modules/dashboard-utils.js' not in html:
    script_tag = '<script src="js/dashboard.js'
    idx = html.find(script_tag)
    if idx == -1:
        raise SystemExit('dashboard.js script tag not found')
    html = html[:idx] + '<script src="js/modules/dashboard-utils.js?v=20260910"></script>\n    ' + html[idx:]

html = html.replace(
    '<a href="#" id="biometricAuthBtn">🧬 Biometrics (Touch/Face ID)</a>',
    '''<a href="#" id="biometricAuthBtn" class="profile-menu-action" aria-label="Biometrics (Touch/Face ID)">
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2M21 17v2a2 2 0 0 0 2 2v-2"/>
        <path d="M8 8c1.2-1.7 2.9-2.5 4-2.5S14.8 6.3 16 8M7.5 12c0-1.7 1.6-3.5 4.5-3.5s4.5 1.8 4.5 3.5c0 2.1-1.7 4-4.5 4s-4.5-1.9-4.5-4Z"/>
    </svg>
    <span>Biometrics (Touch/Face ID)</span>
</a>''',
    1,
)
DASH_HTML.write_text(html, encoding='utf-8')

css = DASH_CSS.read_text(encoding='utf-8')
mobile_badge = '@media (max-width:760px) { .command-kbd { display:none !important; }'
if mobile_badge not in css:
    css = css.replace(
        '@media (max-width:760px) { .top-bar-actions .command-search-wrapper { width:100% !important; min-width:0 !important; } }',
        '@media (max-width:760px) { .command-kbd { display:none !important; } .top-bar-actions .command-search-wrapper { width:100% !important; min-width:0 !important; } }',
        1,
    )
css += '''

/* Mobile ledger controls scroll horizontally instead of clipping counters. */
@media (max-width:760px) {
    #ledgerStreamTabs, .ledger-stream-tabs {
        display:flex !important; flex-wrap:nowrap !important; overflow-x:auto !important; overflow-y:hidden !important;
        min-width:0 !important; width:100% !important; scrollbar-width:none !important; -webkit-overflow-scrolling:touch !important;
    }
    #ledgerStreamTabs::-webkit-scrollbar, .ledger-stream-tabs::-webkit-scrollbar { display:none !important; }
    #ledgerStreamTabs .stream-pill-btn, .ledger-stream-tabs .stream-pill-btn {
        flex:0 0 auto !important; min-width:max-content !important; white-space:nowrap !important;
    }
    #incomeList .btn-edit, #incomeList .btn-delete {
        width:34px !important; height:34px !important; min-width:34px !important; min-height:34px !important;
        padding:0 !important; border-radius:10px !important; display:inline-flex !important; align-items:center !important;
        justify-content:center !important; flex:0 0 34px !important; box-sizing:border-box !important;
    }
    #incomeList .btn-edit svg, #incomeList .btn-delete svg { width:14px !important; height:14px !important; display:block !important; }
}

/* Theme switches must not restart metric reveal/hover animation state. */
html.theme-transitioning .grid-4-metrics > .metric-card,
html.theme-transitioning .grid-4-metrics > .metric-card * { animation:none !important; transition:none !important; }
'''
DASH_CSS.write_text(css, encoding='utf-8')
