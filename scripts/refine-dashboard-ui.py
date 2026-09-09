from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

# Dashboard budget status + complete export.
path = ROOT / "frontend/js/dashboard.js"
text = path.read_text(encoding="utf-8")

old_bar = '''                    <div class="budget-bar-track">\n                        <div class="budget-bar-fill" style="width:${pct}%; background:${barColor};"></div>\n                    </div>'''
new_bar = '''                    <div class="budget-status-row">\n                        <span>${formatCurrency(spent)} of ${formatCurrency(limit)}</span>\n                        <strong class="budget-status-value" style="color:${barColor};">${Math.round(b.percentage || 0)}% used</strong>\n                    </div>\n                    <div class="budget-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(Math.max(Number(b.percentage || 0), 0), 100)}" aria-label="${escapeHtml(b.categoryName || b.category?.name || 'Budget')} utilization">\n                        <div class="budget-bar-fill" style="width:${pct}%; background:${barColor};"></div>\n                    </div>'''
if old_bar in text and 'budget-status-row' not in text:
    text = text.replace(old_bar, new_bar, 1)

old_endpoint = '`${API_BASE_URL}/expenses/user/${userId}/export/excel`'
new_endpoint = '`${API_BASE_URL}/reports/user/${userId}/export/excel`'
if old_endpoint in text:
    text = text.replace(old_endpoint, new_endpoint, 1)
    text = text.replace('"expenses.xlsx",\n        "Generating Expenses Excel Workbook..."', '"financial-statement.xlsx",\n        "Generating financial statement..."', 1)

# Do not force a destructive reload whenever a browser tab becomes visible again.
# A normal cached load is enough; user mutations already invalidate API cache.
visibility = re.compile(
    r'\n// --- AUTO-UPDATE DASHBOARD WITH SERVER DATA ---.*?document\.addEventListener\("visibilitychange", \(\) => \{.*?\n\}\);\n',
    re.S,
)
text, removed = visibility.subn('', text, count=1)
if removed:
    text += '\n// Dashboard loads once at startup; foregrounding the tab must not wipe cache or rebuild the UI.\n'

path.write_text(text, encoding="utf-8")

# Load the theme performance guard on all web pages that expose the theme control.
theme_tag = '<script src="js/theme-performance.js"></script>'
for page_name in ("index.html", "register.html", "dashboard.html"):
    page = ROOT / "frontend" / page_name
    html = page.read_text(encoding="utf-8")
    if theme_tag not in html:
        marker = '<script src="js/api.js"></script>'
        if marker in html:
            html = html.replace(marker, marker + '\n    ' + theme_tag, 1)
        else:
            html = html.replace('</body>', '    ' + theme_tag + '\n</body>', 1)
        page.write_text(html, encoding="utf-8")

print("Refined dashboard budget/export behavior, removed destructive visibility refreshes, and enabled theme performance guard.")
