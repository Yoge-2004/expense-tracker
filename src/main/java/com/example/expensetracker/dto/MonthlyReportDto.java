package com.example.expensetracker.dto;

import java.math.BigDecimal;
import java.util.List;

public class MonthlyReportDto {
    private String period; // e.g. "August 2026"
    private int year;
    private int month;
    private BigDecimal totalOutflow;
    private String currency;
    private int transactionCount;
    private List<CategoryReportDto> categoryBreakdown;
    private List<BudgetReportDto> budgetStatuses;
    private List<ExpenseDto> topExpenses;

    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }

    public int getYear() { return year; }
    public void setYear(int year) { this.year = year; }

    public int getMonth() { return month; }
    public void setMonth(int month) { this.month = month; }

    public BigDecimal getTotalOutflow() { return totalOutflow; }
    public void setTotalOutflow(BigDecimal totalOutflow) { this.totalOutflow = totalOutflow; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public int getTransactionCount() { return transactionCount; }
    public void setTransactionCount(int transactionCount) { this.transactionCount = transactionCount; }

    public List<CategoryReportDto> getCategoryBreakdown() { return categoryBreakdown; }
    public void setCategoryBreakdown(List<CategoryReportDto> categoryBreakdown) { this.categoryBreakdown = categoryBreakdown; }

    public List<BudgetReportDto> getBudgetStatuses() { return budgetStatuses; }
    public void setBudgetStatuses(List<BudgetReportDto> budgetStatuses) { this.budgetStatuses = budgetStatuses; }

    public List<ExpenseDto> getTopExpenses() { return topExpenses; }
    public void setTopExpenses(List<ExpenseDto> topExpenses) { this.topExpenses = topExpenses; }

    public static class CategoryReportDto {
        private String categoryName;
        private BigDecimal totalAmount;
        private double percentage;

        public CategoryReportDto() {}
        public CategoryReportDto(String categoryName, BigDecimal totalAmount, double percentage) {
            this.categoryName = categoryName;
            this.totalAmount = totalAmount;
            this.percentage = percentage;
        }

        public String getCategoryName() { return categoryName; }
        public void setCategoryName(String categoryName) { this.categoryName = categoryName; }

        public BigDecimal getTotalAmount() { return totalAmount; }
        public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

        public double getPercentage() { return percentage; }
        public void setPercentage(double percentage) { this.percentage = percentage; }
    }

    public static class BudgetReportDto {
        private String categoryName;
        private BigDecimal limitAmount;
        private BigDecimal spentAmount;
        private double usagePercentage;

        public BudgetReportDto() {}
        public BudgetReportDto(String categoryName, BigDecimal limitAmount, BigDecimal spentAmount, double usagePercentage) {
            this.categoryName = categoryName;
            this.limitAmount = limitAmount;
            this.spentAmount = spentAmount;
            this.usagePercentage = usagePercentage;
        }

        public String getCategoryName() { return categoryName; }
        public void setCategoryName(String categoryName) { this.categoryName = categoryName; }

        public BigDecimal getLimitAmount() { return limitAmount; }
        public void setLimitAmount(BigDecimal limitAmount) { this.limitAmount = limitAmount; }

        public BigDecimal getSpentAmount() { return spentAmount; }
        public void setSpentAmount(BigDecimal spentAmount) { this.spentAmount = spentAmount; }

        public double getUsagePercentage() { return usagePercentage; }
        public void setUsagePercentage(double usagePercentage) { this.usagePercentage = usagePercentage; }
    }
}
