package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Schema(description = "Executive financial intelligence telemetry and 6-month trajectory forecast")
public record FinancialIntelligenceDto(
        int healthScore,
        String healthGrade,
        Map<String, Integer> subScores,
        BigDecimal currentMonthInflow,
        BigDecimal currentMonthNetOutflow,
        BigDecimal netCashFlow,
        double savingsRatePct,
        BigDecimal dailyBurnRate,
        BigDecimal projectedMonthEndSpend,
        BigDecimal safeDailySpend,
        int daysRemainingInMonth,
        int noSpendStreakDays,
        BigDecimal monthlyRecurringInflow,
        BigDecimal monthlyRecurringOutflow,
        double recurringCoverageRatio,
        List<CashFlowForecastDto> sixMonthForecast,
        List<String> executiveRecommendations
) {}
