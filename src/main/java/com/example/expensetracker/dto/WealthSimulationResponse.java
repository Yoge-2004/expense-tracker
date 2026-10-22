package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(description = "Projected outcome of the interactive wealth and goal runway simulation")
public record WealthSimulationResponse(
        int horizonMonths,
        BigDecimal baselineMonthlySurplus,
        BigDecimal simulatedMonthlySurplus,
        BigDecimal baselineHorizonWealth,
        BigDecimal simulatedHorizonWealth,
        BigDecimal incrementalWealthGain,
        double simulatedSavingsRatePct,
        int estimatedMonthsToFundGoals,
        int monthsSavedTowardGoals,
        String narrativeSummary
) {}
