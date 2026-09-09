from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "frontend/js/dashboard.js"
text = path.read_text(encoding="utf-8")

# Show actual utilization and remaining/over-budget state directly above the bounded bar.
old_bar = '''                    <div class="budget-bar-track">\n                        <div class="budget-bar-fill" style="width:${pct}%; background:${barColor};"></div>\n                    </div>'''
new_bar = '''                    <div class="budget-status-row">\n                        <span>${formatCurrency(spent)} of ${formatCurrency(limit)}</span>\n                        <strong class="budget-status-value" style="color:${barColor};">${Math.round(b.percentage || 0)}% used</strong>\n                    </div>\n                    <div class="budget-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(Math.max(Number(b.percentage || 0), 0), 100)}" aria-label="${escapeHtml(b.categoryName || b.category?.name || 'Budget')} utilization">\n                        <div class="budget-bar-fill" style="width:${pct}%; background:${barColor};"></div>\n                    </div>'''
if old_bar in text and 'budget-status-row' not in text:
    text = text.replace(old_bar, new_bar, 1)

# The dashboard's main Excel export should use the complete financial statement endpoint,
# which includes incomes, expenses, savings goals, subscriptions, budgets, and cash flow.
old_endpoint = '`${API_BASE_URL}/expenses/user/${userId}/export/excel`'
new_endpoint = '`${API_BASE_URL}/reports/user/${userId}/export/excel`'
if old_endpoint in text:
    text = text.replace(old_endpoint, new_endpoint, 1)

path.write_text(text, encoding="utf-8")
print("Refined dashboard budget status and complete financial Excel export.")
