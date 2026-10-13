package com.example.expensetracker.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;

/** The thresholds behind each notification, as pure functions so they can be tested without a database. */
public final class NotificationRules {

    private static final BigDecimal WARN_RATIO = new BigDecimal("0.80");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final int[] GOAL_MILESTONES = {100, 75, 50, 25};
    /** An expense counts as unusually large from this many times the user's average. */
    private static final BigDecimal LARGE_MULTIPLE = BigDecimal.valueOf(3);
    /** Not enough history to call anything "unusual" below this many past expenses. */
    private static final int MIN_HISTORY = 5;

    private NotificationRules() {}

    /** 100 when spending reached the limit, 80 when it reached 80% of it, otherwise 0. */
    public static int budgetLevel(BigDecimal spent, BigDecimal limit) {
        if (spent == null || limit == null || limit.signum() <= 0) {
            return 0;
        }
        if (spent.compareTo(limit) >= 0) {
            return 100;
        }
        return spent.compareTo(limit.multiply(WARN_RATIO)) >= 0 ? 80 : 0;
    }

    /** The highest of 25 / 50 / 75 / 100 that a goal has reached, or 0. */
    public static int goalMilestone(BigDecimal current, BigDecimal target) {
        if (current == null || target == null || target.signum() <= 0) {
            return 0;
        }
        BigDecimal percent = current.multiply(HUNDRED).divide(target, 2, RoundingMode.DOWN);
        for (int milestone : GOAL_MILESTONES) {
            if (percent.compareTo(BigDecimal.valueOf(milestone)) >= 0) {
                return milestone;
            }
        }
        return 0;
    }

    public static BigDecimal average(List<BigDecimal> values) {
        if (values == null || values.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal total = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return total.divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
    }

    /** True when the amount is at least 3x the average of enough past expenses. */
    public static boolean isLargeExpense(BigDecimal amount, List<BigDecimal> history) {
        if (amount == null || history == null || history.size() < MIN_HISTORY) {
            return false;
        }
        BigDecimal average = average(history);
        return average.signum() > 0 && amount.compareTo(average.multiply(LARGE_MULTIPLE)) >= 0;
    }

    /** "INR 1,200" */
    public static String money(String currency, BigDecimal amount) {
        String code = currency == null || currency.isBlank() ? "INR" : currency;
        return String.format(Locale.ROOT, "%s %,.0f", code, amount == null ? BigDecimal.ZERO : amount);
    }
}
