package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

/**
 * Data Transfer Object representing cash flow balance and savings metrics for a specified period.
 *
 * <p>Contains total incomes, total expenses, calculated net savings, and savings rate percentage.</p>
 *
 * @author Yogeshwaran
 */
@Schema(description = "Cash flow metrics summary including net savings and savings rate")
public class CashFlowSummaryDto {

    @Schema(description = "Calendar year of summary", example = "2026")
    private int year;

    @Schema(description = "Calendar month of summary (1-12)", example = "8")
    private int month;

    @Schema(description = "Total income earned during the period", example = "80000.00")
    private BigDecimal totalIncome;

    @Schema(description = "Total expense spent during the period", example = "45000.00")
    private BigDecimal totalExpense;

    @Schema(description = "Net savings (totalIncome - totalExpense)", example = "35000.00")
    private BigDecimal netSavings;

    @Schema(description = "Percentage of income saved ((netSavings / totalIncome) * 100)", example = "43.75")
    private double savingsRate;

    @Schema(description = "Total number of income transactions", example = "2")
    private int incomeCount;

    @Schema(description = "Total number of expense transactions", example = "18")
    private int expenseCount;

    /**
     * Default constructor.
     */
    public CashFlowSummaryDto() {}

    /**
     * Parameterized constructor.
     *
     * @param year calendar year
     * @param month calendar month
     * @param totalIncome total income inflow
     * @param totalExpense total expense outflow
     * @param netSavings difference between income and expense
     * @param savingsRate percentage savings rate
     * @param incomeCount number of income events
     * @param expenseCount number of expense events
     */
    public CashFlowSummaryDto(int year, int month, BigDecimal totalIncome, BigDecimal totalExpense,
                              BigDecimal netSavings, double savingsRate, int incomeCount, int expenseCount) {
        this.year = year;
        this.month = month;
        this.totalIncome = totalIncome;
        this.totalExpense = totalExpense;
        this.netSavings = netSavings;
        this.savingsRate = savingsRate;
        this.incomeCount = incomeCount;
        this.expenseCount = expenseCount;
    }

    /** @return Calendar year */
    public int getYear() {
        return year;
    }

    /** @param year Calendar year */
    public void setYear(int year) {
        this.year = year;
    }

    /** @return Calendar month */
    public int getMonth() {
        return month;
    }

    /** @param month Calendar month */
    public void setMonth(int month) {
        this.month = month;
    }

    /** @return Total income */
    public BigDecimal getTotalIncome() {
        return totalIncome;
    }

    /** @param totalIncome Total income */
    public void setTotalIncome(BigDecimal totalIncome) {
        this.totalIncome = totalIncome;
    }

    /** @return Total expense */
    public BigDecimal getTotalExpense() {
        return totalExpense;
    }

    /** @param totalExpense Total expense */
    public void setTotalExpense(BigDecimal totalExpense) {
        this.totalExpense = totalExpense;
    }

    /** @return Net savings */
    public BigDecimal getNetSavings() {
        return netSavings;
    }

    /** @param netSavings Net savings */
    public void setNetSavings(BigDecimal netSavings) {
        this.netSavings = netSavings;
    }

    /** @return Savings rate percentage */
    public double getSavingsRate() {
        return savingsRate;
    }

    /** @param savingsRate Savings rate percentage */
    public void setSavingsRate(double savingsRate) {
        this.savingsRate = savingsRate;
    }

    /** @return Incomes count */
    public int getIncomeCount() {
        return incomeCount;
    }

    /** @param incomeCount Incomes count */
    public void setIncomeCount(int incomeCount) {
        this.incomeCount = incomeCount;
    }

    /** @return Expenses count */
    public int getExpenseCount() {
        return expenseCount;
    }

    /** @param expenseCount Expenses count */
    public void setExpenseCount(int expenseCount) {
        this.expenseCount = expenseCount;
    }
}
