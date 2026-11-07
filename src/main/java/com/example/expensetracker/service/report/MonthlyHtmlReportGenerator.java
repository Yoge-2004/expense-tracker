package com.example.expensetracker.service.report;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.dto.SavingsGoalDto;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Generator for responsive, high-fidelity HTML monthly financial intelligence reports.
 *
 * <p>Constructs luxury-themed email summaries and printable letterhead statements
 * detailing cash flow summary, category breakdown, budget utilization, income inflows,
 * and savings goal progress.</p>
 *
 * @author Yogeshwaran
 */
@Component
public class MonthlyHtmlReportGenerator {

    private String escapeHtml(String text) {
        return text != null ? HtmlUtils.htmlEscape(text) : "";
    }

    private String formatCurrencyAmount(BigDecimal amount) {
        if (amount == null) return "0.00";
        return String.format(Locale.US, "%,.2f", amount);
    }

    public String buildMonthlyReportHtml(String userName, MonthlyReportDto report) {
        return buildMonthlyReportHtml(userName, report, 1L);
    }

    /**
     * Renders responsive HTML financial report including cash flow summary, category breakdown,
     * budget limits, income inflows, savings goals milestones, and high-fidelity print letterhead.
     */
    public String buildMonthlyReportHtml(String userName, MonthlyReportDto report, Long userId) {
        String rawCurr = report.currency() != null ? report.currency() : "INR";
        String currSymbol = "INR".equalsIgnoreCase(rawCurr) ? "₹"
                : ("USD".equalsIgnoreCase(rawCurr) ? "$"
                : ("EUR".equalsIgnoreCase(rawCurr) ? "€"
                : ("GBP".equalsIgnoreCase(rawCurr) ? "£"
                : ("JPY".equalsIgnoreCase(rawCurr) ? "¥" : rawCurr))));

        long effectiveUserId = userId != null ? userId : 1L;
        String refCode = String.format("ET-STMT-%04d%02d-%04d", report.year(), report.month(), effectiveUserId % 10000L);
        String generationDate = LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US));

        // Categories
        StringBuilder categoryRows = new StringBuilder();
        for (MonthlyReportDto.CategoryReportDto c : report.categoryBreakdown()) {
            categoryRows.append("""
                <tr class="report-row report-cat-row">
                    <td class="report-cell report-cat-name" style="padding: 12px 14px; border-bottom: 1px solid rgba(236,231,216,0.08);
                               font-weight: 600; color: #ece7d8;">%s</td>
                    <td class="report-cell report-amount report-cat-amount" style="padding: 12px 14px; border-bottom: 1px solid rgba(236,231,216,0.08);
                               text-align: right; font-weight: 700; color: #c79a3e;">%s %s</td>
                    <td class="report-cell report-share-cell" style="padding: 12px 14px; border-bottom: 1px solid rgba(236,231,216,0.08);
                               text-align: right;">
                        <span class="report-share-badge" style="display: inline-block; background: rgba(199, 154, 62, 0.12); color: #c79a3e;
                                     padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 12px;">
                            %.1f%%
                        </span>
                    </td>
                </tr>
                """.formatted(escapeHtml(c.categoryName()), currSymbol, formatCurrencyAmount(c.totalAmount()), c.percentage()));
        }

        // Budgets
        StringBuilder budgetCards = new StringBuilder();
        for (MonthlyReportDto.BudgetReportDto b : report.budgetStatuses()) {
            String badgeColor = b.usagePercentage() > 100 ? "#ef4444"
                    : (b.usagePercentage() > 80 ? "#f59e0b" : "#10b981");
            String badgeText = b.usagePercentage() > 100 ? "Exceeded"
                    : (b.usagePercentage() > 80 ? "Near Limit" : "On Track");
            double barWidth = Math.min(b.usagePercentage(), 100.0);
            budgetCards.append("""
                <div class="report-card budget-card" style="background: #10120e; border: 1px solid rgba(236,231,216,0.1);
                            border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                    <div class="card-head" style="display: flex; justify-content: space-between; align-items: center;
                                margin-bottom: 8px;">
                        <span class="card-title" style="font-size: 14px; font-weight: 700; color: #ece7d8;">%s</span>
                        <span class="budget-badge" style="font-size: 12px; font-weight: 700; color: %s;
                                     background: rgba(255,255,255,0.05); padding: 3px 8px;
                                     border-radius: 6px;">%s (%.1f%%)</span>
                    </div>
                    <div class="progress-track" style="background: rgba(255,255,255,0.08); height: 6px;
                                border-radius: 999px; overflow: hidden; margin-bottom: 8px;">
                        <div class="progress-fill" style="background: %s; width: %.1f%%; height: 100%%; border-radius: 999px;"></div>
                    </div>
                    <div class="card-foot" style="display: flex; justify-content: space-between; font-size: 12px; color: #a8a395;">
                        <span>Spent: <strong class="card-amt">%s %s</strong></span>
                        <span>Limit: <strong class="card-amt">%s %s</strong></span>
                    </div>
                </div>
                """.formatted(escapeHtml(b.categoryName()), badgeColor, badgeText, b.usagePercentage(),
                        badgeColor, barWidth, currSymbol, formatCurrencyAmount(b.spentAmount()), currSymbol, formatCurrencyAmount(b.limitAmount())));
        }

        // Savings Goals
        StringBuilder savingsCards = new StringBuilder();
        if (report.savingsGoals() != null && !report.savingsGoals().isEmpty()) {
            for (SavingsGoalDto g : report.savingsGoals()) {
                boolean completed = "COMPLETED".equalsIgnoreCase(g.status()) || g.progressPercentage() >= 100.0;
                String badgeColor = completed ? "#10b981" : "#3b82f6";
                String badgeText = completed ? "Achieved" : String.format(Locale.US, "%.1f%%", g.progressPercentage());
                double barWidth = Math.min(g.progressPercentage(), 100.0);
                savingsCards.append("""
                    <div class="report-card savings-card" style="background: #10120e; border: 1px solid rgba(236,231,216,0.1);
                                border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                        <div class="card-head" style="display: flex; justify-content: space-between; align-items: center;
                                    margin-bottom: 8px;">
                            <span class="card-title" style="font-size: 14px; font-weight: 700; color: #ece7d8;">%s</span>
                            <span class="savings-badge" style="font-size: 12px; font-weight: 700; color: %s;
                                         background: rgba(255,255,255,0.05); padding: 3px 8px;
                                         border-radius: 6px;">%s</span>
                        </div>
                        <div class="progress-track" style="background: rgba(255,255,255,0.08); height: 6px;
                                    border-radius: 999px; overflow: hidden; margin-bottom: 8px;">
                            <div class="progress-fill" style="background: %s; width: %.1f%%; height: 100%%; border-radius: 999px;"></div>
                        </div>
                        <div class="card-foot" style="display: flex; justify-content: space-between; font-size: 12px; color: #a8a395;">
                            <span>Saved: <strong class="card-amt">%s %s</strong></span>
                            <span>Target: <strong class="card-amt">%s %s</strong>%s</span>
                        </div>
                    </div>
                    """.formatted(
                        escapeHtml(g.name()),
                        badgeColor,
                        badgeText,
                        badgeColor,
                        barWidth,
                        currSymbol,
                        formatCurrencyAmount(g.currentAmount()),
                        currSymbol,
                        formatCurrencyAmount(g.targetAmount()),
                        g.targetDate() != null ? " · Due " + g.targetDate() : ""
                    ));
            }
        }

        // Incomes Rows
        StringBuilder incomeRows = new StringBuilder();
        if (report.incomes() != null && !report.incomes().isEmpty()) {
            for (IncomeDto inc : report.incomes()) {
                incomeRows.append("""
                    <tr class="report-row report-income-row">
                        <td class="report-cell report-date" style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 13px; color: #a8a395;">%s</td>
                        <td class="report-cell report-desc" style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 13px; font-weight: 600; color: #ece7d8;">%s</td>
                        <td class="report-cell report-source" style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 12px; color: #10b981;">%s</td>
                        <td class="report-cell report-amount report-income-amount" style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   text-align: right; font-weight: 700; color: #10b981;">+ %s %s</td>
                    </tr>
                    """.formatted(
                        inc.incomeDate() != null ? inc.incomeDate().toString() : "—",
                        escapeHtml(inc.description() != null && !inc.description().isBlank()
                            ? inc.description() : "Income Inflow"),
                        escapeHtml(inc.source() != null ? inc.source() : "General"),
                        currSymbol,
                        formatCurrencyAmount(inc.amount())
                    ));
            }
        }

        // Executive Insights
        StringBuilder insightItems = new StringBuilder();
        if (report.insights() != null) {
            for (String insight : report.insights()) {
                insightItems.append("""
                    <div class="insight-item" style="padding: 10px 14px; background: rgba(199, 154, 62, 0.06);
                                border-left: 3px solid #c79a3e; border-radius: 0 8px 8px 0; margin-bottom: 8px;
                                font-size: 13px; color: #ece7d8; line-height: 1.5;">
                        %s
                    </div>
                    """.formatted(escapeHtml(insight)));
            }
        }

        // Top Expenses
        StringBuilder topExpenseRows = new StringBuilder();
        if (report.topExpenses() != null && !report.topExpenses().isEmpty()) {
            for (ExpenseDto exp : report.topExpenses()) {
                topExpenseRows.append("""
                    <tr class="report-row report-expense-row">
                        <td class="report-cell report-date" style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 13px; color: #a8a395;">%s</td>
                        <td class="report-cell report-desc" style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 13px; font-weight: 600; color: #ece7d8;">%s</td>
                        <td class="report-cell report-cat" style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 12px; color: #c79a3e;">%s</td>
                        <td class="report-cell report-amount report-expense-amount" style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   text-align: right; font-weight: 700; color: #ef4444;">- %s %s</td>
                    </tr>
                    """.formatted(
                        exp.expenseDate() != null ? exp.expenseDate().toString() : "—",
                        escapeHtml(exp.description() != null && !exp.description().isBlank()
                            ? exp.description() : "General Expense"),
                        escapeHtml(exp.categoryName() != null ? exp.categoryName() : "General"),
                        currSymbol,
                        formatCurrencyAmount(exp.amount())
                    ));
            }
        }

        return """
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ExpenseTracker Pro - Monthly Financial Statement - %s</title>
            <style>
              body { margin: 0; padding: 0; background-color: #080a07;
                     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                     color: #ece7d8; }
              .email-container { max-width: 660px; margin: 30px auto; background: #131711;
                                 border: 1px solid rgba(236, 231, 216, 0.12); border-radius: 20px;
                                 overflow: hidden; box-shadow: 0 24px 48px rgba(0,0,0,0.6); }
              .email-header { padding: 36px 32px; text-align: center;
                              border-bottom: 1px solid rgba(236, 231, 216, 0.08);
                              background: linear-gradient(180deg, rgba(199, 154, 62, 0.15) 0%%,
                                                          rgba(19, 23, 17, 0) 100%%); }
              .brand-badge { display: inline-block; background: rgba(199, 154, 62, 0.15);
                             border: 1px solid rgba(199, 154, 62, 0.3); border-radius: 999px;
                             padding: 6px 18px; font-size: 13px; font-weight: 800;
                             color: #c79a3e; letter-spacing: 0.5px; }
              .stat-grid { display: table; width: 100%%; margin-bottom: 24px; }
              .stat-cell { display: table-cell; width: 50%%; padding: 6px; }
              .stat-box { background: #0b0d09; border: 1px solid rgba(236, 231, 216, 0.08);
                          border-radius: 14px; padding: 18px 14px; text-align: center; }
              .hero-card { background: #0b0d09; border: 1px solid #c79a3e; border-radius: 16px;
                           padding: 26px; text-align: center; margin-bottom: 24px; }
              .hero-val { font-size: 38px; font-weight: 900; color: #c79a3e; margin-top: 4px; letter-spacing: -0.5px; }
              .section-title { font-size: 15px; font-weight: 800; text-transform: uppercase;
                               letter-spacing: 1px; color: #c79a3e; margin: 28px 0 12px; }
              .email-body { padding: 32px; }
              .email-footer { padding: 24px 32px; border-top: 1px solid rgba(236, 231, 216, 0.08);
                              background: #0b0d09; text-align: center; font-size: 12px;
                              color: #6b6558; line-height: 1.6; }
              .print-letterhead, .print-footer { display: none; }

              /* Custom Luxury Scrollbar */
              html, body {
                  scrollbar-width: thin !important;
                  scrollbar-color: rgba(199, 154, 62, 0.45) rgba(11, 13, 9, 0.9) !important;
              }
              html::-webkit-scrollbar,
              body::-webkit-scrollbar,
              ::-webkit-scrollbar {
                  width: 7px !important;
                  height: 7px !important;
              }
              html::-webkit-scrollbar-track,
              body::-webkit-scrollbar-track,
              ::-webkit-scrollbar-track {
                  background: #0b0d09 !important;
                  border-radius: 999px !important;
              }
              html::-webkit-scrollbar-thumb,
              body::-webkit-scrollbar-thumb,
              ::-webkit-scrollbar-thumb {
                  background: rgba(199, 154, 62, 0.45) !important;
                  border-radius: 999px !important;
                  border: 1.5px solid transparent !important;
                  background-clip: padding-box !important;
              }
              html::-webkit-scrollbar-thumb:hover,
              body::-webkit-scrollbar-thumb:hover,
              ::-webkit-scrollbar-thumb:hover {
                  background: rgba(199, 154, 62, 0.8) !important;
              }

              /* ==========================================================================
                 EXECUTIVE PRINT MEDIA STYLESHEET (A4 & US Letter Financial Statement)
                 ========================================================================== */
              @media print {
                  @page {
                      size: A4 portrait;
                      margin: 10mm 12mm 14mm 12mm;
                  }
                  *, *:before, *:after {
                      box-sizing: border-box !important;
                      text-shadow: none !important;
                      filter: none !important;
                  }
                  html, body {
                      background: #ffffff !important;
                      background-color: #ffffff !important;
                      color: #0f172a !important;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                      font-size: 10pt !important;
                      line-height: 1.4 !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      scrollbar-width: none !important;
                  }
                  ::-webkit-scrollbar {
                      display: none !important;
                  }
                  .email-container {
                      max-width: 100%% !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      background: #ffffff !important;
                      border: none !important;
                      border-radius: 0 !important;
                      box-shadow: none !important;
                  }
                  .email-header,
                  .email-footer,
                  .brand-badge,
                  .view-online-link {
                      display: none !important;
                  }
                  .print-letterhead {
                      display: block !important;
                      border-bottom: 2pt solid #0f172a;
                      padding-bottom: 14pt;
                      margin-bottom: 18pt;
                  }
                  .print-letterhead-top {
                      display: flex !important;
                      justify-content: space-between !important;
                      align-items: flex-start !important;
                  }
                  .print-brand {
                      font-size: 20pt !important;
                      font-weight: 800 !important;
                      color: #0f172a !important;
                      letter-spacing: -0.5pt !important;
                      line-height: 1.1 !important;
                  }
                  .print-brand-tag {
                      font-size: 8.5pt !important;
                      font-weight: 700 !important;
                      color: #c79a3e !important;
                      text-transform: uppercase !important;
                      letter-spacing: 1.5pt !important;
                      margin-top: 2pt !important;
                  }
                  .print-meta {
                      text-align: right !important;
                      font-size: 8.5pt !important;
                      color: #475569 !important;
                      line-height: 1.4 !important;
                  }
                  .print-meta-badge {
                      display: inline-block !important;
                      background: #0f172a !important;
                      color: #f8fafc !important;
                      padding: 2pt 6pt !important;
                      border-radius: 3pt !important;
                      font-weight: 700 !important;
                      font-size: 8pt !important;
                      letter-spacing: 0.5pt !important;
                      margin-bottom: 3pt !important;
                  }
                  .print-client-strip {
                      display: flex !important;
                      justify-content: space-between !important;
                      background: #f8fafc !important;
                      border: 0.75pt solid #e2e8f0 !important;
                      border-radius: 4pt !important;
                      padding: 8pt 12pt !important;
                      margin-top: 10pt !important;
                      font-size: 9pt !important;
                  }
                  .print-client-label {
                      color: #64748b !important;
                      font-size: 7.5pt !important;
                      text-transform: uppercase !important;
                      letter-spacing: 0.75pt !important;
                      margin-bottom: 1pt !important;
                  }
                  .print-client-value {
                      color: #0f172a !important;
                      font-weight: 700 !important;
                  }
                  .email-body {
                      padding: 0 !important;
                  }
                  .hero-card {
                      background: #f8fafc !important;
                      border: 1pt solid #cbd5e1 !important;
                      border-left: 4pt solid #0f172a !important;
                      border-radius: 4pt !important;
                      padding: 12pt 16pt !important;
                      margin-bottom: 14pt !important;
                      text-align: left !important;
                      box-shadow: none !important;
                      display: flex !important;
                      justify-content: space-between !important;
                      align-items: center !important;
                      page-break-inside: avoid !important;
                  }
                  .hero-card > div:first-child {
                      color: #64748b !important;
                      font-size: 8.5pt !important;
                      text-transform: uppercase !important;
                      letter-spacing: 0.75pt !important;
                  }
                  .hero-val {
                      color: #0f172a !important;
                      font-size: 24pt !important;
                      font-weight: 800 !important;
                      margin: 2pt 0 0 0 !important;
                  }
                  .stat-grid {
                      display: flex !important;
                      flex-wrap: wrap !important;
                      gap: 8pt !important;
                      margin-bottom: 14pt !important;
                      page-break-inside: avoid !important;
                  }
                  .stat-cell {
                      display: block !important;
                      width: calc(50%% - 4pt) !important;
                      padding: 0 !important;
                  }
                  .stat-box {
                      background: #ffffff !important;
                      border: 0.75pt solid #cbd5e1 !important;
                      border-radius: 4pt !important;
                      padding: 8pt 10pt !important;
                      text-align: left !important;
                      height: 100%% !important;
                      box-shadow: none !important;
                  }
                  .stat-box > div:first-child {
                      color: #64748b !important;
                      font-size: 8pt !important;
                      text-transform: uppercase !important;
                      letter-spacing: 0.5pt !important;
                      margin-bottom: 2pt !important;
                  }
                  .stat-box > div:last-child {
                      color: #0f172a !important;
                      font-size: 13pt !important;
                      font-weight: 700 !important;
                  }
                  .stat-box > div:last-child[style*="#10b981"],
                  .stat-box > div:last-child[style*="green"] {
                      color: #15803d !important;
                  }
                  .stat-box > div:last-child[style*="#ef4444"],
                  .stat-box > div:last-child[style*="red"] {
                      color: #b91c1c !important;
                  }
                  .section-title {
                      color: #0f172a !important;
                      font-size: 10.5pt !important;
                      font-weight: 800 !important;
                      text-transform: uppercase !important;
                      letter-spacing: 0.75pt !important;
                      border-bottom: 1pt solid #e2e8f0 !important;
                      padding-bottom: 4pt !important;
                      margin: 14pt 0 8pt 0 !important;
                      page-break-after: avoid !important;
                  }
                  .report-card,
                  .budget-card,
                  .savings-card {
                      background: #ffffff !important;
                      border: 0.75pt solid #e2e8f0 !important;
                      border-radius: 4pt !important;
                      padding: 8pt 10pt !important;
                      margin-bottom: 6pt !important;
                      page-break-inside: avoid !important;
                  }
                  .card-title {
                      color: #0f172a !important;
                      font-size: 9.5pt !important;
                      font-weight: 700 !important;
                  }
                  .card-amt, .card-foot {
                      color: #475569 !important;
                      font-size: 8.5pt !important;
                  }
                  .card-amt {
                      color: #0f172a !important;
                      font-weight: 700 !important;
                  }
                  .budget-badge, .savings-badge {
                      border: 0.5pt solid #cbd5e1 !important;
                      background: #f1f5f9 !important;
                      font-size: 7.5pt !important;
                      padding: 1pt 5pt !important;
                  }
                  .progress-track {
                      background: #e2e8f0 !important;
                      height: 4pt !important;
                      margin-bottom: 4pt !important;
                  }
                  .progress-fill {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                  }
                  .report-table {
                      width: 100%% !important;
                      border-collapse: collapse !important;
                      margin-bottom: 12pt !important;
                      font-size: 8.5pt !important;
                      page-break-inside: auto !important;
                  }
                  .report-table thead {
                      display: table-header-group !important;
                  }
                  .report-table tr {
                      page-break-inside: avoid !important;
                      page-break-after: auto !important;
                  }
                  .report-table th {
                      background: #f1f5f9 !important;
                      color: #334155 !important;
                      font-weight: 700 !important;
                      font-size: 7.5pt !important;
                      text-transform: uppercase !important;
                      letter-spacing: 0.5pt !important;
                      border-top: 0.75pt solid #cbd5e1 !important;
                      border-bottom: 1pt solid #0f172a !important;
                      padding: 5pt 6pt !important;
                  }
                  .report-table td {
                      border-bottom: 0.5pt solid #e2e8f0 !important;
                      padding: 5pt 6pt !important;
                      color: #1e293b !important;
                  }
                  .report-table .report-cat-name,
                  .report-table .report-desc {
                      color: #0f172a !important;
                      font-weight: 600 !important;
                  }
                  .report-table .report-amount {
                      font-weight: 700 !important;
                  }
                  .report-cat-amount {
                      color: #0f172a !important;
                  }
                  .report-expense-amount {
                      color: #b91c1c !important;
                  }
                  .report-income-amount {
                      color: #15803d !important;
                  }
                  .report-share-badge {
                      background: #f1f5f9 !important;
                      color: #334155 !important;
                      border: 0.5pt solid #cbd5e1 !important;
                      font-size: 7.5pt !important;
                      padding: 1pt 4pt !important;
                  }
                  .insight-item {
                      background: #f8fafc !important;
                      border-left: 3pt solid #0f172a !important;
                      border-top: 0.5pt solid #e2e8f0 !important;
                      border-right: 0.5pt solid #e2e8f0 !important;
                      border-bottom: 0.5pt solid #e2e8f0 !important;
                      color: #1e293b !important;
                      padding: 6pt 10pt !important;
                      margin-bottom: 6pt !important;
                      font-size: 8.5pt !important;
                      line-height: 1.4 !important;
                      page-break-inside: avoid !important;
                  }
                  .print-footer {
                      display: block !important;
                      margin-top: 18pt !important;
                      padding-top: 8pt !important;
                      border-top: 0.75pt solid #cbd5e1 !important;
                      font-size: 7pt !important;
                      color: #64748b !important;
                      page-break-inside: avoid !important;
                  }
                  .print-footer-row {
                      display: flex !important;
                      justify-content: space-between !important;
                      align-items: center !important;
                  }
                  .print-footer-left {
                      font-weight: 700 !important;
                      color: #0f172a !important;
                  }
                  .print-footer-right {
                      text-align: right !important;
                  }
                  .print-footer-disclaimer {
                      margin-top: 4pt !important;
                      color: #94a3b8 !important;
                      font-size: 6.5pt !important;
                      line-height: 1.3 !important;
                  }
              }
            </style>
            </head>
            <body>
              <div class="email-container">
                <!-- PRINT ONLY LETTERHEAD -->
                <div class="print-letterhead">
                  <div class="print-letterhead-top">
                    <div>
                      <div class="print-brand">EXPENSETRACKER PRO</div>
                      <div class="print-brand-tag">Executive Wealth &amp; Cash Flow Advisory</div>
                    </div>
                    <div class="print-meta">
                      <div class="print-meta-badge">OFFICIAL STATEMENT</div>
                      <div>Statement Ref: <strong>%s</strong></div>
                      <div>Issued: %s</div>
                    </div>
                  </div>
                  <div class="print-client-strip">
                    <div>
                      <div class="print-client-label">Account Holder</div>
                      <div class="print-client-value">%s</div>
                    </div>
                    <div>
                      <div class="print-client-label">Reporting Period</div>
                      <div class="print-client-value">%s</div>
                    </div>
                    <div>
                      <div class="print-client-label">Functional Currency</div>
                      <div class="print-client-value">%s (%s)</div>
                    </div>
                  </div>
                </div>

                <div class="email-header">
                  <div class="brand-badge"><span style="color:#c79a3e; margin-right:4px;">✦</span> OBSIDIAN &amp; LUXURY GOLD EXECUTIVE STATEMENT</div>
                  <h1 style="color: #ece7d8; font-size: 24px; margin: 16px 0 6px 0; font-weight: 800;">
                    Financial Statement
                  </h1>
                  <p style="color: #a8a395; font-size: 14px; margin: 0;">%s · Prepared for %s</p>
                </div>

                <div class="email-body">
                  <!-- Net Cash Flow Hero -->
                  <div class="hero-card">
                    <div style="color: #a8a395; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                      Monthly Net Inflow / Outflow
                    </div>
                    <div class="hero-val">%s%s</div>
                    <div style="font-size: 13px; color: #a8a395; margin-top: 6px;">
                      Based on %d recorded transactions
                    </div>
                  </div>

                  <!-- 4-Box Key Metrics Grid -->
                  <div class="stat-grid">
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="color: #a8a395; font-size: 11px; font-weight: 700; text-transform: uppercase;">Total Income</div>
                        <div style="color: #10b981; font-size: 18px; font-weight: 800; margin-top: 4px;">+ %s%s</div>
                      </div>
                    </div>
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="color: #a8a395; font-size: 11px; font-weight: 700; text-transform: uppercase;">Savings Rate</div>
                        <div style="color: #ece7d8; font-size: 18px; font-weight: 800; margin-top: 4px;">%.1f%%</div>
                      </div>
                    </div>
                  </div>
                  <div class="stat-grid">
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="color: #a8a395; font-size: 11px; font-weight: 700; text-transform: uppercase;">Net Cash Flow</div>
                        <div style="color: #c79a3e; font-size: 18px; font-weight: 800; margin-top: 4px;">%s%s</div>
                      </div>
                    </div>
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="color: #a8a395; font-size: 11px; font-weight: 700; text-transform: uppercase;">Daily Burn Rate</div>
                        <div style="color: #ece7d8; font-size: 18px; font-weight: 800; margin-top: 4px;">%s%s/day</div>
                      </div>
                    </div>
                  </div>

                  <!-- Efficiency & Commitments Row -->
                  <div class="stat-grid" style="margin-bottom: 24px;">
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="color: #a8a395; font-size: 11px; font-weight: 700; text-transform: uppercase;">Budget Health Score</div>
                        <div style="color: #c79a3e; font-size: 18px; font-weight: 800; margin-top: 4px;">%d / 100</div>
                      </div>
                    </div>
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="color: #a8a395; font-size: 11px; font-weight: 700; text-transform: uppercase;">Peak Transaction</div>
                        <div style="color: #ef4444; font-size: 18px; font-weight: 800; margin-top: 4px;">- %s%s</div>
                      </div>
                    </div>
                  </div>

                  <!-- Fixed Subscriptions / Commitments -->
                  <div style="background: rgba(199, 154, 62, 0.08); border: 1px solid rgba(199, 154, 62, 0.2); border-radius: 12px; padding: 14px; margin-bottom: 24px;">
                    <div style="font-size: 12px; font-weight: 700; color: #c79a3e; text-transform: uppercase; letter-spacing: 0.5px;">Recurring Subscriptions &amp; Commitments</div>
                    <div style="font-size: 18px; font-weight: 800; color: #ece7d8; margin-top: 2px;">%s%s <span style="font-size: 12px; font-weight: normal; color: #a8a395;">scheduled this cycle</span></div>
                  </div>

                  <!-- Executive Strategic Insights -->
                  <div class="section-title">Automated Financial Insights</div>
                  <div style="margin-bottom: 24px;">
                    %s
                  </div>

                  <!-- Income Inflows Breakdown -->
                  <div class="section-title">Income &amp; Earnings Streams</div>
                  <table class="report-table report-income-table" style="width: 100%%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                    <thead>
                      <tr style="color: #a8a395; text-align: left;
                        border-bottom: 1px solid rgba(236,231,216,0.15);
                        font-size: 11px; text-transform: uppercase;">
                        <th style="padding: 6px 12px;">Date</th>
                        <th style="padding: 6px 12px;">Description</th>
                        <th style="padding: 6px 12px;">Source</th>
                        <th style="padding: 6px 12px; text-align: right;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      %s
                    </tbody>
                  </table>

                  <!-- Savings Goals Progress -->
                  <div class="section-title">Savings Goals &amp; Capital Accumulation</div>
                  <div style="margin-bottom: 24px;">
                    %s
                  </div>

                  <!-- Category Spending Breakdown -->
                  <div class="section-title">Category Outflows</div>
                  <table class="report-table report-cat-table" style="width: 100%%; border-collapse: collapse; margin-bottom: 24px;">
                    <thead>
                      <tr style="color: #a8a395; text-align: left; border-bottom: 1px solid rgba(236,231,216,0.15); font-size: 11px; text-transform: uppercase;">
                        <th style="padding: 8px 12px;">Category</th>
                        <th style="padding: 8px 12px; text-align: right;">Spent</th>
                        <th style="padding: 8px 12px; text-align: right;">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      %s
                    </tbody>
                  </table>

                  <!-- Budget Utilization -->
                  <div class="section-title">Category Budget Adherence</div>
                  <div style="margin-bottom: 24px;">
                    %s
                  </div>

                  <!-- Largest Outflows -->
                  %s

                </div>

                <div class="email-footer">
                  <p style="margin: 0 0 6px 0; font-weight: 700; color: #a8a395;">
                    ExpenseTracker Pro — Intelligent Wealth &amp; Cash Flow Manager
                  </p>
                  <p style="margin: 0;">
                    This is an automated monthly financial briefing generated for your account. Keep track of your daily expenses in the app for real-time intelligence.
                  </p>
                </div>

                <!-- PRINT ONLY FOOTER -->
                <div class="print-footer">
                  <div class="print-footer-row">
                    <div class="print-footer-left">
                      ExpenseTracker Pro Statements · Confidential Document
                    </div>
                    <div class="print-footer-right">
                      <span>Personal &amp; Confidential Statement for %s</span>
                      <div class="print-footer-sub">Period: %s · Generated: %s</div>
                    </div>
                  </div>
                  <div class="print-footer-disclaimer">
                    This monthly financial performance statement is automatically compiled from authenticated transaction records for personal wealth tracking, tax planning, and audit preservation. Confidential document.
                  </div>
                </div>
              </div>
            </body>
            </html>
            """.formatted(
                report.period(),
                refCode,
                generationDate,
                userName != null ? userName : "User",
                report.period(),
                rawCurr,
                currSymbol,
                report.period(),
                userName != null ? userName : "User",
                currSymbol,
                formatCurrencyAmount(report.totalOutflow()),
                report.transactionCount(),
                currSymbol,
                formatCurrencyAmount(report.totalIncome()),
                report.savingsRate(),
                currSymbol,
                formatCurrencyAmount(report.netCashFlow()),
                currSymbol,
                formatCurrencyAmount(report.dailyAverage()),
                report.budgetHealthScore(),
                currSymbol,
                formatCurrencyAmount(report.highestExpenseAmount()),
                currSymbol,
                formatCurrencyAmount(report.recurringTotal()),
                insightItems.toString(),
                !incomeRows.isEmpty() ? incomeRows.toString()
                        : ("<tr><td colspan='4' style='padding: 12px; color: #a8a395;'>"
                        + "No income recorded this month.</td></tr>"),
                !savingsCards.isEmpty() ? savingsCards.toString()
                        : ("<div style='color: #a8a395; font-size: 13px;'>"
                        + "No active savings goals configured. Start a savings goal in your dashboard!</div>"),
                !categoryRows.isEmpty() ? categoryRows.toString()
                        : ("<tr><td colspan='3' style='padding: 12px; color: #a8a395;'>"
                        + "No spending recorded this month.</td></tr>"),
                !budgetCards.isEmpty() ? budgetCards.toString()
                        : ("<div style='color: #a8a395; font-size: 13px;'>"
                        + "No category budgets configured for this period.</div>"),
                !topExpenseRows.isEmpty() ? """
                    <div class="section-title">Largest Outflow Transactions</div>
                    <table class="report-table report-expense-table" style="width: 100%%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                      <thead>
                        <tr style="color: #a8a395; text-align: left;
                          border-bottom: 1px solid rgba(236,231,216,0.15);
                          font-size: 11px; text-transform: uppercase;">
                          <th style="padding: 6px 12px;">Date</th>
                          <th style="padding: 6px 12px;">Description</th>
                          <th style="padding: 6px 12px;">Category</th>
                          <th style="padding: 6px 12px; text-align: right;">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        %s
                      </tbody>
                    </table>
                    """.formatted(topExpenseRows.toString()) : "",
                userName != null ? userName : "User",
                report.period(),
                generationDate
            );
    }
}
