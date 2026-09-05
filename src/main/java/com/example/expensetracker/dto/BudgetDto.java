package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request payload for creating or updating a category budget limit.
 *
 * <p>Used both to create a new {@link com.example.expensetracker.model.Budget}
 * and to update an existing one — the service layer treats a second submission
 * for the same user–category pair as an update rather than creating a
 * duplicate (see
 * {@link com.example.expensetracker.controller.ExpenseController#setBudget}).</p>
 *
 * @see com.example.expensetracker.model.Budget
 * @see BudgetStatusDto
 */
@Schema(description = "Sets a spending limit for a specific category and period")
public class BudgetDto {

    private Long id;

    @Schema(description = "ID of the category for which the budget applies", example = "1", requiredMode = Schema.RequiredMode.REQUIRED)
    private Long categoryId;

    @Schema(description = "Maximum spend allowed for this category", example = "300.00", requiredMode = Schema.RequiredMode.REQUIRED)
    @com.fasterxml.jackson.annotation.JsonAlias({"limit", "limitAmount"})
    private BigDecimal limitAmount;

    @Schema(description = "Budget period: MONTHLY, WEEKLY, YEARLY, CUSTOM", example = "MONTHLY")
    private String period = "MONTHLY";

    @Schema(description = "Custom interval in days for CUSTOM period", example = "30")
    private Integer intervalDays;

    @Schema(description = "Start date for CUSTOM period", example = "2026-07-01")
    private LocalDate startDate;

    @Schema(description = "End date for CUSTOM period", example = "2026-07-31")
    private LocalDate endDate;

    public BudgetDto() {}

    public BudgetDto(Long categoryId, BigDecimal limitAmount) {
        this.categoryId  = categoryId;
        this.limitAmount = limitAmount;
    }

    public BudgetDto(Long id, Long categoryId, BigDecimal limitAmount, String period, LocalDate startDate, LocalDate endDate) {
        this.id = id;
        this.categoryId = categoryId;
        this.limitAmount = limitAmount;
        this.period = period;
        this.startDate = startDate;
        this.endDate = endDate;
    }

    public BudgetDto(Long id, Long categoryId, BigDecimal limitAmount, String period, Integer intervalDays, LocalDate startDate, LocalDate endDate) {
        this.id = id;
        this.categoryId = categoryId;
        this.limitAmount = limitAmount;
        this.period = period;
        this.intervalDays = intervalDays;
        this.startDate = startDate;
        this.endDate = endDate;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long id) { this.categoryId = id; }
    public BigDecimal getLimitAmount() { return limitAmount; }
    public void setLimitAmount(BigDecimal limit) { this.limitAmount = limit; }
    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }
    public Integer getIntervalDays() { return intervalDays; }
    public void setIntervalDays(Integer intervalDays) { this.intervalDays = intervalDays; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
}
