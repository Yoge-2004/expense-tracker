package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Transfer Object representing the executive monthly financial report.
 *
 * <p>Aggregates multi-dimensional financial health data for a user across a specified calendar month,
 * including total outflow (expenses), total inflow (incomes), net cash flow, savings rate percentage,
 * daily velocity, category breakdowns, budget adherence, largest transactions, recurring commitments,
 * and active savings goals.</p>
 *
 * @author Yogeshwaran
 * @see com.example.expensetracker.service.MonthlyReportService
 */
@Schema(description = "Consolidated executive monthly financial intelligence report")
public class MonthlyReportDto {

    @Schema(description = "Formatted period label", example = "August 2026")
    private String period;

    @Schema(description = "Calendar year of report", example = "2026")
    private int year;

    @Schema(description = "Calendar month of report (1-12)", example = "8")
    private int month;

    @Schema(description = "Total expenditure outflow for the month", example = "4250.00")
    private BigDecimal totalOutflow = BigDecimal.ZERO;

    @Schema(description = "Total income inflow for the month", example = "7500.00")
    private BigDecimal totalIncome = BigDecimal.ZERO;

    @Schema(description = "Net cash flow (totalIncome - totalOutflow)", example = "3250.00")
    private BigDecimal netCashFlow = BigDecimal.ZERO;

    @Schema(description = "Savings rate percentage of income (netCashFlow / totalIncome * 100)", example = "43.3")
    private double savingsRate = 0.0;

    @Schema(description = "Currency code of user profile", example = "INR")
    private String currency;

    @Schema(description = "Total number of expense transactions recorded in period", example = "24")
    private int transactionCount;

    @Schema(description = "Average expense spending per calendar day", example = "137.10")
    private BigDecimal dailyAverage = BigDecimal.ZERO;

    @Schema(description = "Highest single expense transaction amount", example = "1200.00")
    private BigDecimal highestExpenseAmount = BigDecimal.ZERO;

    @Schema(description = "Description of highest expense transaction", example = "Laptop Maintenance")
    private String highestExpenseDescription;

    @Schema(description = "Total committed towards recurring subscriptions/bills", example = "499.00")
    private BigDecimal recurringTotal = BigDecimal.ZERO;

    @Schema(description = "Algorithmic financial insights and observations")
    private List<String> insights = new ArrayList<>();

    @Schema(description = "Overall budget adherence health score (0 to 100)", example = "85")
    private int budgetHealthScore;

    @Schema(description = "Spending aggregated and ranked by category")
    private List<CategoryReportDto> categoryBreakdown = new ArrayList<>();

    @Schema(description = "Category budget limits vs actual spent")
    private List<BudgetReportDto> budgetStatuses = new ArrayList<>();

    @Schema(description = "Top 5 largest transactions of the month")
    private List<ExpenseDto> topExpenses = new ArrayList<>();

    @Schema(description = "Recorded incomes for the monthly period")
    private List<IncomeDto> incomes = new ArrayList<>();

    @Schema(description = "Active savings goals and milestone targets")
    private List<SavingsGoalDto> savingsGoals = new ArrayList<>();

    /**
     * Default constructor.
     */
    public MonthlyReportDto() {}

    /** @return Total income inflow */
    public BigDecimal getTotalIncome() { return totalIncome; }
    /** @param totalIncome Total income inflow */
    public void setTotalIncome(BigDecimal totalIncome) { this.totalIncome = totalIncome; }

    /** @return Net cash flow */
    public BigDecimal getNetCashFlow() { return netCashFlow; }
    /** @param netCashFlow Net cash flow */
    public void setNetCashFlow(BigDecimal netCashFlow) { this.netCashFlow = netCashFlow; }

    /** @return Savings rate percentage */
    public double getSavingsRate() { return savingsRate; }
    /** @param savingsRate Savings rate percentage */
    public void setSavingsRate(double savingsRate) { this.savingsRate = savingsRate; }

    /** @return Daily average spending */
    public BigDecimal getDailyAverage() { return dailyAverage; }
    /** @param dailyAverage Daily average spending */
    public void setDailyAverage(BigDecimal dailyAverage) { this.dailyAverage = dailyAverage; }

    /** @return Highest expense amount */
    public BigDecimal getHighestExpenseAmount() { return highestExpenseAmount; }
    /** @param highestExpenseAmount Highest expense amount */
    public void setHighestExpenseAmount(BigDecimal highestExpenseAmount) { this.highestExpenseAmount = highestExpenseAmount; }

    /** @return Highest expense description */
    public String getHighestExpenseDescription() { return highestExpenseDescription; }
    /** @param highestExpenseDescription Highest expense description */
    public void setHighestExpenseDescription(String highestExpenseDescription) { this.highestExpenseDescription = highestExpenseDescription; }

    /** @return Total recurring subscriptions */
    public BigDecimal getRecurringTotal() { return recurringTotal; }
    /** @param recurringTotal Total recurring subscriptions */
    public void setRecurringTotal(BigDecimal recurringTotal) { this.recurringTotal = recurringTotal; }

    /** @return Financial executive insights */
    public List<String> getInsights() { return insights; }
    /** @param insights Financial executive insights */
    public void setInsights(List<String> insights) { this.insights = insights; }

    /** @return Budget health score */
    public int getBudgetHealthScore() { return budgetHealthScore; }
    /** @param budgetHealthScore Budget health score */
    public void setBudgetHealthScore(int budgetHealthScore) { this.budgetHealthScore = budgetHealthScore; }

    /** @return Month period label */
    public String getPeriod() { return period; }
    /** @param period Month period label */
    public void setPeriod(String period) { this.period = period; }

    /** @return Calendar year */
    public int getYear() { return year; }
    /** @param year Calendar year */
    public void setYear(int year) { this.year = year; }

