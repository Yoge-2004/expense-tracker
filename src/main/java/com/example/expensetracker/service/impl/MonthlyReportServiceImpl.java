package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.exception.EmailDeliveryException;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.mapper.IncomeMapper;
import com.example.expensetracker.mapper.IncomeRules;
import com.example.expensetracker.mapper.SavingsGoalMapper;
import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.IncomeKind;
import com.example.expensetracker.model.MonthlyReportLog;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.MonthlyReportLogRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.MonthlyReportService;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Month;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.*;

/**
 * Production implementation of {@link MonthlyReportService}.
 *
 * <p>Aggregates financial transactions (expenses and incomes), savings goals, and budget adherence
 * to construct an executive financial intelligence report. Renders responsive HTML email summaries
 * and supports automated monthly dispatches and standalone HTML report downloads.</p>
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@SuppressWarnings("java:S6809")
public class MonthlyReportServiceImpl implements MonthlyReportService {

    private final UserRepository userRepository;
    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final BudgetRepository budgetRepository;
    private final MonthlyReportLogRepository reportLogRepository;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${spring.mail.host:}")
    private String configuredMailHost;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public MonthlyReportDto generateMonthlyReport(Long userId, int year, int month) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("Month must be between 1 and 12 (got " + month + ")");
        }
        if (year < 1900 || year > 2100) {
            throw new IllegalArgumentException("Year must be between 1900 and 2100 (got " + year + ")");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = startDate.withDayOfMonth(startDate.lengthOfMonth());

        List<Expense> expenses = expenseRepository.findByUserAndExpenseDateBetween(user, startDate, endDate);
        // An income belongs to the month it COUNTS TOWARD, which can differ from the day it was
        // credited (next month's salary paid on the 30th). Read a window around the month and keep
        // the ones whose effective month is this one.
        YearMonth reportMonth = YearMonth.of(year, month);
        List<Income> incomes = incomeRepository.findByUserAndIncomeDateBetween(user,
                        startDate.minusMonths(IncomeRules.MAX_MONTH_SHIFT), endDate.plusMonths(IncomeRules.MAX_MONTH_SHIFT))
                .stream()
                .filter(i -> reportMonth.equals(IncomeRules.effectiveMonth(i)))
                .toList();
        List<SavingsGoal> savingsGoals = savingsGoalRepository.findByUser(user);

        // Reimbursements are not income: money handed back reduces what was spent.
        List<Income> reimbursements = incomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) == IncomeKind.REIMBURSEMENT)
                .toList();
        List<Income> earned = incomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) != IncomeKind.REIMBURSEMENT)
                .toList();

        BigDecimal grossOutflow = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalReimbursed = reimbursements.stream()
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Spending net of money that came back; never below zero (a refund larger than the
        // month's spending is not negative spending).
        BigDecimal totalOutflow = grossOutflow.subtract(totalReimbursed).max(BigDecimal.ZERO);

        BigDecimal totalIncome = earned.stream()
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal netCashFlow = totalIncome.subtract(totalOutflow);
        double savingsRate = 0.0;
        if (totalIncome.compareTo(BigDecimal.ZERO) > 0) {
            savingsRate = netCashFlow.divide(totalIncome, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .doubleValue();
            savingsRate = Math.round(savingsRate * 10.0) / 10.0;
        }

        int daysInMonth = startDate.lengthOfMonth();
        BigDecimal dailyAverage = daysInMonth > 0 && totalOutflow.compareTo(BigDecimal.ZERO) > 0
                ? totalOutflow.divide(BigDecimal.valueOf(daysInMonth), 2, RoundingMode.HALF_UP)
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
        // Reimbursements tied to a category reduce that category's spending.
        for (Income r : reimbursements) {
            if (r.getReimbursedCategoryId() == null) {
                continue;
            }
            expenses.stream()
                    .filter(e -> e.getCategory() != null && r.getReimbursedCategoryId().equals(e.getCategory().getId()))
                    .findFirst()
                    .ifPresent(e -> categorySums.computeIfPresent(e.getCategory().getName(),
                            (name, sum) -> sum.subtract(r.getAmount()).max(BigDecimal.ZERO)));
        }
        // Percentages are relative to what the categories add up to, so they always total 100.
        double totalDouble = categorySums.values().stream().mapToDouble(BigDecimal::doubleValue).sum();

        for (Map.Entry<String, BigDecimal> entry : categorySums.entrySet()) {
            double pct = totalDouble > 0 ? (entry.getValue().doubleValue() / totalDouble) * 100.0 : 0.0;
            categoryBreakdown.add(new MonthlyReportDto.CategoryReportDto(
                    entry.getKey(),
                    entry.getValue(),
                    Math.round(pct * 10.0) / 10.0
            ));
        }
        categoryBreakdown.sort((a, b) -> b.totalAmount().compareTo(a.totalAmount()));

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
        budgetStatuses.sort((a, b) -> Double.compare(b.usagePercentage(), a.usagePercentage()));

        int budgetHealthScore = 100;
        if (!budgets.isEmpty()) {
            budgetHealthScore = (int) Math.round(((double) withinBudgetCount / budgets.size()) * 100.0);
        }

        // Top 5 Expenses
        List<ExpenseDto> topExpenses = expenses.stream()
                .sorted(Comparator.comparing(Expense::getAmount).reversed())
                .limit(5)
                .map(ExpenseMapper::toDto)
                .toList();

        // All Incomes mapped
        List<IncomeDto> incomeDtos = incomes.stream()
                .sorted(Comparator.comparing(Income::getIncomeDate).reversed())
                .map(IncomeMapper::toDto)
                .toList();

        // Active Savings Goals mapped
        List<SavingsGoalDto> goalDtos = savingsGoals.stream()
                .map(SavingsGoalMapper::toDto)
                .toList();

        // Insights Generation
        String userCurrency = user.getCurrency() != null ? user.getCurrency() : "INR";
        List<String> insights = new ArrayList<>();
        String monthName = Month.of(month).getDisplayName(TextStyle.FULL, Locale.ENGLISH);

        if (totalIncome.compareTo(BigDecimal.ZERO) > 0 && netCashFlow.compareTo(BigDecimal.ZERO) >= 0) {
            insights.add(String.format("You generated a net positive savings rate of %.1f%% in %s.",
                    savingsRate, monthName));
        } else if (totalIncome.compareTo(BigDecimal.ZERO) > 0) {
            insights.add(String.format("Expenses exceeded income in %s resulting in a deficit of %s.",
                    monthName, netCashFlow.abs()));
        }

        if (!categoryBreakdown.isEmpty()) {
            MonthlyReportDto.CategoryReportDto topCat = categoryBreakdown.getFirst();
            insights.add(String.format("Top spending category was '%s' absorbing %.1f%% of all outflows.",
                    topCat.categoryName(), topCat.percentage()));
        }

        long exceededBudgets = budgetStatuses.stream()
                .filter(MonthlyReportDto.BudgetReportDto::isExceeded)
                .count();
        if (exceededBudgets > 0) {
            insights.add(String.format("%d budget limit%s exceeded during %s.",
                    exceededBudgets, exceededBudgets > 1 ? "s were" : " was", monthName));
        } else if (!budgets.isEmpty()) {
            insights.add("Exceptional budget discipline! All categories remained safely within established limits.");
        }

        long completedGoals = savingsGoals.stream()
                .filter(g -> "COMPLETED".equalsIgnoreCase(g.getStatus())
                        || (g.getTargetAmount() != null && g.getCurrentAmount() != null
                            && g.getCurrentAmount().compareTo(g.getTargetAmount()) >= 0))
                .count();
        if (completedGoals > 0) {
            insights.add(String.format("Congratulations! You have %d completed savings milestone%s.",
                    completedGoals, completedGoals > 1 ? "s" : ""));
        }

        // Salary Coverage Insight
        BigDecimal salaryTotal = earned.stream()
                .filter(i -> IncomeRules.effectiveKind(i) == IncomeKind.SALARY
                        || (i.getDescription() != null && i.getDescription().toLowerCase().contains("salary")))
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (salaryTotal.compareTo(BigDecimal.ZERO) > 0 && totalOutflow.compareTo(BigDecimal.ZERO) > 0) {
            double coverage = salaryTotal.divide(totalOutflow, 4, RoundingMode.HALF_UP).doubleValue() * 100.0;
            insights.add(String.format("Salary Coverage: Active monthly salary covered %.1f%%%% of your total expenditures.", coverage));
        }

        if (totalReimbursed.compareTo(BigDecimal.ZERO) > 0) {
            insights.add(String.format("Reimbursements: %s %s came back this month, so net spending is %s %s instead of %s %s.",
                    userCurrency, totalReimbursed, userCurrency, totalOutflow, userCurrency, grossOutflow));
        }

        // Emergency Savings Runway Insight
        BigDecimal totalSaved = savingsGoals.stream()
                .map(g -> g.getCurrentAmount() != null ? g.getCurrentAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalOutflow.compareTo(BigDecimal.ZERO) > 0 && totalSaved.compareTo(BigDecimal.ZERO) > 0) {
            double runwayMonths = totalSaved.divide(totalOutflow, 1, RoundingMode.HALF_UP).doubleValue();
            insights.add(String.format("Emergency Runway: Accumulated savings reserve (%s %s) provides ~%.1f months of runway at your current monthly burn rate.",
                    userCurrency, totalSaved, runwayMonths));
        }

        // Discretionary vs Essentials
        BigDecimal essentials = expenses.stream()
                .filter(e -> {
                    String c = e.getCategory() != null ? e.getCategory().getName().toLowerCase() : "";
                    return c.contains("rent") || c.contains("grocer") || c.contains("food") || c.contains("util")
                            || c.contains("bill") || c.contains("medic") || c.contains("health") || c.contains("emi")
                            || c.contains("fuel") || c.contains("transport");
                })
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (grossOutflow.compareTo(BigDecimal.ZERO) > 0 && essentials.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal discretionary = grossOutflow.subtract(essentials).max(BigDecimal.ZERO);
            double essPct = essentials.divide(grossOutflow, 3, RoundingMode.HALF_UP).doubleValue() * 100.0;
            double discPct = 100.0 - essPct;
            insights.add(String.format("Capital Allocation: Essentials accounted for %.1f%%%% (%s %s) while discretionary spending represented %.1f%%%% (%s %s).",
                    essPct, userCurrency, essentials, discPct, userCurrency, discretionary));
        }


        String period = monthName + " " + year;

        return new MonthlyReportDto(
                period,
                year,
                month,
                totalOutflow,
                totalIncome,
                netCashFlow,
                savingsRate,
                userCurrency,
                expenses.size(),
                dailyAverage,
                highestExpenseAmount,
                highestExpenseDescription,
                recurringTotal,
                insights,
                budgetHealthScore,
                categoryBreakdown,
                budgetStatuses,
                topExpenses,
                incomeDtos,
                goalDtos,
                totalReimbursed
        );
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void sendMonthlyReportEmail(Long userId, int year, int month) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("Month must be between 1 and 12 (got " + month + ")");
        }
        if (year < 1900 || year > 2100) {
            throw new IllegalArgumentException("Year must be between 1900 and 2100 (got " + year + ")");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        if (!mailEnabled || configuredMailHost == null || configuredMailHost.isBlank()
                || mailSenderProvider.getIfAvailable() == null) {
            log.warn("Email delivery disabled or unconfigured for userId={}", userId);
            saveReportLog(user, year, month, false, "Email delivery disabled or unconfigured");
            throw new EmailDeliveryException("Email delivery is disabled or unconfigured on this server.");
        }

        try {
            MonthlyReportDto report = generateMonthlyReport(userId, year, month);
            String htmlContent = buildMonthlyReportHtml(user.getName(), report);

            JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
            if (mailSender == null) {
                saveReportLog(user, year, month, false, "JavaMailSender not available");
                throw new EmailDeliveryException("Email delivery service is currently unavailable.");
            }

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(user.getEmail());
            helper.setSubject(String.format("📊 Your Monthly Financial Intelligence Report — %s", report.period()));
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);
            log.info("Successfully dispatched monthly report email to {} for period {}",
                    user.getEmail(), report.period());
            saveReportLog(user, year, month, true, null);
        } catch (EmailDeliveryException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to send monthly report email to user {}: {}", user.getEmail(), e.getMessage(), e);
            saveReportLog(user, year, month, false, e.getMessage());
            throw new EmailDeliveryException("Could not send monthly report email: " + e.getMessage(), e);
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public String generateMonthlyReportHtml(Long userId, int year, int month) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        MonthlyReportDto report = generateMonthlyReport(userId, year, month);
        return buildMonthlyReportHtml(user.getName(), report);
    }

    private void saveReportLog(User user, int year, int month, boolean success, String errorMsg) {
        Optional<MonthlyReportLog> existing =
                reportLogRepository.findByUserAndReportYearAndReportMonth(user, year, month);
        MonthlyReportLog logEntry = existing.orElseGet(MonthlyReportLog::new);
        logEntry.setUser(user);
        logEntry.setReportYear(year);
        logEntry.setReportMonth(month);
        logEntry.setSentAt(LocalDateTime.now());
        logEntry.setSentSuccessfully(success);
        logEntry.setErrorMessage(errorMsg);
        reportLogRepository.save(logEntry);
    }

    /**
     * {@inheritDoc}
     */
    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(cron = "0 0 6 1-3 * ?")
    @Transactional
    @Override
    public void sendAutomatedMonthlyReports() {
        if (!mailEnabled || configuredMailHost == null || configuredMailHost.isBlank()
                || mailSenderProvider.getIfAvailable() == null) {
            log.debug("Email service is disabled or unconfigured. Automated monthly reports skipped.");
            return;
        }
        log.info("Checking database for unsent monthly financial reports...");
        LocalDate lastMonth = LocalDate.now().minusMonths(1);
        int year = lastMonth.getYear();
        int month = lastMonth.getMonthValue();

        int sentCount = 0;
        try {
            List<User> users = userRepository.findAll();
            for (User u : users) {
                try {
                    boolean alreadySent = reportLogRepository
                            .existsByUserAndReportYearAndReportMonthAndSentSuccessfullyTrue(u, year, month);
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
        log.info("Automated monthly report check complete. Dispatched {} pending reports for {}/{}.",
                sentCount, month, year);
    }

    private String escapeHtml(String text) {
        return text != null ? HtmlUtils.htmlEscape(text) : "";
    }

    /**
     * Renders responsive HTML financial report including cash flow summary, category breakdown,
     * budget limits, income inflows, and savings goals milestones.
     */
    private String buildMonthlyReportHtml(String userName, MonthlyReportDto report) {
        String rawCurr = report.currency() != null ? report.currency() : "INR";
        String currSymbol = "INR".equalsIgnoreCase(rawCurr) ? "₹"
                : ("USD".equalsIgnoreCase(rawCurr) ? "$"
                : ("EUR".equalsIgnoreCase(rawCurr) ? "€"
                : ("GBP".equalsIgnoreCase(rawCurr) ? "£"
                : ("JPY".equalsIgnoreCase(rawCurr) ? "¥" : rawCurr))));

        // Categories
        StringBuilder categoryRows = new StringBuilder();
        for (MonthlyReportDto.CategoryReportDto c : report.categoryBreakdown()) {
            categoryRows.append("""
                <tr>
                    <td style="padding: 12px 14px; border-bottom: 1px solid rgba(236,231,216,0.08);
                               font-weight: 600; color: #ece7d8;">%s</td>
                    <td style="padding: 12px 14px; border-bottom: 1px solid rgba(236,231,216,0.08);
                               text-align: right; font-weight: 700; color: #c79a3e;">%s %s</td>
                    <td style="padding: 12px 14px; border-bottom: 1px solid rgba(236,231,216,0.08);
                               text-align: right;">
                        <span style="display: inline-block; background: rgba(199, 154, 62, 0.12); color: #c79a3e;
                                     padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 12px;">
                            %.1f%%
                        </span>
                    </td>
                </tr>
                """.formatted(escapeHtml(c.categoryName()), currSymbol, c.totalAmount(), c.percentage()));
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
                <div style="background: #10120e; border: 1px solid rgba(236,231,216,0.1);
                            border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;
                                margin-bottom: 8px;">
                        <span style="font-size: 14px; font-weight: 700; color: #ece7d8;">%s</span>
                        <span style="font-size: 12px; font-weight: 700; color: %s;
                                     background: rgba(255,255,255,0.05); padding: 3px 8px;
                                     border-radius: 6px;">%s (%.1f%%)</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.08); height: 6px;
                                border-radius: 999px; overflow: hidden; margin-bottom: 8px;">
                        <div style="background: %s; width: %.1f%%; height: 100%%; border-radius: 999px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #a8a395;">
                        <span>Spent: <strong>%s %s</strong></span>
                        <span>Limit: <strong>%s %s</strong></span>
                    </div>
                </div>
                """.formatted(escapeHtml(b.categoryName()), badgeColor, badgeText, b.usagePercentage(),
                        badgeColor, barWidth, currSymbol, b.spentAmount(), currSymbol, b.limitAmount()));
        }

        // Savings Goals
        StringBuilder savingsCards = new StringBuilder();
        if (report.savingsGoals() != null && !report.savingsGoals().isEmpty()) {
            for (SavingsGoalDto g : report.savingsGoals()) {
                boolean completed = "COMPLETED".equalsIgnoreCase(g.status()) || g.progressPercentage() >= 100.0;
                String badgeColor = completed ? "#10b981" : "#3b82f6";
                String badgeText = completed ? "Achieved 🎉" : String.format("%.1f%%", g.progressPercentage());
                double barWidth = Math.min(g.progressPercentage(), 100.0);
                savingsCards.append("""
                    <div style="background: #10120e; border: 1px solid rgba(236,231,216,0.1);
                                border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;
                                    margin-bottom: 8px;">
                            <span style="font-size: 14px; font-weight: 700; color: #ece7d8;">%s</span>
                            <span style="font-size: 12px; font-weight: 700; color: %s;
                                         background: rgba(255,255,255,0.05); padding: 3px 8px;
                                         border-radius: 6px;">%s</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.08); height: 6px;
                                    border-radius: 999px; overflow: hidden; margin-bottom: 8px;">
                            <div style="background: %s; width: %.1f%%; height: 100%%; border-radius: 999px;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #a8a395;">
                            <span>Saved: <strong>%s %s</strong></span>
                            <span>Target: <strong>%s %s</strong>%s</span>
                        </div>
                    </div>
                    """.formatted(
                        escapeHtml(g.name()),
                        badgeColor,
                        badgeText,
                        badgeColor,
                        barWidth,
                        currSymbol,
                        g.currentAmount(),
                        currSymbol,
                        g.targetAmount(),
                        g.targetDate() != null ? " · Due " + g.targetDate() : ""
                    ));
            }
        }

        // Incomes Rows
        StringBuilder incomeRows = new StringBuilder();
        if (report.incomes() != null && !report.incomes().isEmpty()) {
            for (IncomeDto inc : report.incomes()) {
                incomeRows.append("""
                    <tr>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 13px; color: #a8a395;">%s</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 13px; font-weight: 600; color: #ece7d8;">%s</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 12px; color: #10b981;">%s</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   text-align: right; font-weight: 700; color: #10b981;">+ %s %s</td>
                    </tr>
                    """.formatted(
                        inc.incomeDate() != null ? inc.incomeDate().toString() : "—",
                        escapeHtml(inc.description() != null && !inc.description().isBlank()
                            ? inc.description() : "Income Inflow"),
                        escapeHtml(inc.source() != null ? inc.source() : "General"),
                        currSymbol,
                        inc.amount()
                    ));
            }
        }

        // Executive Insights
        StringBuilder insightItems = new StringBuilder();
        if (report.insights() != null) {
            for (String insight : report.insights()) {
                insightItems.append("""
                    <div style="padding: 10px 14px; background: rgba(199, 154, 62, 0.06);
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
                    <tr>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 13px; color: #a8a395;">%s</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 13px; font-weight: 600; color: #ece7d8;">%s</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   font-size: 12px; color: #c79a3e;">%s</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(236,231,216,0.06);
                                   text-align: right; font-weight: 700; color: #ef4444;">- %s %s</td>
                    </tr>
                    """.formatted(
                        exp.expenseDate() != null ? exp.expenseDate().toString() : "—",
                        escapeHtml(exp.description() != null && !exp.description().isBlank()
                            ? exp.description() : "General Expense"),
                        escapeHtml(exp.categoryName() != null ? exp.categoryName() : "General"),
                        currSymbol,
                        exp.amount()
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
              .stat-grid { display: table; width: 100%%; margin-bottom: 24px; }\
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
              * {
                  scrollbar-width: thin !important;
                  scrollbar-color: rgba(199, 154, 62, 0.45) rgba(11, 13, 9, 0.9) !important;
              }
            </style>
            </head>
            <body>
              <div class="email-container">
                <div class="email-header">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 14px;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, rgba(199, 154, 62, 0.25) 0%%, rgba(19, 23, 17, 0.9) 100%%); border: 1.5px solid #c79a3e; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(199, 154, 62, 0.25);">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#c79a3e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 17L12 22L22 17" stroke="#c79a3e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 12L12 17L22 12" stroke="#c79a3e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <div style="text-align: left;">
                      <div style="font-size: 19px; font-weight: 900; letter-spacing: -0.3px; color: #ece7d8;">ExpenseTracker<span style="color: #c79a3e;"> Pro</span></div>
                      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.8px; color: #a8a395; text-transform: uppercase;">Financial Intelligence Suite</div>
                    </div>
                  </div>
                  <div class="brand-badge"><span style="color:#c79a3e; margin-right:4px;">✦</span> OBSIDIAN &amp; LUXURY GOLD EXECUTIVE STATEMENT</div>
                  <h2 style="margin: 14px 0 0; color: #ece7d8; font-size: 24px;">%s</h2>
                </div>
                <div class="email-body">
                  <div style="font-size: 18px; font-weight: 700; margin-bottom: 18px;">Hello %s,</div>

                  <!-- Hero Outflow -->
                  <div class="hero-card">
                    <div style="font-size: 11px; text-transform: uppercase;
                         letter-spacing: 1.5px; color: #a8a395;">Total Outflow (Expenses)</div>
                    <div class="hero-val">%s %s</div>
                    <div style="font-size: 13px; color: #a8a395; margin-top: 6px;">Across %d transactions</div>
                  </div>

                  <!-- Cash Flow & Inflow Metric Grid -->
                  <div class="stat-grid">
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="font-size: 11px; text-transform: uppercase;
                             color: #a8a395;">Total Income Inflow</div>
                        <div style="font-size: 18px; font-weight: 800; color: #10b981; margin-top: 4px;">%s %s</div>
                      </div>
                    </div>
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="font-size: 11px; text-transform: uppercase;
                             color: #a8a395;">Net Savings (%s%%)</div>
                        <div style="font-size: 18px; font-weight: 800; color: #ece7d8; margin-top: 4px;">%s %s</div>
                      </div>
                    </div>
                  </div>

                  <div class="stat-grid">
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="font-size: 11px; text-transform: uppercase;
                             color: #a8a395;">Daily Expense Average</div>
                        <div style="font-size: 18px; font-weight: 800; color: #ece7d8; margin-top: 4px;">%s %s</div>
                      </div>
                    </div>
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="font-size: 11px; text-transform: uppercase;
                             color: #a8a395;">Budget Health Score</div>
                        <div style="font-size: 18px; font-weight: 800; color: #10b981; margin-top: 4px;">%d%%</div>
                      </div>
                    </div>
                  </div>

                  <div class="stat-grid">
                    <div class="stat-cell">
                      <div class="stat-box">
                        <div style="font-size: 11px; text-transform: uppercase;
                             color: #a8a395;">Peak Single Expense</div>
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

                  <!-- Monthly Income Sources -->
                  <div class="section-title">💵 Monthly Income Sources</div>
                  <table style="width: 100%%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
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

                  <!-- Active Savings Goals -->
                  <div class="section-title">🎯 Active Savings Goals & Milestones</div>
                  <div style="margin-bottom: 24px;">
                    %s
                  </div>

                  <!-- Top Spending Categories -->
                  <div class="section-title">🏷️ Spending by Category</div>
                  <table style="width: 100%%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
                    <thead>
                      <tr style="color: #a8a395; text-align: left;
                          border-bottom: 1px solid rgba(236,231,216,0.15);
                          font-size: 12px; text-transform: uppercase;">
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
                  <div class="section-title">🛡️ Budget Adherence & Limits</div>
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
                report.period(),
                userName != null ? userName : "User",
                currSymbol,
                report.totalOutflow(),
                report.transactionCount(),
                currSymbol,
                report.totalIncome(),
                report.savingsRate(),
                currSymbol,
                report.netCashFlow(),
                currSymbol,
                report.dailyAverage(),
                report.budgetHealthScore(),
                currSymbol,
                report.highestExpenseAmount(),
                currSymbol,
                report.recurringTotal(),
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
                    <div class="section-title">💳 Largest Outflow Transactions</div>
                    <table style="width: 100%%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
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
                report.period()
            );
    }
}
