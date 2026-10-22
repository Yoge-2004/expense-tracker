package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Historical aggregated daily trend point for administrative volume charts.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Single daily aggregated metric data point for charting trends")
public record AdminVolumeTrendDto(
        @Schema(description = "Date for this aggregated metric slice", example = "2026-10-22")
        LocalDate date,

        @Schema(description = "Cumulative registered users up to this date", example = "1540")
        long users,

        @Schema(description = "Number of expenses logged on this date", example = "184")
        long expenseCount,

        @Schema(description = "Total expense amount logged on this date", example = "14250.00")
        BigDecimal expenseAmount,

        @Schema(description = "Total income amount logged on this date", example = "28500.00")
        BigDecimal incomeAmount
) {}
