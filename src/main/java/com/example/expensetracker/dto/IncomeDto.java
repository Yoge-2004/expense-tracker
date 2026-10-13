package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Data Transfer Object representing an income transaction response.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Response payload representing an income record")
public record IncomeDto(
        @Schema(description = "Unique ID of income record", example = "1")
        Long id,

        @Schema(description = "Monetary income amount", example = "75000.00")
        BigDecimal amount,

        @Schema(description = "Income channel or origin source", example = "Tech Corp Salary")
        String source,

        @Schema(description = "Optional context notes or description", example = "August monthly remuneration")
        String description,

        @Schema(description = "Calendar date when income was received", example = "2026-08-01")
        LocalDate incomeDate,

        @Schema(description = "Indicates whether income is periodic/recurring", example = "true")
        Boolean isRecurring,

        @Schema(description = "Timestamp when record was created", example = "2026-08-01T10:15:30")
        LocalDateTime createdAt,

        @Schema(description = "Recurrence frequency (DAILY, WEEKLY, MONTHLY, YEARLY, CUSTOM)", example = "MONTHLY")
        String frequency,

        @Schema(description = "Interval in days for CUSTOM frequency", example = "14")
        Integer intervalDays,

        @Schema(description = "Next scheduled recurrence date", example = "2026-09-01")
        LocalDate nextDueDate,
        @Schema(description = "SALARY, OTHER or REIMBURSEMENT (inferred from the source for older records)",
                example = "SALARY")
        String kind,
        @Schema(description = "Month this money counts toward, YYYY-MM. Equals the month of incomeDate unless "
                + "it was assigned to another month.", example = "2026-09")
        String countsTowardMonth,
        @Schema(description = "For a REIMBURSEMENT, the expense category it offsets (null = the month as a whole)",
                example = "3")
        Long reimbursedCategoryId
) {
    /** Pre-classification shape, kept so existing callers compile unchanged. */
    public IncomeDto(Long id, BigDecimal amount, String source, String description,
                     LocalDate incomeDate, Boolean isRecurring, LocalDateTime createdAt,
                     String frequency, Integer intervalDays, LocalDate nextDueDate) {
        this(id, amount, source, description, incomeDate, isRecurring, createdAt,
                frequency, intervalDays, nextDueDate, null, null, null);
    }

    public IncomeDto(Long id, BigDecimal amount, String source, String description,
                     LocalDate incomeDate, Boolean isRecurring, LocalDateTime createdAt) {
        this(id, amount, source, description, incomeDate, isRecurring, createdAt, null, null, null);
    }
}
