package com.example.expensetracker.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request payload for creating or updating a category budget limit.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Sets a spending limit for a specific category and period")
public record BudgetDto(
        Long id,

        @Schema(description = "ID of the category for which the budget applies", example = "1", requiredMode = Schema.RequiredMode.REQUIRED)
        Long categoryId,

        @Schema(description = "Maximum spend allowed for this category", example = "300.00", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonAlias({"limit", "limitAmount"})
        BigDecimal limitAmount,

        @Schema(description = "Budget period: MONTHLY, WEEKLY, YEARLY, CUSTOM", example = "MONTHLY")
        String period,

        @Schema(description = "Custom interval in days for CUSTOM period", example = "30")
        Integer intervalDays,

        @Schema(description = "Start date for CUSTOM period", example = "2026-07-01")
        LocalDate startDate,

        @Schema(description = "End date for CUSTOM period", example = "2026-07-31")
        LocalDate endDate
) {
    public BudgetDto {
        if (period == null || period.isBlank()) {
            period = "MONTHLY";
        }
    }

    public BudgetDto(Long categoryId, BigDecimal limitAmount) {
        this(null, categoryId, limitAmount, "MONTHLY", null, null, null);
    }

    public BudgetDto(Long id, Long categoryId, BigDecimal limitAmount, String period, LocalDate startDate, LocalDate endDate) {
        this(id, categoryId, limitAmount, period, null, startDate, endDate);
    }
}
