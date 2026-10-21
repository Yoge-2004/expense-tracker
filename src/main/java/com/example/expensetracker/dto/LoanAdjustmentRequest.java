package com.example.expensetracker.dto;

import com.example.expensetracker.model.LoanType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Payload for creating or updating a peer loan or casual friend adjustment.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Request body for creating or updating a loan / friend adjustment record")
public record LoanAdjustmentRequest(
        @Schema(description = "Name of friend, acquaintance, or lender", example = "Rahul Sharma", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Person or friend name is required")
        @Size(max = 120, message = "Name must not exceed 120 characters")
        String counterparty,

        @Schema(description = "Direction: LENT (they owe you) or BORROWED (you owe them)", example = "LENT", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Loan type is required (LENT or BORROWED)")
        LoanType type,

        @Schema(description = "Monetary amount — must be positive", example = "1200.00", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Amount is required")
        @Positive(message = "Amount must be strictly positive")
        BigDecimal amount,

        @Schema(description = "Date incurred (ISO-8601: yyyy-MM-dd)", example = "2026-10-20", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Adjustment date is required")
        LocalDate adjustmentDate,

        @Schema(description = "Optional expected repayment date (ISO-8601: yyyy-MM-dd)", example = "2026-11-01")
        LocalDate dueDate,

        @Schema(description = "Optional context notes or occasion", example = "Dinner bill split at Toit")
        @Size(max = 255, message = "Notes must not exceed 255 characters")
        String notes,

        @Schema(description = "Whether this adjustment is already settled", example = "false")
        Boolean isSettled,

        @Schema(description = "Optional ID of the originating expense to connect to", example = "42")
        Long expenseId,

        @Schema(description = "Whether reminder notifications are enabled", example = "true")
        Boolean reminderEnabled,

        @Schema(description = "Date for reminder notification (ISO-8601: yyyy-MM-dd)", example = "2026-10-25")
        LocalDate reminderDate,

        @Schema(description = "Time of day for reminder (e.g., '10:00')", example = "10:00")
        String reminderTime,

        @Schema(description = "Recurrence frequency: NONE, ONCE, DAILY, WEEKLY, MONTHLY", example = "DAILY")
        String reminderFrequency
) {
    public LoanAdjustmentRequest(String counterparty, LoanType type, BigDecimal amount, LocalDate adjustmentDate) {
        this(counterparty, type, amount, adjustmentDate, null, null, false, null, false, null, null, null);
    }

    public LoanAdjustmentRequest(String counterparty, LoanType type, BigDecimal amount, LocalDate adjustmentDate, LocalDate dueDate, String notes, Boolean isSettled) {
        this(counterparty, type, amount, adjustmentDate, dueDate, notes, isSettled, null, false, null, null, null);
    }
}
