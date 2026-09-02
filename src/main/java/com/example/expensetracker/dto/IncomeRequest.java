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
public class IncomeRequest {

    /**
     * Monetary amount of income received.
     */
    @Schema(description = "Monetary income amount received (positive)", example = "75000.00", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "Amount is required")
    @Positive(message = "Amount must be greater than zero")
    private BigDecimal amount;

    /**
     * Source or channel of income.
     */
    @Schema(description = "Origin or source channel of the income", example = "Tech Corp Salary", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "Source is required")
    private String source;

    /**
     * Optional description or notes for the income.
     */
    @Schema(description = "Optional context, description, or notes", example = "August monthly remuneration")
    private String description;

    /**
     * Transaction date on which income was received.
     */
    @Schema(description = "Calendar date when income was credited", example = "2026-08-01", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "Income date is required")
    private LocalDate incomeDate;

    /**
     * Whether this income is expected to recur on a schedule.
     */
    @Schema(description = "Whether this income recurs periodically (e.g. monthly salary)", example = "true")
    private Boolean isRecurring = false;

    /**
     * Default constructor.
     */
    public IncomeRequest() {}

    /**
     * Parameterized constructor.
     *
     * @param amount monetary value
     * @param source source of income
     * @param description contextual notes
     * @param incomeDate date of income
     * @param isRecurring whether recurring
     */
    public IncomeRequest(BigDecimal amount, String source, String description, LocalDate incomeDate, Boolean isRecurring) {
        this.amount = amount;
        this.source = source;
        this.description = description;
        this.incomeDate = incomeDate;
        this.isRecurring = isRecurring;
    }

    /** @return Income amount */
    public BigDecimal getAmount() {
        return amount;
    }

    /** @param amount Income amount */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    /** @return Source or channel */
    public String getSource() {
        return source;
    }

    /** @param source Source or channel */
    public void setSource(String source) {
        this.source = source;
    }

    /** @return Context description */
    public String getDescription() {
        return description;
    }

    /** @param description Context description */
    public void setDescription(String description) {
        this.description = description;
    }

    /** @return Income date */
    public LocalDate getIncomeDate() {
        return incomeDate;
    }

    /** @param incomeDate Income date */
    public void setIncomeDate(LocalDate incomeDate) {
        this.incomeDate = incomeDate;
    }

    /** @return True if recurring */
    public Boolean getIsRecurring() {
        return isRecurring != null && isRecurring;
    }

    /** @param isRecurring True if recurring */
    public void setIsRecurring(Boolean isRecurring) {
        this.isRecurring = isRecurring;
    }
}
