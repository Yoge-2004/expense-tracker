package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Data Transfer Object representing a savings goal response.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Response payload representing a savings goal")
public record SavingsGoalDto(
        @Schema(description = "Unique ID of savings goal", example = "10")
        Long id,

        @Schema(description = "Descriptive title of the savings goal", example = "Emergency Fund")
        String name,

        @Schema(description = "Target monetary amount to achieve", example = "100000.00")
        BigDecimal targetAmount,

        @Schema(description = "Current accumulated savings balance", example = "45000.00")
        BigDecimal currentAmount,

        @Schema(description = "Target completion deadline date", example = "2026-12-31")
        LocalDate targetDate,

        @Schema(description = "Lifecycle status (IN_PROGRESS, COMPLETED, PAUSED)", example = "IN_PROGRESS")
        String status,

        @Schema(description = "Calculated progress completion percentage (0.0 to 100.0+)", example = "45.0")
        double progressPercentage,

        @Schema(description = "Whether this savings goal has recurring deposits/chits", example = "true")
        Boolean isRecurring,

        @Schema(description = "Recurring installment deposit amount", example = "5000.00")
        BigDecimal recurringAmount,

        @Schema(description = "Installment frequency (DAILY, WEEKLY, BI_WEEKLY, MONTHLY, YEARLY, CUSTOM)", example = "MONTHLY")
        String frequency,

        @Schema(description = "Interval in days if custom cadence", example = "30")
        Integer intervalDays,

        @Schema(description = "Next scheduled deposit due date", example = "2026-04-01")
        LocalDate nextDueDate,

        @Schema(description = "Optional end date for recurring contributions", example = "2027-12-31")
        LocalDate endDate
) {
    public SavingsGoalDto(Long id, String name, BigDecimal targetAmount, BigDecimal currentAmount,
                          LocalDate targetDate, String status, double progressPercentage) {
        this(id, name, targetAmount, currentAmount, targetDate, status, progressPercentage,
                null, null, null, null, null, null);
    }
}
