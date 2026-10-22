package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;

@Schema(description = "Parameters for interactive What-If wealth and runway simulation")
public record WealthSimulationRequest(
        BigDecimal monthlyExpenseCut,
        BigDecimal additionalMonthlyIncome,
        BigDecimal additionalMonthlySavings,
        @Min(value = 1, message = "Horizon must be at least 1 month")
        @Max(value = 60, message = "Horizon cannot exceed 60 months")
        Integer horizonMonths
) {}
