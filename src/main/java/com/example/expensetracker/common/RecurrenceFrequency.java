package com.example.expensetracker.common;

import java.time.LocalDate;
import java.util.Locale;

/**
 * Encapsulates recurrence schedules and provides an extensible calculation strategy
 * for recurring expenses, recurring incomes, and recurring savings plans.
 * <p>
 * Follows the Open/Closed Principle (OCP) by encapsulating polymorphic interval calculation,
 * allowing new frequencies (e.g. BIWEEKLY, QUARTERLY, SEMI_ANNUALLY) to be defined
 * in a single cohesive place without modifying consuming services.
 * </p>
 */
public enum RecurrenceFrequency {
    DAILY {
        @Override
        public LocalDate nextOccurrence(LocalDate anchor, Integer intervalDays) {
            return anchor.plusDays(1);
        }
    },
    WEEKLY {
        @Override
        public LocalDate nextOccurrence(LocalDate anchor, Integer intervalDays) {
            return anchor.plusWeeks(1);
        }
    },
    BIWEEKLY {
        @Override
        public LocalDate nextOccurrence(LocalDate anchor, Integer intervalDays) {
            return anchor.plusWeeks(2);
        }
    },
    MONTHLY {
        @Override
        public LocalDate nextOccurrence(LocalDate anchor, Integer intervalDays) {
            return anchor.plusMonths(1);
        }
    },
    QUARTERLY {
        @Override
        public LocalDate nextOccurrence(LocalDate anchor, Integer intervalDays) {
            return anchor.plusMonths(3);
        }
    },
    SEMI_ANNUALLY {
        @Override
        public LocalDate nextOccurrence(LocalDate anchor, Integer intervalDays) {
            return anchor.plusMonths(6);
        }
    },
    YEARLY {
        @Override
        public LocalDate nextOccurrence(LocalDate anchor, Integer intervalDays) {
            return anchor.plusYears(1);
        }
    },
    CUSTOM {
        @Override
        public LocalDate nextOccurrence(LocalDate anchor, Integer intervalDays) {
            int days = (intervalDays != null && intervalDays > 0) ? intervalDays : 30;
            return anchor.plusDays(days);
        }
    };

    /**
     * Calculates the subsequent occurrence from an anchor date.
     *
     * @param anchor       starting/current due date
     * @param intervalDays optional custom interval in days
     * @return the calculated next occurrence date
     */
    public abstract LocalDate nextOccurrence(LocalDate anchor, Integer intervalDays);

    /**
     * Parses a raw frequency string into a typed {@link RecurrenceFrequency}.
     * Defaults safely to {@link #MONTHLY} for null, blank, or unrecognized strings.
     *
     * @param raw the raw frequency string
     * @return the resolved {@link RecurrenceFrequency}
     */
    public static RecurrenceFrequency fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            return MONTHLY;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT).replace("-", "_").replace(" ", "_");
        if ("BI_WEEKLY".equals(normalized)) {
            return BIWEEKLY;
        }
        try {
            return RecurrenceFrequency.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            return MONTHLY;
        }
    }
}
