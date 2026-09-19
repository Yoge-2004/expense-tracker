package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Read-only view of how much of a budget has been consumed for its current period.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Budget utilisation status for one expense category and period")
public record BudgetStatusDto(
        Long budgetId,
        Long categoryId,

        @Schema(description = "Name of the expense category", example = "Food")
        String categoryName,

        @Schema(description = "Configured spending limit", example = "300.00")
        BigDecimal limit,

        @Schema(description = "Total amount spent in this category during the active period", example = "175.50")
        BigDecimal spent,

        @Schema(description = "Budget consumption percentage", example = "58.5")
        double percentage,

        String period,
        Integer intervalDays,
        LocalDate startDate,
        LocalDate endDate
) {

}
