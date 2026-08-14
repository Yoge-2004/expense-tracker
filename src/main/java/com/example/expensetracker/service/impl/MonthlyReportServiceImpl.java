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

        for (Budget b : budgets) {
            String catName = b.getCategory() != null ? b.getCategory().getName() : "General";
            BigDecimal spent = categorySums.getOrDefault(catName, BigDecimal.ZERO);
            BigDecimal limit = b.getLimitAmount();
            double pct = limit.compareTo(BigDecimal.ZERO) > 0
                    ? (spent.doubleValue() / limit.doubleValue()) * 100.0
                    : 0.0;

            budgetStatuses.add(new MonthlyReportDto.BudgetReportDto(
                    catName,
                    limit,
                    spent,
                    Math.round(pct * 10.0) / 10.0
            ));
        }

        // Top 5 Expenses
        List<ExpenseDto> topExpenses = expenses.stream()
                .sorted(Comparator.comparing(Expense::getAmount).reversed())
                .limit(5)
                .map(ExpenseMapper::toDto)
                .collect(Collectors.toList());

        String monthTitle = Month.of(month).getDisplayName(TextStyle.FULL, Locale.ENGLISH) + " " + year;

        MonthlyReportDto dto = new MonthlyReportDto();
        dto.setPeriod(monthTitle);
        dto.setYear(year);
        dto.setMonth(month);
        dto.setTotalOutflow(totalOutflow);
        dto.setCurrency(user.getCurrency() != null ? user.getCurrency() : "INR");
        dto.setTransactionCount(expenses.size());
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

        // Database Check: Prevent Duplicate Report Emails
        boolean alreadySent = reportLogRepository.existsByUserAndReportYearAndReportMonthAndSentSuccessfullyTrue(user, year, month);
        if (alreadySent) {
            log.info("Monthly report for {} ({}/{}) was already sent. Skipping duplicate dispatch.",
                    user.getEmail(), month, year);
            return;
        }

        MonthlyReportDto report = generateMonthlyReport(userId, year, month);

        if (configuredMailHost == null || configuredMailHost.isBlank()) {
            log.warn("[DEV ONLY - email not configured] Monthly report generated for {}: Spent {} {}",
                    user.getEmail(), report.getCurrency(), report.getTotalOutflow());
            saveReportLog(user, year, month, true, "Dev mode - simulated dispatch");
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.error("spring.mail.host is configured but JavaMailSender bean is unavailable.");
            saveReportLog(user, year, month, false, "JavaMailSender bean unavailable");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");

            helper.setTo(user.getEmail());
            helper.setSubject("📊 Your " + report.getPeriod() + " Financial Report | ExpenseTracker PRO");

            String html = buildMonthlyReportHtml(user.getName(), report);
            helper.setText(html, true);

            mailSender.send(message);
            saveReportLog(user, year, month, true, null);
            log.info("Sent monthly report email for {} to {}", report.getPeriod(), user.getEmail());
        } catch (Exception e) {
            log.error("Failed to send monthly report email to {}", user.getEmail(), e);
            saveReportLog(user, year, month, false, e.getMessage());
        }
    }

    private void saveReportLog(User user, int year, int month, boolean success, String errorMsg) {
        Optional<MonthlyReportLog> existing = reportLogRepository.findByUserAndReportYearAndReportMonth(user, year, month);
        MonthlyReportLog logEntry = existing.orElseGet(() -> new MonthlyReportLog());
        logEntry.setUser(user);
        logEntry.setReportYear(year);
        logEntry.setReportMonth(month);
        logEntry.setSentAt(LocalDateTime.now());
        logEntry.setSentSuccessfully(success);
        logEntry.setErrorMessage(errorMsg);
        reportLogRepository.save(logEntry);
    }

    /**
     * Automated Dispatch: Runs on application startup (server wake-up from sleep)
     * and on an hourly schedule to catch any missed monthly reports due to server sleep.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(cron = "0 0 * * * ?") // Runs hourly to check for unsent reports
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
                    <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.08);">%s</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.08); text-align: right; font-weight: 600; color: #c79a3e;">%s %s</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.08); text-align: right; color: #a8a395;">%.1f%%</td>
                </tr>
                """.formatted(c.getCategoryName(), report.getCurrency(), c.getTotalAmount(), c.getPercentage()));
        }

        StringBuilder budgetCards = new StringBuilder();
        for (MonthlyReportDto.BudgetReportDto b : report.getBudgetStatuses()) {
            String badgeColor = b.getUsagePercentage() > 100 ? "#ef4444" : (b.getUsagePercentage() > 80 ? "#f59e0b" : "#10b981");
            budgetCards.append("""
                <div style="background: #10120e; border: 1px solid rgba(236,231,216,0.1); border-radius: 12px; padding: 14px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px;">
                        <span>%s</span>
                        <span style="color: %s;">%.1f%% Used</span>
                    </div>
                    <div style="font-size: 12px; color: #a8a395;">Spent %s %s of %s %s limit</div>
                </div>
                """.formatted(b.getCategoryName(), badgeColor, b.getUsagePercentage(), report.getCurrency(), b.getSpentAmount(), report.getCurrency(), b.getLimitAmount()));
        }

        return """
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { margin: 0; padding: 0; background-color: #0d0f0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ece7d8; }
              .email-container { max-width: 600px; margin: 30px auto; background: #171a14; border: 1px solid rgba(236, 231, 216, 0.12); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
              .email-header { padding: 32px; text-align: center; border-bottom: 1px solid rgba(236, 231, 216, 0.08); background: linear-gradient(180deg, rgba(199, 154, 62, 0.12) 0%%, rgba(23, 26, 20, 0) 100%%); }
              .brand-badge { display: inline-block; background: rgba(199, 154, 62, 0.15); border: 1px solid rgba(199, 154, 62, 0.3); border-radius: 999px; padding: 6px 18px; font-size: 13px; font-weight: 800; color: #c79a3e; letter-spacing: 0.5px; }
              .hero-card { background: #10120e; border: 1px solid #c79a3e; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px; }
              .hero-val { font-size: 34px; font-weight: 900; color: #c79a3e; margin-top: 4px; }
              .email-body { padding: 32px; }
              .email-footer { padding: 24px 32px; border-top: 1px solid rgba(236, 231, 216, 0.08); background: #10120e; text-align: center; font-size: 12px; color: #6b6558; }
            </style>
            </head>
            <body>
              <div class="email-container">
                <div class="email-header">
                  <div class="brand-badge">📊 Monthly Financial Report</div>
                  <h2 style="margin: 14px 0 0; color: #ece7d8;">%s</h2>
                </div>
                <div class="email-body">
                  <div style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Hello %s,</div>
                  <div class="hero-card">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #a8a395;">Total Outflow</div>
                    <div class="hero-val">%s %s</div>
                    <div style="font-size: 13px; color: #a8a395; margin-top: 6px;">Across %d total transactions</div>
                  </div>

                  <h3 style="font-size: 16px; color: #c79a3e; margin-bottom: 12px;">Top Spending Categories</h3>
                  <table style="width: 100%%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px;">
                    <thead>
                      <tr style="color: #a8a395; text-align: left; border-bottom: 1px solid rgba(236,231,216,0.15);">
                        <th style="padding: 8px 12px;">Category</th>
                        <th style="padding: 8px 12px; text-align: right;">Amount</th>
                        <th style="padding: 8px 12px; text-align: right;">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      %s
                    </tbody>
                  </table>

                  <h3 style="font-size: 16px; color: #c79a3e; margin-bottom: 12px;">Budget Adherence</h3>
                  %s
                </div>
                <div class="email-footer">
                  ExpenseTracker Pro · Smart Financial Intelligence<br>
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
                categoryRows.length() > 0 ? categoryRows.toString() : "<tr><td colspan='3' style='padding: 10px; color: #a8a395;'>No spending recorded this month.</td></tr>",
                budgetCards.length() > 0 ? budgetCards.toString() : "<div style='color: #a8a395; font-size: 13px;'>No category budgets configured for this period.</div>",
                report.getPeriod()
            );
    }
}
