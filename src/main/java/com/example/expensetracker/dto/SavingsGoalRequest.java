package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request payload DTO for creating or updating a savings goal.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Request body for creating or updating a savings goal")
public record SavingsGoalRequest(
        @Schema(description = "Descriptive title for the savings goal", example = "Emergency Fund",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Goal name is required")
        String name,

        @Schema(description = "Target monetary amount to save", example = "100000.00",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Target amount is required")
        @Positive(message = "Target amount must be greater than zero")
        BigDecimal targetAmount,

        @Schema(description = "Initial accumulated amount (optional, defaults to 0.00)", example = "15000.00")
        BigDecimal currentAmount,

        @Schema(description = "Target deadline date for achieving this goal", example = "2026-12-31")
        LocalDate targetDate,

        @Schema(description = "Lifecycle status (IN_PROGRESS, COMPLETED, PAUSED)", example = "IN_PROGRESS")
        String status,

        @Schema(description = "Whether this savings goal has recurring deposits/chits", example = "true")
        Boolean isRecurring,

        @Schema(description = "Recurring installment deposit amount", example = "5000.00")
        BigDecimal recurringAmount,

        @Schema(description = "Installment frequency (DAILY, WEEKLY, BI_WEEKLY, MONTHLY, YEARLY, CUSTOM)",
                example = "MONTHLY")
        String frequency,

        @Schema(description = "Interval in days if custom cadence", example = "30")
        Integer intervalDays,

        @Schema(description = "Next scheduled deposit due date", example = "2026-04-01")
        LocalDate nextDueDate,

        @Schema(description = "Optional end date for recurring contributions", example = "2027-12-31")
        LocalDate endDate
) {
    public SavingsGoalRequest {
        if (status == null || status.isBlank()) {
            status = "IN_PROGRESS";
        }
        if (isRecurring == null) {
            isRecurring = false;
        }
    }


}
