package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(description = "Single-month cash flow and cumulative wealth projection")
public record CashFlowForecastDto(
        @Schema(description = "Forecast calendar month in YYYY-MM format", example = "2026-11")
        String month,
        @Schema(description = "Projected monthly inflow", example = "125000.00")
        BigDecimal projectedInflow,
        @Schema(description = "Projected monthly outflow", example = "68000.00")
        BigDecimal projectedOutflow,
        @Schema(description = "Projected monthly net surplus", example = "57000.00")
        BigDecimal projectedNetSurplus,
        @Schema(description = "Baseline cumulative wealth trajectory", example = "342000.00")
        BigDecimal cumulativeWealthProjection,
        @Schema(description = "Optimistic (+15% efficiency) cumulative trajectory", example = "368500.00")
        BigDecimal optimisticProjection,
        @Schema(description = "Conservative (-10% stress-test) cumulative trajectory", example = "315000.00")
        BigDecimal conservativeProjection
) {}
