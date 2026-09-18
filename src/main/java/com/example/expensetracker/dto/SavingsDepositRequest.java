package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Request payload DTO for making a deposit contribution towards a savings goal.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Request body for making a deposit towards a savings goal")
public record SavingsDepositRequest(
        @Schema(description = "Contribution deposit amount to add to savings goal balance",
                example = "5000.00", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Deposit amount is required")
        @Positive(message = "Deposit amount must be greater than zero")
        BigDecimal amount
) {}
