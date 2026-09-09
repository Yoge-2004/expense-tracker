from pathlib import Path

# One-time deterministic release stabilization patch; safe to re-run.
INDEX = Path('mobile/app/(tabs)/index.tsx')
REPORT = Path('src/main/java/com/example/expensetracker/controller/RangeReportController.java')

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
# Ensure exactly one shared filter clock exists before filteredExpenses.
s = s.replace('  // Filtered Expenses List (including Custom Date Range)', '  const now = new Date();\n\n  // Filtered Expenses List (including Custom Date Range)', 1)
while '  const now = new Date();\n\n  const now = new Date();' in s:
    s = s.replace('  const now = new Date();\n\n  const now = new Date();', '  const now = new Date();', 1)
s = s.replace('  const now = new Date();\n  const currentDay = Math.max(now.getDate(), 1);', '  const currentDay = Math.max(now.getDate(), 1);', 1)
INDEX.write_text(s)

r = REPORT.read_text()
r = r.replace('org.apache.poi.xssf.usermodel.XSSForg.apache.poi.xssf.usermodel.XSSFFont f=', 'org.apache.poi.xssf.usermodel.XSSFFont f=')
REPORT.write_text(r)
