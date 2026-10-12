package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request payload DTO for creating or updating an income transaction.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Request body for creating or updating an income entry")
public record IncomeRequest(
        @Schema(description = "Monetary income amount received (positive)",
                example = "75000.00", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Amount is required")
        @Positive(message = "Amount must be greater than zero")
        BigDecimal amount,

        @Schema(description = "Origin or source channel of the income",
                example = "Tech Corp Salary", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Source is required")
        String source,

        @Schema(description = "Optional context, description, or notes", example = "August monthly remuneration")
        String description,

        @Schema(description = "Calendar date when income was credited",
                example = "2026-08-01", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Income date is required")
        LocalDate incomeDate,

        @Schema(description = "Whether this income recurs periodically (e.g. monthly salary)", example = "true")
        Boolean isRecurring,

        @Schema(description = "Recurrence frequency (DAILY, WEEKLY, MONTHLY, YEARLY, CUSTOM)", example = "MONTHLY")
        String frequency,

        @Schema(description = "Interval in days when frequency is CUSTOM", example = "14")
        Integer intervalDays,
        @Schema(description = "SALARY, OTHER or REIMBURSEMENT. Omit to leave unchanged (inferred from the source "
                + "for new records); blank clears it.", example = "SALARY")
        String kind,
        @Schema(description = "Month this money counts toward as YYYY-MM when it differs from the credit date "
                + "(e.g. next month's salary credited early). Omit to leave unchanged; blank clears it.",
                example = "2026-11")
        String countsTowardMonth,
        @Schema(description = "For a REIMBURSEMENT, the expense category it offsets. Omit to leave unchanged; "
                + "0 clears it.", example = "3")
        Long reimbursedCategoryId
) {
    public IncomeRequest {
        if (isRecurring == null) {
            isRecurring = false;
        }
    }

    public IncomeRequest(BigDecimal amount, String source, String description,
                         LocalDate incomeDate, Boolean isRecurring) {
        this(amount, source, description, incomeDate, isRecurring, null, null);
    }

    /** Pre-classification shape, kept so existing callers compile unchanged. */
    public IncomeRequest(BigDecimal amount, String source, String description,
                         LocalDate incomeDate, Boolean isRecurring, String frequency, Integer intervalDays) {
        this(amount, source, description, incomeDate, isRecurring, frequency, intervalDays, null, null, null);
    }
}
