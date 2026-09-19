package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
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
 */
@Schema(description = "Consolidated executive monthly financial intelligence report")
public record MonthlyReportDto(
        @Schema(description = "Formatted period label", example = "August 2026")
        String period,

        @Schema(description = "Calendar year of report", example = "2026")
        int year,

        @Schema(description = "Calendar month of report (1-12)", example = "8")
        int month,

        @Schema(description = "Total expenditure outflow for the month", example = "4250.00")
        BigDecimal totalOutflow,

        @Schema(description = "Total income inflow for the month", example = "7500.00")
        BigDecimal totalIncome,

        @Schema(description = "Net cash flow (totalIncome - totalOutflow)", example = "3250.00")
        BigDecimal netCashFlow,

        @Schema(description = "Savings rate percentage of income (netCashFlow / totalIncome * 100)", example = "43.3")
        double savingsRate,

        @Schema(description = "Currency code of user profile", example = "INR")
        String currency,

        @Schema(description = "Total number of expense transactions recorded in period", example = "24")
        int transactionCount,

        @Schema(description = "Average expense spending per calendar day", example = "137.10")
        BigDecimal dailyAverage,

        @Schema(description = "Highest single expense transaction amount", example = "1200.00")
        BigDecimal highestExpenseAmount,

        @Schema(description = "Description of highest expense transaction", example = "Laptop Maintenance")
        String highestExpenseDescription,

        @Schema(description = "Total committed towards recurring subscriptions/bills", example = "499.00")
        BigDecimal recurringTotal,

        @Schema(description = "Algorithmic financial insights and observations")
        List<String> insights,

        @Schema(description = "Overall budget adherence health score (0 to 100)", example = "85")
        int budgetHealthScore,

        @Schema(description = "Spending aggregated and ranked by category")
        List<CategoryReportDto> categoryBreakdown,

        @Schema(description = "Category budget limits vs actual spent")
        List<BudgetReportDto> budgetStatuses,

        @Schema(description = "Top 5 largest transactions of the month")
        List<ExpenseDto> topExpenses,

        @Schema(description = "Recorded incomes for the monthly period")
        List<IncomeDto> incomes,

        @Schema(description = "Active savings goals and milestone targets")
        List<SavingsGoalDto> savingsGoals
) {
    /**
     * DTO representing spending aggregation for a single category.
     */
    @Schema(description = "Category spending aggregation item")
    public record CategoryReportDto(
            @Schema(description = "Category name", example = "Food & Dining")
            String categoryName,

            @Schema(description = "Total expenditure amount in category", example = "1500.00")
            BigDecimal totalAmount,

            @Schema(description = "Percentage share of total monthly expenditure", example = "35.3")
            double percentage
    ) {}

    /**
     * DTO representing budget adherence status for a category.
     */
    @Schema(description = "Budget adherence status item")
    public record BudgetReportDto(
            @Schema(description = "Category name", example = "Food & Dining")
            String categoryName,

            @Schema(description = "Budget limit amount", example = "5000.00")
            BigDecimal limitAmount,

            @Schema(description = "Actual amount spent towards budget", example = "4200.00")
            BigDecimal spentAmount,

            @Schema(description = "Percentage of budget utilized", example = "84.0")
            double usagePercentage
    ) {
        public boolean isExceeded() {
            return (spentAmount != null && limitAmount != null && spentAmount.compareTo(limitAmount) > 0)
                    || usagePercentage > 100.0;
        }
    }
}
