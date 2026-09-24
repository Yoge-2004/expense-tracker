package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

/**
 * Data Transfer Object representing cash flow balance and savings metrics for a specified period.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Cash flow metrics summary including net savings and savings rate")
public record CashFlowSummaryDto(
        @Schema(description = "Calendar year of summary", example = "2026")
        int year,

        @Schema(description = "Calendar month of summary (1-12)", example = "8")
        int month,

        @Schema(description = "Total income earned during the period", example = "80000.00")
        BigDecimal totalIncome,

        @Schema(description = "Total expense spent during the period", example = "45000.00")
        BigDecimal totalExpense,

        @Schema(description = "Net savings (totalIncome - totalExpense)", example = "35000.00")
        BigDecimal netSavings,

        @Schema(description = "Percentage of income saved ((netSavings / totalIncome) * 100)", example = "43.75")
        double savingsRate,

        @Schema(description = "Total number of income transactions", example = "2")
        int incomeCount,

        @Schema(description = "Total number of expense transactions", example = "18")
        int expenseCount
) {}
