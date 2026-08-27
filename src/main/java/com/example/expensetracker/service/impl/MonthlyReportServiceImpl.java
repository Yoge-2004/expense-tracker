package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.MonthlyReportLog;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.MonthlyReportLogRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.MonthlyReportService;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MonthlyReportServiceImpl implements MonthlyReportService {

    private static final Logger log = LoggerFactory.getLogger(MonthlyReportServiceImpl.class);

    private final UserRepository userRepository;
    private final ExpenseRepository expenseRepository;
    private final BudgetRepository budgetRepository;
    private final MonthlyReportLogRepository reportLogRepository;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${spring.mail.host:}")
    private String configuredMailHost;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    public MonthlyReportServiceImpl(UserRepository userRepository,
                                    ExpenseRepository expenseRepository,
                                    BudgetRepository budgetRepository,
                                    MonthlyReportLogRepository reportLogRepository,
                                    ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.userRepository = userRepository;
        this.expenseRepository = expenseRepository;
        this.budgetRepository = budgetRepository;
        this.reportLogRepository = reportLogRepository;
        this.mailSenderProvider = mailSenderProvider;
    }

    @Override
    @Transactional(readOnly = true)
    public MonthlyReportDto generateMonthlyReport(Long userId, int year, int month) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = startDate.withDayOfMonth(startDate.lengthOfMonth());

        List<Expense> expenses = expenseRepository.findByUserAndExpenseDateBetween(user, startDate, endDate);

        BigDecimal totalOutflow = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int daysInMonth = startDate.lengthOfMonth();
        BigDecimal dailyAverage = daysInMonth > 0 && totalOutflow.compareTo(BigDecimal.ZERO) > 0
                ? totalOutflow.divide(BigDecimal.valueOf(daysInMonth), 2, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal recurringTotal = expenses.stream()
                .filter(Expense::isRecurring)
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Highest expense
        Expense highestExpense = expenses.stream()
                .max(Comparator.comparing(Expense::getAmount))
                .orElse(null);
        BigDecimal highestExpenseAmount = highestExpense != null ? highestExpense.getAmount() : BigDecimal.ZERO;
        String highestExpenseDescription = highestExpense != null ? highestExpense.getDescription() : "None";

        // Category Breakdown
        Map<String, BigDecimal> categorySums = new HashMap<>();
        for (Expense e : expenses) {
            String catName = e.getCategory() != null ? e.getCategory().getName() : "Uncategorized";
            categorySums.merge(catName, e.getAmount(), BigDecimal::add);
        }

        List<MonthlyReportDto.CategoryReportDto> categoryBreakdown = new ArrayList<>();
        double totalDouble = totalOutflow.doubleValue();

        for (Map.Entry<String, BigDecimal> entry : categorySums.entrySet()) {
            double pct = totalDouble > 0 ? (entry.getValue().doubleValue() / totalDouble) * 100.0 : 0.0;
            categoryBreakdown.add(new MonthlyReportDto.CategoryReportDto(
                    entry.getKey(),
                    entry.getValue(),
                    Math.round(pct * 10.0) / 10.0
            ));
        }
        categoryBreakdown.sort((a, b) -> b.getTotalAmount().compareTo(a.getTotalAmount()));

        // Budget Adherence
        List<Budget> budgets = budgetRepository.findByUser(user);
        List<MonthlyReportDto.BudgetReportDto> budgetStatuses = new ArrayList<>();
        int withinBudgetCount = 0;

        for (Budget b : budgets) {
            String catName = b.getCategory() != null ? b.getCategory().getName() : "General";
            BigDecimal spent = categorySums.getOrDefault(catName, BigDecimal.ZERO);
            BigDecimal limit = b.getLimitAmount();
            double pct = limit.compareTo(BigDecimal.ZERO) > 0
                    ? (spent.doubleValue() / limit.doubleValue()) * 100.0
                    : 0.0;

            if (pct <= 100.0) {
                withinBudgetCount++;
            }

            budgetStatuses.add(new MonthlyReportDto.BudgetReportDto(
                    catName,
                    limit,
                    spent,
                    Math.round(pct * 10.0) / 10.0
            ));
        }

        int budgetHealthScore = budgets.isEmpty() ? 100 : (int) Math.round(((double) withinBudgetCount / budgets.size()) * 100);

        // Top 5 Expenses
        List<ExpenseDto> topExpenses = expenses.stream()
                .sorted(Comparator.comparing(Expense::getAmount).reversed())
                .limit(5)
                .map(ExpenseMapper::toDto)
                .collect(Collectors.toList());

        String currency = user.getCurrency() != null ? user.getCurrency() : "INR";
        String monthTitle = Month.of(month).getDisplayName(TextStyle.FULL, Locale.ENGLISH) + " " + year;

        // Executive Insights
        List<String> insights = new ArrayList<>();
        if (!categoryBreakdown.isEmpty()) {
            MonthlyReportDto.CategoryReportDto topCat = categoryBreakdown.get(0);
            insights.add(String.format("💡 Primary Driver: <strong>%s</strong> accounted for <strong>%.1f%%</strong> (%s %s) of total monthly outflow.",
                    topCat.getCategoryName(), topCat.getPercentage(), currency, topCat.getTotalAmount()));
        }
        insights.add(String.format("📈 Spending Velocity: You averaged <strong>%s %s / day</strong> across %d days.",
                currency, dailyAverage, daysInMonth));
        if (recurringTotal.compareTo(BigDecimal.ZERO) > 0) {
            insights.add(String.format("🔄 Fixed Commitments: <strong>%s %s</strong> was allocated to recurring subscriptions & bills.",
                    currency, recurringTotal));
        }
        if (!budgets.isEmpty()) {
            insights.add(String.format("🎯 Budget Health: <strong>%d of %d</strong> budget categories stayed strictly within target (%d%% health score).",
                    withinBudgetCount, budgets.size(), budgetHealthScore));
        }
        if (highestExpense != null) {
            insights.add(String.format("🏷️ Peak Outflow: Single largest transaction was <strong>%s %s</strong> on %s%s.",
                    currency, highestExpenseAmount,
                    highestExpense.getExpenseDate() != null ? highestExpense.getExpenseDate().toString() : "N/A",
                    highestExpenseDescription != null && !highestExpenseDescription.isBlank() ? " ('" + highestExpenseDescription + "')" : ""));
        }
        if (insights.isEmpty()) {
            insights.add("✨ No recorded expenses for this period. Your budget remained completely untouched.");
        }

        MonthlyReportDto dto = new MonthlyReportDto();
        dto.setPeriod(monthTitle);
        dto.setYear(year);
        dto.setMonth(month);
        dto.setTotalOutflow(totalOutflow);
        dto.setCurrency(currency);
        dto.setTransactionCount(expenses.size());
        dto.setDailyAverage(dailyAverage);
        dto.setHighestExpenseAmount(highestExpenseAmount);
        dto.setHighestExpenseDescription(highestExpenseDescription);
        dto.setRecurringTotal(recurringTotal);
        dto.setBudgetHealthScore(budgetHealthScore);
        dto.setInsights(insights);
        dto.setCategoryBreakdown(categoryBreakdown);
        dto.setBudgetStatuses(budgetStatuses);
        dto.setTopExpenses(topExpenses);

        return dto;
    }

    @Override
    @Transactional
    public void sendMonthlyReportEmail(Long userId, int year, int month) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        if (!mailEnabled || configuredMailHost == null || configuredMailHost.isBlank()) {
            log.info("Email service disabled or SMTP host not configured. Skipping monthly report email for {}.", user.getEmail());
            saveReportLog(user, year, month, true, "Email sending disabled - report logged");
            return;
        }

        boolean alreadySent = reportLogRepository.existsByUserAndReportYearAndReportMonthAndSentSuccessfullyTrue(user, year, month);
        if (alreadySent) {
            log.info("Monthly report for {}/{} already sent to {}. Skipping.", month, year, user.getEmail());
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("JavaMailSender bean unavailable. Skipping monthly report email for {}.", user.getEmail());
            saveReportLog(user, year, month, false, "JavaMailSender bean unavailable");
            return;
        }

        try {
            MonthlyReportDto report = generateMonthlyReport(userId, year, month);
            String htmlContent = buildMonthlyReportHtml(user.getName(), report);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(user.getEmail());
            helper.setSubject("📊 Executive Monthly Financial Report — " + report.getPeriod());
            helper.setText(htmlContent, true);

            mailSender.send(message);
            saveReportLog(user, year, month, true, null);
            log.info("Executive monthly report email successfully sent to {} for {}.", user.getEmail(), report.getPeriod());
        } catch (Exception e) {
            log.error("Failed to send monthly report email to {} for {}/{}", user.getEmail(), month, year, e);
            saveReportLog(user, year, month, false, e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public String generateMonthlyReportHtml(Long userId, int year, int month) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        MonthlyReportDto report = generateMonthlyReport(userId, year, month);
        return buildMonthlyReportHtml(user.getName(), report);
    }

    private void saveReportLog(User user, int year, int month, boolean success, String errorMsg) {
        Optional<MonthlyReportLog> existing = reportLogRepository.findByUserAndReportYearAndReportMonth(user, year, month);
        MonthlyReportLog logEntry = existing.orElseGet(MonthlyReportLog::new);
        logEntry.setUser(user);
        logEntry.setReportYear(year);
        logEntry.setReportMonth(month);
        logEntry.setSentAt(LocalDateTime.now());
        logEntry.setSentSuccessfully(success);
        logEntry.setErrorMessage(errorMsg);
        reportLogRepository.save(logEntry);
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(cron = "0 0 * * * ?")
    @Transactional
    @Override
    public void sendAutomatedMonthlyReports() {
        log.info("Checking database for unsent monthly financial reports...");
        LocalDate lastMonth = LocalDate.now().minusMonths(1);
        int year = lastMonth.getYear();
        int month = lastMonth.getMonthValue();

        int sentCount = 0;
        try {
            List<User> users = userRepository.findAll();
            for (User u : users) {
                try {
                    boolean alreadySent = reportLogRepository.existsByUserAndReportYearAndReportMonthAndSentSuccessfullyTrue(u, year, month);
                    if (!alreadySent) {
                        sendMonthlyReportEmail(u.getId(), year, month);
                        sentCount++;
                    }
                } catch (Exception e) {
                    log.error("Error processing automated monthly report catch-up for user {}", u.getId(), e);
                }
            }
        } catch (Exception e) {
            log.warn("Could not query users for automated monthly reports: {}", e.getMessage());
        }
        log.info("Automated monthly report check complete. Dispatched {} pending reports for {}/{}.", sentCount, month, year);
    }

    private String buildMonthlyReportHtml(String userName, MonthlyReportDto report) {
        StringBuilder categoryRows = new StringBuilder();
        for (MonthlyReportDto.CategoryReportDto c : report.getCategoryBreakdown()) {
            categoryRows.append("""
                <tr>
                    <td style="padding: 12px 14px; border-bottom: 1px solid rgba(236,231,216,0.08); font-weight: 600; color: #ece7d8;">%s</td>
                    <td style="padding: 12px 14px; border-bottom: 1px solid rgba(236,231,216,0.08); text-align: right; font-weight: 700; color: #c79a3e;">%s %s</td>
                    <td style="padding: 12px 14px; border-bottom: 1px solid rgba(236,231,216,0.08); text-align: right;">
                        <span style="display: inline-block; background: rgba(199, 154, 62, 0.12); color: #c79a3e; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 12px;">%.1f%%</span>
                    </td>
                </tr>
                """.formatted(c.getCategoryName(), report.getCurrency(), c.getTotalAmount(), c.getPercentage()));
        }

        StringBuilder budgetCards = new StringBuilder();
        for (MonthlyReportDto.BudgetReportDto b : report.getBudgetStatuses()) {
            String badgeColor = b.getUsagePercentage() > 100 ? "#ef4444" : (b.getUsagePercentage() > 80 ? "#f59e0b" : "#10b981");
            String badgeText = b.getUsagePercentage() > 100 ? "Exceeded" : (b.getUsagePercentage() > 80 ? "Near Limit" : "On Track");
            double barWidth = Math.min(b.getUsagePercentage(), 100.0);
            budgetCards.append("""
                <div style="background: #10120e; border: 1px solid rgba(236,231,216,0.1); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 14px; font-weight: 700; color: #ece7d8;">%s</span>
                        <span style="font-size: 12px; font-weight: 700; color: %s; background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 6px;">%s (%.1f%%)</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.08); height: 6px; border-radius: 999px; overflow: hidden; margin-bottom: 8px;">
                        <div style="background: %s; width: %.1f%%; height: 100%%; border-radius: 999px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #a8a395;">
                        <span>Spent: <strong>%s %s</strong></span>
                        <span>Limit: <strong>%s %s</strong></span>
                    </div>
                </div>
                """.formatted(b.getCategoryName(), badgeColor, badgeText, b.getUsagePercentage(), badgeColor, barWidth, report.getCurrency(), b.getSpentAmount(), report.getCurrency(), b.getLimitAmount()));
        }

        StringBuilder insightItems = new StringBuilder();
        if (report.getInsights() != null) {
            for (String insight : report.getInsights()) {
                insightItems.append("""
                    <div style="padding: 10px 14px; background: rgba(199, 154, 62, 0.06); border-left: 3px solid #c79a3e; border-radius: 0 8px 8px 0; margin-bottom: 8px; font-size: 13px; color: #ece7d8; line-height: 1.5;">
                        %s
                    </div>
                    """.formatted(insight));
            }
        }

        StringBuilder topExpenseRows = new StringBuilder();
        if (report.getTopExpenses() != null && !report.getTopExpenses().isEmpty()) {
            for (ExpenseDto exp : report.getTopExpenses()) {
                topExpenseRows.append("""
                    <tr>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06); font-size: 13px; color: #a8a395;">%s</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06); font-size: 13px; font-weight: 600; color: #ece7d8;">%s</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06); font-size: 12px; color: #c79a3e;">%s</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06); text-align: right; font-weight: 700; color: #ece7d8;">%s %s</td>
                    </tr>
                    """.formatted(
                        exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "—",
                        exp.getDescription() != null && !exp.getDescription().isBlank() ? exp.getDescription() : "General Expense",
                        exp.getCategoryName() != null ? exp.getCategoryName() : "General",
                        report.getCurrency(),
                        exp.getAmount()
                    ));
            }
        }

        return """
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { margin: 0; padding: 0; background-color: #080a07; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ece7d8; }
              .email-container { max-width: 640px; margin: 30px auto; background: #131711; border: 1px solid rgba(236, 231, 216, 0.12); border-radius: 20px; overflow: hidden; box-shadow: 0 24px 48px rgba(0,0,0,0.6); }
              .email-header { padding: 36px 32px; text-align: center; border-bottom: 1px solid rgba(236, 231, 216, 0.08); background: linear-gradient(180deg, rgba(199, 154, 62, 0.15) 0%%, rgba(19, 23, 17, 0) 100%%); }
              .brand-badge { display: inline-block; background: rgba(199, 154, 62, 0.15); border: 1px solid rgba(199, 154, 62, 0.3); border-radius: 999px; padding: 6px 18px; font-size: 13px; font-weight: 800; color: #c79a3e; letter-spacing: 0.5px; }
              .stat-grid { display: table; width: 100%%; margin-bottom: 24px; }
              .stat-cell { display: table-cell; width: 50%%; padding: 6px; }
              .stat-box { background: #0b0d09; border: 1px solid rgba(236, 231, 216, 0.08); border-radius: 14px; padding: 18px 14px; text-align: center; }
              .hero-card { background: #0b0d09; border: 1px solid #c79a3e; border-radius: 16px; padding: 26px; text-align: center; margin-bottom: 24px; }
              .hero-val { font-size: 38px; font-weight: 900; color: #c79a3e; margin-top: 4px; letter-spacing: -0.5px; }
              .section-title { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #c79a3e; margin: 28px 0 12px; }
              .email-body { padding: 32px; }
              .email-footer { padding: 24px 32px; border-top: 1px solid rgba(236, 231, 216, 0.08); background: #0b0d09; text-align: center; font-size: 12px; color: #6b6558; line-height: 1.6; }
            </style>
            </head>
            <body>
              <div class="email-container">
                <div class="email-header">
                  <div class="brand-badge">📊 Executive Financial Summary</div>
                  <h2 style="margin: 14px 0 0; color: #ece7d8; font-size: 24px;">%s</h2>
                </div>
                <div class="email-body">
                  <div style="font-size: 18px; font-weight: 700; margin-bottom: 18px;">Hello %s,</div>
                  
                  <!-- Hero Outflow -->
                  <div class="hero-card">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #a8a395;">Total Outflow</div>
                    <div class="hero-val">%s %s</div>
                    <div style="font-size: 13px; color: #a8a395; margin-top: 6px;">Across %d transactions</div>
                  </div>

                  <!-- 4-Stat Metric Grid -->
                  <div class="stat-grid">
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="font-size: 11px; text-transform: uppercase; color: #a8a395;">Daily Average</div>
                        <div style="font-size: 18px; font-weight: 800; color: #ece7d8; margin-top: 4px;">%s %s</div>
                      </div>
                    </div>
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="font-size: 11px; text-transform: uppercase; color: #a8a395;">Budget Score</div>
                        <div style="font-size: 18px; font-weight: 800; color: #10b981; margin-top: 4px;">%d%%</div>
                      </div>
                    </div>
                  </div>

                  <div class="stat-grid">
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="font-size: 11px; text-transform: uppercase; color: #a8a395;">Peak Expense</div>
                        <div style="font-size: 18px; font-weight: 800; color: #ece7d8; margin-top: 4px;">%s %s</div>
                      </div>
                    </div>
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="font-size: 11px; text-transform: uppercase; color: #a8a395;">Recurring Outflow</div>
                        <div style="font-size: 18px; font-weight: 800; color: #ece7d8; margin-top: 4px;">%s %s</div>
                      </div>
                    </div>
                  </div>

                  <!-- Key Insights -->
                  <div class="section-title">🧠 Key Financial Insights</div>
                  <div style="margin-bottom: 24px;">
                    %s
                  </div>

                  <!-- Top Spending Categories -->
                  <div class="section-title">🏷️ Spending by Category</div>
                  <table style="width: 100%%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
                    <thead>
                      <tr style="color: #a8a395; text-align: left; border-bottom: 1px solid rgba(236,231,216,0.15); font-size: 12px; text-transform: uppercase;">
                        <th style="padding: 8px 14px;">Category</th>
                        <th style="padding: 8px 14px; text-align: right;">Total Spent</th>
                        <th style="padding: 8px 14px; text-align: right;">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      %s
                    </tbody>
                  </table>

                  <!-- Budget Adherence -->
                  <div class="section-title">🎯 Budget Adherence & Limits</div>
                  <div style="margin-bottom: 24px;">
                    %s
                  </div>

                  <!-- Top Transactions -->
                  %s

                </div>
                <div class="email-footer">
                  <strong>ExpenseTracker Pro</strong> · Smart Financial Intelligence<br>
                  Automated Monthly Report Generated for %s
                </div>
              </div>
            </body>
            </html>
            """.formatted(
                report.getPeriod(),
                userName != null ? userName : "User",
                report.getCurrency(),
                report.getTotalOutflow(),
                report.getTransactionCount(),
                report.getCurrency(),
                report.getDailyAverage(),
                report.getBudgetHealthScore(),
                report.getCurrency(),
                report.getHighestExpenseAmount(),
                report.getCurrency(),
                report.getRecurringTotal(),
                insightItems.toString(),
                categoryRows.length() > 0 ? categoryRows.toString() : "<tr><td colspan='3' style='padding: 12px; color: #a8a395;'>No spending recorded this month.</td></tr>",
                budgetCards.length() > 0 ? budgetCards.toString() : "<div style='color: #a8a395; font-size: 13px;'>No category budgets configured for this period.</div>",
                topExpenseRows.length() > 0 ? """
                    <div class="section-title">💳 Largest Transactions</div>
                    <table style="width: 100%%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                      <thead>
                        <tr style="color: #a8a395; text-align: left; border-bottom: 1px solid rgba(236,231,216,0.15); font-size: 11px; text-transform: uppercase;">
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
                report.getPeriod()
            );
    }
}
