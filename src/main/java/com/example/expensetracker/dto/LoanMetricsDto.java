package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

/**
 * Aggregated metrics specifically for peer loans, friend adjustments, and IOUs.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Dedicated metrics and financial positions for loans and friend adjustments")
public record LoanMetricsDto(
        @Schema(description = "Total lent across all records (settled + pending)", example = "15000.00")
        BigDecimal totalLent,

        @Schema(description = "Total borrowed across all records (settled + pending)", example = "8000.00")
        BigDecimal totalBorrowed,

        @Schema(description = "Active outstanding money friends owe you (unsettled LENT)", example = "5000.00")
        BigDecimal lentPending,

        @Schema(description = "Active outstanding money you owe to lenders (unsettled BORROWED)", example = "2000.00")
        BigDecimal borrowedPending,

        @Schema(description = "Net peer balance (lentPending - borrowedPending). Positive means friends owe you overall; negative means you owe others.", example = "3000.00")
        BigDecimal netBalance,

        @Schema(description = "Total number of adjustment records", example = "12")
        long totalCount,

        @Schema(description = "Number of pending / unsettled adjustments", example = "4")
        long pendingCount,

        @Schema(description = "Number of settled adjustments", example = "8")
        long settledCount
) {}
