package com.example.expensetracker.dto;

import com.example.expensetracker.model.LoanType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO representing a peer loan or casual friend adjustment.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Response representation of a peer loan or friend adjustment")
public record LoanAdjustmentDto(
        @Schema(description = "Unique ID of the record", example = "1")
        Long id,

        @Schema(description = "Name of friend or lender", example = "Rahul Sharma")
        String counterparty,

        @Schema(description = "Direction: LENT or BORROWED", example = "LENT")
        LoanType type,

        @Schema(description = "Monetary amount", example = "1200.00")
        BigDecimal amount,

        @Schema(description = "Date incurred", example = "2026-10-20")
        LocalDate adjustmentDate,

        @Schema(description = "Expected settlement due date", example = "2026-11-01")
        LocalDate dueDate,

        @Schema(description = "Notes or occasion description", example = "Dinner bill split at Toit")
        String notes,

        @Schema(description = "Whether settled / repaid", example = "false")
        Boolean isSettled,

        @Schema(description = "Date when marked settled", example = "2026-10-25")
        LocalDate settledDate,

        @Schema(description = "ID of connected expense if linked", example = "42")
        Long expenseId,

        @Schema(description = "Description of connected expense", example = "Dinner at Olive Bistro")
        String expenseDescription,

        @Schema(description = "Original amount of connected expense", example = "3500.00")
        BigDecimal expenseAmount,

        @Schema(description = "Whether reminders are enabled", example = "true")
        Boolean reminderEnabled,

        @Schema(description = "Target date for reminder", example = "2026-10-25")
        LocalDate reminderDate,

        @Schema(description = "Time of reminder", example = "10:00")
        String reminderTime,

        @Schema(description = "Frequency of reminder", example = "DAILY")
        String reminderFrequency,

        @Schema(description = "Timestamp when created")
        LocalDateTime createdAt
) {
    public LoanAdjustmentDto(Long id, String counterparty, LoanType type, BigDecimal amount, LocalDate adjustmentDate,
                             LocalDate dueDate, String notes, Boolean isSettled, LocalDate settledDate, LocalDateTime createdAt) {
        this(id, counterparty, type, amount, adjustmentDate, dueDate, notes, isSettled, settledDate, null, null, null, false, null, null, null, createdAt);
    }
}
