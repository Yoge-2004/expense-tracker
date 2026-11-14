package com.example.expensetracker.domain.budget.model;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Locale;

/**
 * Encapsulates calculation of the start and end dates for budget periods.
 * <p>
 * Enforces the Open/Closed Principle (OCP) by encapsulating date-window arithmetic
 * within polymorphic enum constants, eliminating duplicated switch-case statements
 * across budget and notification detection services.
 * </p>
 */
public enum BudgetPeriod {
    WEEKLY {
        @Override
        public LocalDate[] calculateWindow(Budget budget, LocalDate anchor) {
            LocalDate start = anchor.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            return new LocalDate[]{start, start.plusDays(6)};
        }
    },
    YEARLY {
        @Override
        public LocalDate[] calculateWindow(Budget budget, LocalDate anchor) {
            return new LocalDate[]{anchor.withDayOfYear(1), anchor.with(TemporalAdjusters.lastDayOfYear())};
        }
    },
    CUSTOM {
        @Override
        public LocalDate[] calculateWindow(Budget budget, LocalDate anchor) {
            if (budget.getStartDate() != null && budget.getEndDate() != null) {
                return new LocalDate[]{budget.getStartDate(), budget.getEndDate()};
            } else if (budget.getStartDate() != null && budget.getIntervalDays() != null && budget.getIntervalDays() > 0) {
                return new LocalDate[]{budget.getStartDate(), budget.getStartDate().plusDays(budget.getIntervalDays())};
            } else if (budget.getIntervalDays() != null && budget.getIntervalDays() > 0) {
                return new LocalDate[]{anchor, anchor.plusDays(budget.getIntervalDays())};
            }
            LocalDate start = budget.getStartDate() != null ? budget.getStartDate() : anchor.withDayOfMonth(1);
            LocalDate end = budget.getEndDate() != null ? budget.getEndDate() : anchor.with(TemporalAdjusters.lastDayOfMonth());
            return new LocalDate[]{start, end};
        }
    },
    MONTHLY {
        @Override
        public LocalDate[] calculateWindow(Budget budget, LocalDate anchor) {
            return new LocalDate[]{anchor.withDayOfMonth(1), anchor.with(TemporalAdjusters.lastDayOfMonth())};
        }
    };

    /**
     * Calculates the inclusive start and end dates of the budget period relative to an anchor date.
     *
     * @param budget the budget configuration
     * @param anchor the current or reference date
     * @return a two-element array containing {@code [startDate, endDate]}
     */
    public abstract LocalDate[] calculateWindow(Budget budget, LocalDate anchor);

    /**
     * Resolves a {@link BudgetPeriod} from raw text, defaulting safely to {@link #MONTHLY}.
     *
     * @param raw period string
     * @return the resolved {@link BudgetPeriod}
     */
    public static BudgetPeriod fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            return MONTHLY;
        }
        try {
            return BudgetPeriod.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return MONTHLY;
        }
    }
}
