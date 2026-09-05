package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Data Transfer Object representing a savings goal response including calculated progress.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Response payload representing a savings goal and milestone progress")
public class SavingsGoalDto {

    @Schema(description = "Unique ID of savings goal", example = "10")
    private Long id;

    @Schema(description = "Descriptive title of the savings goal", example = "Emergency Fund")
    private String name;

    @Schema(description = "Target monetary amount to achieve", example = "100000.00")
    private BigDecimal targetAmount;

    @Schema(description = "Current accumulated savings balance", example = "45000.00")
    private BigDecimal currentAmount;

    @Schema(description = "Target completion deadline date", example = "2026-12-31")
    private LocalDate targetDate;

    @Schema(description = "Lifecycle status (IN_PROGRESS, COMPLETED, PAUSED)", example = "IN_PROGRESS")
    private String status;

    @Schema(description = "Calculated progress completion percentage (0.0 to 100.0+)", example = "45.0")
    private double progressPercentage;

    @Schema(description = "Whether this savings goal has recurring deposits/chits", example = "true")
    private Boolean isRecurring;

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
    public SavingsGoalDto() {}

    /**
     * Parameterized constructor.
     *
     * @param id goal identifier
     * @param name goal name
     * @param targetAmount target amount
     * @param currentAmount current balance
     * @param targetDate deadline date
     * @param status lifecycle status
     * @param progressPercentage progress completion %
     */
    public SavingsGoalDto(Long id, String name, BigDecimal targetAmount, BigDecimal currentAmount,
                          LocalDate targetDate, String status, double progressPercentage) {
        this.id = id;
        this.name = name;
        this.targetAmount = targetAmount;
        this.currentAmount = currentAmount;
        this.targetDate = targetDate;
        this.status = status;
        this.progressPercentage = progressPercentage;
    }

    /** @return Goal identifier */
    public Long getId() {
        return id;
    }

    /** @param id Goal identifier */
    public void setId(Long id) {
        this.id = id;
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
    public BigDecimal getCurrentSavedAmount() {
        return currentAmount;
    }

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
        return status;
    }

    /** @param status Lifecycle status */
    public void setStatus(String status) {
        this.status = status;
    }

    /** @return Calculated percentage progress */
    public double getProgressPercentage() {
        return progressPercentage;
    }

    /** @param progressPercentage Calculated percentage progress */
    public void setProgressPercentage(double progressPercentage) {
        this.progressPercentage = progressPercentage;
    }
    public Boolean getIsRecurring() {
        return isRecurring;
    }

    public void setIsRecurring(Boolean recurring) {
        isRecurring = recurring;
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
