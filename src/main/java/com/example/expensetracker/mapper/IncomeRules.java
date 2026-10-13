package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.IncomeKind;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Rules that decide how an income is classified: what kind of money it is and which
 * calendar month it counts toward. Pure functions so every caller (API, reports, tests)
 * agrees.
 *
 * <p>Two real situations drive this: a salary credited on the 30th that is really next
 * month's, and money handed back for something already paid (a reimbursement), which must
 * reduce spending instead of inflating income.</p>
 */
public final class IncomeRules {

    /** How far (in months) an income may be assigned away from the month it was credited. */
    public static final int MAX_MONTH_SHIFT = 3;

    private static final Pattern MONTH = Pattern.compile("\\d{4}-(0[1-9]|1[0-2])");

    private IncomeRules() {}

    /** Parses a kind name; null or blank means "not specified". Unknown names are rejected. */
    public static IncomeKind parseKind(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return IncomeKind.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Unknown income kind '" + raw.trim() + "'. Use SALARY, OTHER or REIMBURSEMENT.");
        }
    }

    /** Older rows have no stored kind: a source that mentions "salary" is salary, anything else is other income. */
    public static IncomeKind inferKind(String source) {
        return source != null && source.toLowerCase(Locale.ROOT).contains("salary")
                ? IncomeKind.SALARY : IncomeKind.OTHER;
    }

    /** The kind to use for calculations: the stored one, otherwise inferred from the source. */
    public static IncomeKind effectiveKind(Income income) {
        if (income == null) {
            return IncomeKind.OTHER;
        }
        try {
            IncomeKind stored = parseKind(income.getKind());
            if (stored != null) {
                return stored;
            }
        } catch (IllegalArgumentException ignored) {
            // an unreadable stored value falls back to inference
        }
        return inferKind(income.getSource());
    }

    /** Parses "YYYY-MM"; null or blank means "not specified". Anything else is rejected. */
    public static YearMonth parseMonth(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        if (!MONTH.matcher(value).matches()) {
            throw new IllegalArgumentException("Counts-toward month must look like 2026-11");
        }
        return YearMonth.parse(value);
    }

    /** The month this income counts toward: the explicit one if set, otherwise the month of its date. */
    public static YearMonth effectiveMonth(Income income) {
        if (income == null || income.getIncomeDate() == null) {
            return null;
        }
        try {
            YearMonth stored = parseMonth(income.getCountsTowardMonth());
            if (stored != null) {
                return stored;
            }
        } catch (IllegalArgumentException ignored) {
            // an unreadable stored value falls back to the credit date
        }
        return YearMonth.from(income.getIncomeDate());
    }

    /**
     * Applies the classification fields of a request onto an income.
     *
     * <p>For every field, {@code null} means "leave as is" (so older clients that do not know
     * these fields never wipe them) and a blank string / {@code 0} clears it.</p>
     *
     * @throws IllegalArgumentException for an unknown kind, a malformed or too distant month,
     *                                  a negative category id, or a recurring reimbursement
     */
    public static void apply(Income target, IncomeRequest request) {
        if (target == null || request == null) {
            return;
        }
        if (request.kind() != null) {
            IncomeKind kind = parseKind(request.kind());
            target.setKind(kind == null ? null : kind.name());
        }

        LocalDate date = target.getIncomeDate();
        if (request.countsTowardMonth() != null) {
            YearMonth requested = parseMonth(request.countsTowardMonth());
            if (requested != null && date != null && monthsApart(YearMonth.from(date), requested) > MAX_MONTH_SHIFT) {
                throw new IllegalArgumentException("Counts-toward month must be within " + MAX_MONTH_SHIFT
                        + " months of the income date");
            }
            boolean sameAsDate = requested != null && date != null && requested.equals(YearMonth.from(date));
            target.setCountsTowardMonth(requested == null || sameAsDate ? null : requested.toString());
        } else if (target.getCountsTowardMonth() != null && date != null) {
            // The date may have been edited since the month was stored; drop a month that no longer makes sense.
            YearMonth stored;
            try {
                stored = parseMonth(target.getCountsTowardMonth());
            } catch (IllegalArgumentException e) {
                stored = null;
            }
            if (stored == null || monthsApart(YearMonth.from(date), stored) > MAX_MONTH_SHIFT) {
                target.setCountsTowardMonth(null);
            }
        }

        if (effectiveKind(target) == IncomeKind.REIMBURSEMENT) {
            if (Boolean.TRUE.equals(target.getIsRecurring())) {
                throw new IllegalArgumentException("A reimbursement cannot be recurring");
            }
            Long categoryId = request.reimbursedCategoryId();
            if (categoryId != null) {
                if (categoryId < 0) {
                    throw new IllegalArgumentException("Reimbursed category id must be positive");
                }
                target.setReimbursedCategoryId(categoryId == 0 ? null : categoryId);
            }
        } else {
            target.setReimbursedCategoryId(null);
        }
    }

    private static int monthsApart(YearMonth a, YearMonth b) {
        return (int) Math.abs(a.until(b, ChronoUnit.MONTHS));
    }
}
