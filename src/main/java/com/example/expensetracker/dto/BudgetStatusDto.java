package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "Budget utilisation status for one expense category and period")
public class BudgetStatusDto {

    private Long budgetId;
    private Long categoryId;

    @Schema(description = "Name of the expense category", example = "Food")
    private String categoryName;

    @Schema(description = "Configured spending limit", example = "300.00")
    private BigDecimal limit;

    @Schema(description = "Total amount spent in this category during the active period", example = "175.50")
    private BigDecimal spent;

    @Schema(description = "Budget consumption percentage", example = "58.5")
    private double percentage;

    private String period;
    private LocalDate startDate;
    private LocalDate endDate;

    public BudgetStatusDto(String categoryName, BigDecimal limit, BigDecimal spent, double percentage) {
        this.categoryName = categoryName;
        this.limit        = limit;
        this.spent        = spent;
        this.percentage   = percentage;
    }

    public BudgetStatusDto(Long budgetId, Long categoryId, String categoryName, BigDecimal limit, BigDecimal spent, double percentage, String period, LocalDate startDate, LocalDate endDate) {
        this.budgetId     = budgetId;
        this.categoryId   = categoryId;
        this.categoryName = categoryName;
        this.limit        = limit;
        this.spent        = spent;
        this.percentage   = percentage;
        this.period       = period;
        this.startDate    = startDate;
        this.endDate      = endDate;
    }

    public Long getBudgetId() { return budgetId; }
    public void setBudgetId(Long budgetId) { this.budgetId = budgetId; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String name) { this.categoryName = name; }
    public BigDecimal getLimit() { return limit; }
    public void setLimit(BigDecimal limit) { this.limit = limit; }
    public BigDecimal getSpent() { return spent; }
    public void setSpent(BigDecimal spent) { this.spent = spent; }
    public double getPercentage() { return percentage; }
    public void setPercentage(double p) { this.percentage = p; }
    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
}
