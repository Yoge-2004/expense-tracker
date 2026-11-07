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
import com.example.expensetracker.service.report.MonthlyHtmlReportGenerator;
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
    private final MonthlyHtmlReportGenerator monthlyHtmlReportGenerator;

    @Value("${spring.mail.host:}")
    private String configuredMailHost;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    private void validatePeriod(Long userId, int year, int month) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("Month must be between 1 and 12 (got " + month + ")");
        }
        if (year < 1900 || year > 2100) {
            throw new IllegalArgumentException("Year must be between 1900 and 2100 (got " + year + ")");
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public MonthlyReportDto generateMonthlyReport(Long userId, int year, int month) {
        validatePeriod(userId, year, month);
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
                            (_, sum) -> sum.subtract(r.getAmount()).max(BigDecimal.ZERO)));
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
        } else if (netCashFlow.compareTo(BigDecimal.ZERO) < 0) {
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
        validatePeriod(userId, year, month);

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
            String htmlContent = monthlyHtmlReportGenerator.buildMonthlyReportHtml(user.getName(), report, user.getId());

            JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
            if (mailSender == null) {
                saveReportLog(user, year, month, false, "JavaMailSender not available");
                throw new EmailDeliveryException("Email delivery service is currently unavailable.");
            }

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(user.getEmail());
            helper.setSubject(String.format("Your Monthly Financial Intelligence Report — %s", report.period()));
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
        validatePeriod(userId, year, month);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        MonthlyReportDto report = generateMonthlyReport(userId, year, month);
        return monthlyHtmlReportGenerator.buildMonthlyReportHtml(user.getName(), report, user.getId());
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
}