    /** @return Calendar month */
    public int getMonth() { return month; }
    /** @param month Calendar month */
    public void setMonth(int month) { this.month = month; }

    /** @return Total outflow expenditure */
    public BigDecimal getTotalOutflow() { return totalOutflow; }
    /** @param totalOutflow Total outflow expenditure */
    public void setTotalOutflow(BigDecimal totalOutflow) { this.totalOutflow = totalOutflow; }

    /** @return Currency code */
    public String getCurrency() { return currency; }
    /** @param currency Currency code */
    public void setCurrency(String currency) { this.currency = currency; }

    /** @return Total transaction count */
    public int getTransactionCount() { return transactionCount; }
    /** @param transactionCount Total transaction count */
    public void setTransactionCount(int transactionCount) { this.transactionCount = transactionCount; }

    /** @return Breakdown by category */
    public List<CategoryReportDto> getCategoryBreakdown() { return categoryBreakdown; }
    /** @param categoryBreakdown Breakdown by category */
    public void setCategoryBreakdown(List<CategoryReportDto> categoryBreakdown) { this.categoryBreakdown = categoryBreakdown; }

    /** @return Budget tracking status */
    public List<BudgetReportDto> getBudgetStatuses() { return budgetStatuses; }
    /** @param budgetStatuses Budget tracking status */
    public void setBudgetStatuses(List<BudgetReportDto> budgetStatuses) { this.budgetStatuses = budgetStatuses; }

    /** @return Top expenses of the month */
    public List<ExpenseDto> getTopExpenses() { return topExpenses; }
    /** @param topExpenses Top expenses of the month */
    public void setTopExpenses(List<ExpenseDto> topExpenses) { this.topExpenses = topExpenses; }

    /** @return Incomes recorded during the month */
    public List<IncomeDto> getIncomes() { return incomes; }
    /** @param incomes Incomes recorded during the month */
    public void setIncomes(List<IncomeDto> incomes) { this.incomes = incomes; }

    /** @return Active savings goals and milestones */
    public List<SavingsGoalDto> getSavingsGoals() { return savingsGoals; }
    /** @param savingsGoals Active savings goals and milestones */
    public void setSavingsGoals(List<SavingsGoalDto> savingsGoals) { this.savingsGoals = savingsGoals; }

    /**
     * DTO representing spending aggregation for a single category.
     */
    @Schema(description = "Category spending aggregation item")
    public static class CategoryReportDto {

        @Schema(description = "Category name", example = "Food & Dining")
        private String categoryName;

        @Schema(description = "Total expenditure amount in category", example = "1500.00")
        private BigDecimal totalAmount;

        @Schema(description = "Percentage share of total monthly expenditure", example = "35.3")
        private double percentage;

        /** Default constructor */
        public CategoryReportDto() {}

        /**
         * Parameterized constructor.
         * @param categoryName category name
         * @param totalAmount total spent in category
         * @param percentage share percentage
         */
        public CategoryReportDto(String categoryName, BigDecimal totalAmount, double percentage) {
            this.categoryName = categoryName;
            this.totalAmount = totalAmount;
            this.percentage = percentage;
        }

        /** @return Category name */
        public String getCategoryName() { return categoryName; }
        /** @param categoryName Category name */
        public void setCategoryName(String categoryName) { this.categoryName = categoryName; }

        /** @return Total spent in category */
        public BigDecimal getTotalAmount() { return totalAmount; }
        /** @param totalAmount Total spent in category */
        public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

        /** @return Percentage of total expenses */
        public double getPercentage() { return percentage; }
        /** @param percentage Percentage of total expenses */
        public void setPercentage(double percentage) { this.percentage = percentage; }
    }

    /**
     * DTO representing budget adherence status for a category.
     */
    @Schema(description = "Budget adherence status item")
    public static class BudgetReportDto {

        @Schema(description = "Category name", example = "Food & Dining")
        private String categoryName;

        @Schema(description = "Budget limit amount", example = "5000.00")
        private BigDecimal limitAmount;

        @Schema(description = "Actual amount spent towards budget", example = "4200.00")
        private BigDecimal spentAmount;

        @Schema(description = "Percentage of budget utilized", example = "84.0")
        private double usagePercentage;

        /** Default constructor */
        public BudgetReportDto() {}

        /**
         * Parameterized constructor.
         * @param categoryName category name
         * @param limitAmount budget limit
         * @param spentAmount actual spent
         * @param usagePercentage usage percentage
         */
        public BudgetReportDto(String categoryName, BigDecimal limitAmount, BigDecimal spentAmount, double usagePercentage) {
            this.categoryName = categoryName;
            this.limitAmount = limitAmount;
            this.spentAmount = spentAmount;
            this.usagePercentage = usagePercentage;
        }

        /** @return Category name */
        public String getCategoryName() { return categoryName; }
        /** @param categoryName Category name */
        public void setCategoryName(String categoryName) { this.categoryName = categoryName; }

        /** @return Limit amount */
        public BigDecimal getLimitAmount() { return limitAmount; }
        /** @param limitAmount Limit amount */
        public void setLimitAmount(BigDecimal limitAmount) { this.limitAmount = limitAmount; }

        /** @return Spent amount */
        public BigDecimal getSpentAmount() { return spentAmount; }
        /** @param spentAmount Spent amount */
        public void setSpentAmount(BigDecimal spentAmount) { this.spentAmount = spentAmount; }

        /** @return Usage percentage */
        public double getUsagePercentage() { return usagePercentage; }
        /** @param usagePercentage Usage percentage */
        public void setUsagePercentage(double usagePercentage) { this.usagePercentage = usagePercentage; }
    }
}
