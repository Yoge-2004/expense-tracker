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
public class SavingsGoalRequest {

    @Schema(description = "Descriptive title for the savings goal", example = "Emergency Fund", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "Goal name is required")
    private String name;

    @Schema(description = "Target monetary amount to save", example = "100000.00", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "Target amount is required")
    @Positive(message = "Target amount must be greater than zero")
    private BigDecimal targetAmount;

    @Schema(description = "Initial accumulated amount (optional, defaults to 0.00)", example = "15000.00")
    private BigDecimal currentAmount;

    @Schema(description = "Target deadline date for achieving this goal", example = "2026-12-31")
    private LocalDate targetDate;

    @Schema(description = "Lifecycle status (IN_PROGRESS, COMPLETED, PAUSED)", example = "IN_PROGRESS")
    private String status = "IN_PROGRESS";

    @Schema(description = "Whether this savings goal has recurring deposits/chits", example = "true")
    private Boolean isRecurring = false;

    @Schema(description = "Recurring installment deposit amount", example = "5000.00")
    private BigDecimal recurringAmount;

    @Schema(description = "Installment frequency (DAILY, WEEKLY, BI_WEEKLY, MONTHLY, YEARLY, CUSTOM)", example = "MONTHLY")
    private String frequency;

    @Schema(description = "Interval in days if custom cadence", example = "30")
    private Integer intervalDays;

    @Schema(description = "Next scheduled deposit due date", example = "2026-04-01")
    private LocalDate nextDueDate;

    @Schema(description = "Optional end date for recurring contributions", example = "2027-12-31")
    private LocalDate endDate;

    /**
     * Default constructor.
     */
    public SavingsGoalRequest() {}

    /**
     * Parameterized constructor.
     *
     * @param name goal name
     * @param targetAmount target amount
     * @param currentAmount current balance
     * @param targetDate target deadline
     * @param status lifecycle status
     */
    public SavingsGoalRequest(String name, BigDecimal targetAmount, BigDecimal currentAmount,
                              LocalDate targetDate, String status) {
        this.name = name;
        this.targetAmount = targetAmount;
        this.currentAmount = currentAmount;
        this.targetDate = targetDate;
        this.status = status != null ? status : "IN_PROGRESS";
    }

    /** @return Goal name */
    public String getName() {
        return name;
    }

    /** @param name Goal name */
    public void setName(String name) {
        this.name = name;
    }

    /** @return Target monetary amount */
    public BigDecimal getTargetAmount() {
        return targetAmount;
    }

    /** @param targetAmount Target monetary amount */
    public void setTargetAmount(BigDecimal targetAmount) {
        this.targetAmount = targetAmount;
    }

    /** @return Currently accumulated balance */
    public BigDecimal getCurrentAmount() {
        return currentAmount;
    }

    /** @param currentAmount Currently accumulated balance */
    public void setCurrentAmount(BigDecimal currentAmount) {
        this.currentAmount = currentAmount;
    }

    /** @return Target deadline date */
    public LocalDate getTargetDate() {
        return targetDate;
    }

    /** @param targetDate Target deadline date */
    public void setTargetDate(LocalDate targetDate) {
        this.targetDate = targetDate;
    }

    /** @return Lifecycle status */
    public String getStatus() {
        return status != null ? status : "IN_PROGRESS";
    }

    /** @param status Lifecycle status */
    public void setStatus(String status) {
        this.status = status;
    }
    public Boolean getIsRecurring() {
        return isRecurring != null ? isRecurring : false;
    }

    public void setIsRecurring(Boolean recurring) {
        isRecurring = recurring != null ? recurring : false;
    }

    public BigDecimal getRecurringAmount() {
        return recurringAmount;
    }

    public void setRecurringAmount(BigDecimal recurringAmount) {
        this.recurringAmount = recurringAmount;
    }

    public String getFrequency() {
        return frequency;
    }

    public void setFrequency(String frequency) {
        this.frequency = frequency;
    }

    public Integer getIntervalDays() {
        return intervalDays;
    }

    public void setIntervalDays(Integer intervalDays) {
        this.intervalDays = intervalDays;
    }

    public LocalDate getNextDueDate() {
        return nextDueDate;
    }

    public void setNextDueDate(LocalDate nextDueDate) {
        this.nextDueDate = nextDueDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }
}
