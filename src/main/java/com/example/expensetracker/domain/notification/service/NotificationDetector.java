package com.example.expensetracker.domain.notification.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.notification.model.NotificationType;
import com.example.expensetracker.domain.user.model.User;

/**
 * Looks at one user's data and returns the notifications that are due. It only reads (inside a read-only
 * transaction, so lazy relations load) and never sends anything; delivery happens afterwards, outside
 * the transaction.
 * <p>
 * Follows Open-Closed Principle (OCP) and Strategy Pattern: daily detection rules are encapsulated in
 * composable {@link NotificationRule} implementations.
 * </p>
 *
 * @author Yogeshwaran
 */
@Service
@Transactional(readOnly = true)
public class NotificationDetector {

    private final ExpenseRepository expenseRepository;
    private final List<NotificationRule> rules;

    /**
     * Constructs the detector wired to all Spring-registered {@link NotificationRule} strategies.
     *
     * @param expenseRepository repository used for weekly digest aggregation
     * @param rules             ordered notification rule strategies injected by Spring
     */
    @Autowired
    public NotificationDetector(ExpenseRepository expenseRepository,
                                List<NotificationRule> rules) {
        this.expenseRepository = expenseRepository;
        this.rules = rules == null ? List.of() : List.copyOf(rules);
    }

    /**
     * Convenience constructor assembling the default rule set when invoked directly outside Spring.
     *
     * @param budgetRepository           budget repository
     * @param expenseRepository          expense repository
     * @param recurringExpenseRepository recurring expense repository
     * @param savingsGoalRepository      savings goal repository
     */
    public NotificationDetector(BudgetRepository budgetRepository,
                                ExpenseRepository expenseRepository,
                                RecurringExpenseRepository recurringExpenseRepository,
                                SavingsGoalRepository savingsGoalRepository) {
        this(expenseRepository, List.of(
                new BudgetNotificationRule(budgetRepository, expenseRepository),
                new UpcomingBillsNotificationRule(recurringExpenseRepository),
                new GoalMilestonesNotificationRule(savingsGoalRepository),
                new LargeExpenseNotificationRule(expenseRepository)
        ));
    }

    /** Budgets, upcoming bills, savings goals and unusually large expenses from yesterday. */
    public List<PendingNotification> detectDaily(User user, LocalDate today) {
        List<PendingNotification> result = new ArrayList<>();
        for (NotificationRule rule : rules) {
            result.addAll(rule.detect(user, today));
        }
        return result;
    }

    /** A summary of the week that contains {@code today} (run on Sunday evening). */
    public List<PendingNotification> detectWeeklyDigest(User user, LocalDate today) {
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate weekEnd = weekStart.plusDays(6);
        List<Expense> thisWeek = expenseRepository.findByUserAndExpenseDateBetween(user, weekStart, weekEnd);
        if (thisWeek.isEmpty()) {
            return List.of();
        }
        List<Expense> lastWeek = expenseRepository.findByUserAndExpenseDateBetween(
                user, weekStart.minusDays(7), weekStart.minusDays(1));

        BigDecimal spent = total(thisWeek);
        BigDecimal before = total(lastWeek);
        String currency = user.getCurrency();

        StringBuilder body = new StringBuilder("Spent ")
                .append(NotificationRules.money(currency, spent))
                .append(" across ").append(thisWeek.size())
                .append(thisWeek.size() == 1 ? " expense" : " expenses");
        if (before.signum() > 0) {
            long change = spent.subtract(before).multiply(BigDecimal.valueOf(100))
                    .divide(before, 0, RoundingMode.HALF_UP).longValue();
            body.append(change == 0 ? " (same as last week)"
                    : " (" + (change > 0 ? "up " : "down ") + Math.abs(change) + "% vs last week)");
        }
        topCategory(thisWeek).ifPresent(name -> body.append(". Top category: ").append(name));
        body.append('.');

        return List.of(new PendingNotification(NotificationType.WEEKLY_DIGEST, "Your week in money",
                body.toString(), "dashboard", "digest:" + weekStart));
    }

    /** The period a budget applies to right now, or null when it cannot be worked out. */
    public static LocalDate[] budgetWindow(Budget budget, LocalDate today) {
        return BudgetNotificationRule.budgetWindow(budget, today);
    }

    // ------------------------------------------------------------------ helpers

    private static BigDecimal total(List<Expense> expenses) {
        return expenses.stream().map(Expense::getAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static Optional<String> topCategory(List<Expense> expenses) {
        Map<String, BigDecimal> byCategory = new HashMap<>();
        for (Expense e : expenses) {
            if (e.getCategory() != null && e.getAmount() != null) {
                byCategory.merge(e.getCategory().getName(), e.getAmount(), BigDecimal::add);
            }
        }
        return byCategory.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey);
    }
}
