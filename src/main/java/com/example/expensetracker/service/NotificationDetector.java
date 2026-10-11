package com.example.expensetracker.service;

import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Looks at one user's data and returns the notifications that are due. It only reads (inside a read-only
 * transaction, so lazy relations load) and never sends anything; delivery happens afterwards, outside
 * the transaction.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationDetector {

    private static final int[] DUE_REMINDER_DAYS = {3, 1, 0};
    private static final int LARGE_EXPENSE_HISTORY_DAYS = 90;

    private final BudgetRepository budgetRepository;
    private final ExpenseRepository expenseRepository;
    private final RecurringExpenseRepository recurringExpenseRepository;
    private final SavingsGoalRepository savingsGoalRepository;

    /** Budgets, upcoming bills, savings goals and unusually large expenses from yesterday. */
    public List<PendingNotification> detectDaily(User user, LocalDate today) {
        List<PendingNotification> result = new ArrayList<>();
        result.addAll(budgetAlerts(user, today));
        result.addAll(upcomingBills(user, today));
        result.addAll(goalMilestones(user));
        result.addAll(largeExpenses(user, today));
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

    // ------------------------------------------------------------------ budgets

    private List<PendingNotification> budgetAlerts(User user, LocalDate today) {
        List<PendingNotification> result = new ArrayList<>();
        for (Budget budget : budgetRepository.findByUser(user)) {
            LocalDate[] window = budgetWindow(budget, today);
            if (window == null) {
                continue;
            }
            List<Expense> inWindow = expenseRepository.findByUserAndExpenseDateBetween(user, window[0], window[1]);
            Long categoryId = budget.getCategory() != null ? budget.getCategory().getId() : null;
            BigDecimal spent = inWindow.stream()
                    .filter(e -> categoryId == null
                            || (e.getCategory() != null && categoryId.equals(e.getCategory().getId())))
                    .map(Expense::getAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            int level = NotificationRules.budgetLevel(spent, budget.getLimitAmount());
            if (level == 0) {
                continue;
            }
            String label = budget.getCategory() != null ? budget.getCategory().getName() : "Overall";
            String limit = NotificationRules.money(user.getCurrency(), budget.getLimitAmount());
            String used = NotificationRules.money(user.getCurrency(), spent);
            String key = "budget:" + budget.getId() + ":" + window[0] + ":" + level;
            if (level == 100) {
                result.add(new PendingNotification(NotificationType.BUDGET_EXCEEDED,
                        "Budget limit reached: " + label,
                        "You have spent " + used + " against your " + limit + " budget.", "budgets", key));
            } else {
                long percent = spent.multiply(BigDecimal.valueOf(100))
                        .divide(budget.getLimitAmount(), 0, RoundingMode.DOWN).longValue();
                result.add(new PendingNotification(NotificationType.BUDGET_WARNING,
                        "Budget almost used: " + label,
                        "You have used " + percent + "% of your " + limit + " budget (" + used + " spent).",
                        "budgets", key));
            }
        }
        return result;
    }

    /** The period a budget applies to right now, or null when it cannot be worked out. */
    static LocalDate[] budgetWindow(Budget budget, LocalDate today) {
        String period = budget.getPeriod() == null ? "MONTHLY" : budget.getPeriod().toUpperCase(Locale.ROOT);
        return switch (period) {
            case "WEEKLY" -> {
                LocalDate start = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                yield new LocalDate[]{start, start.plusDays(6)};
            }
            case "YEARLY" -> new LocalDate[]{today.withDayOfYear(1), today.with(TemporalAdjusters.lastDayOfYear())};
            case "CUSTOM" -> {
                if (budget.getStartDate() == null || budget.getEndDate() == null
                        || today.isBefore(budget.getStartDate()) || today.isAfter(budget.getEndDate())) {
                    yield null;
                }
                yield new LocalDate[]{budget.getStartDate(), budget.getEndDate()};
            }
            default -> new LocalDate[]{today.withDayOfMonth(1), today.with(TemporalAdjusters.lastDayOfMonth())};
        };
    }

    // ------------------------------------------------------------------ bills

    private List<PendingNotification> upcomingBills(User user, LocalDate today) {
        List<PendingNotification> result = new ArrayList<>();
        for (RecurringExpense bill : recurringExpenseRepository.findByUser(user)) {
            if (bill.getNextDueDate() == null) {
                continue;
            }
            long days = ChronoUnit.DAYS.between(today, bill.getNextDueDate());
            if (Arrays.stream(DUE_REMINDER_DAYS).noneMatch(d -> d == days)) {
                continue;
            }
            String when = days == 0 ? "today" : days == 1 ? "tomorrow" : "in " + days + " days";
            String name = bill.getDescription() == null || bill.getDescription().isBlank() ? "A bill" : bill.getDescription();
            result.add(new PendingNotification(NotificationType.SUBSCRIPTION_DUE,
                    name + " is due " + when,
                    NotificationRules.money(user.getCurrency(), bill.getAmount()) + " is due on " + bill.getNextDueDate() + ".",
                    "subscriptions", "bill:" + bill.getId() + ":" + bill.getNextDueDate() + ":" + days));
        }
        return result;
    }

    // ------------------------------------------------------------------ goals

    private List<PendingNotification> goalMilestones(User user) {
        List<PendingNotification> result = new ArrayList<>();
        for (SavingsGoal goal : savingsGoalRepository.findByUser(user)) {
            int milestone = NotificationRules.goalMilestone(goal.getCurrentAmount(), goal.getTargetAmount());
            if (milestone == 0) {
                continue;
            }
            String title = milestone == 100 ? "Goal reached: " + goal.getName()
                    : goal.getName() + " is " + milestone + "% funded";
            String body = milestone == 100
                    ? "You saved the full " + NotificationRules.money(user.getCurrency(), goal.getTargetAmount()) + "."
                    : NotificationRules.money(user.getCurrency(), goal.getCurrentAmount()) + " of "
                    + NotificationRules.money(user.getCurrency(), goal.getTargetAmount()) + " saved.";
            result.add(new PendingNotification(NotificationType.GOAL_MILESTONE, title, body,
                    "goals", "goal:" + goal.getId() + ":" + milestone));
        }
        return result;
    }

    // ------------------------------------------------------------------ large expenses

    private List<PendingNotification> largeExpenses(User user, LocalDate today) {
        LocalDate yesterday = today.minusDays(1);
        List<Expense> recent = expenseRepository.findByUserAndExpenseDateBetween(user, yesterday, yesterday);
        if (recent.isEmpty()) {
            return List.of();
        }
        List<BigDecimal> history = expenseRepository
                .findByUserAndExpenseDateBetween(user, yesterday.minusDays(LARGE_EXPENSE_HISTORY_DAYS), yesterday.minusDays(1))
                .stream().map(Expense::getAmount).filter(Objects::nonNull).collect(Collectors.toList());
        BigDecimal average = NotificationRules.average(history);

        List<PendingNotification> result = new ArrayList<>();
        for (Expense expense : recent) {
            // Bills the app created on its own are expected, not surprising.
            if (expense.getDescription() != null && expense.getDescription().endsWith("(Auto)")) {
                continue;
            }
            if (!NotificationRules.isLargeExpense(expense.getAmount(), history)) {
                continue;
            }
            long times = expense.getAmount().divide(average, 0, RoundingMode.HALF_UP).longValue();
            String name = expense.getDescription() == null || expense.getDescription().isBlank() ? "An expense" : expense.getDescription();
            result.add(new PendingNotification(NotificationType.LARGE_EXPENSE,
                    "Large expense: " + name,
                    NotificationRules.money(user.getCurrency(), expense.getAmount()) + " is about " + times
                            + "x your usual expense.",
                    "dashboard", "large:" + expense.getId()));
        }
        return result;
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
