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
public class SavingsDepositRequest {

    @Schema(description = "Contribution deposit amount to add to savings goal balance", example = "5000.00", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "Deposit amount is required")
    @Positive(message = "Deposit amount must be greater than zero")
    private BigDecimal amount;

    /**
     * Default constructor.
     */
    public SavingsDepositRequest() {}

    /**
     * Parameterized constructor.
     *
     * @param amount deposit contribution amount
     */
    public SavingsDepositRequest(BigDecimal amount) {
        this.amount = amount;
    }

    /** @return Deposit amount */
    public BigDecimal getAmount() {
        return amount;
    }

    /** @param amount Deposit amount */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
