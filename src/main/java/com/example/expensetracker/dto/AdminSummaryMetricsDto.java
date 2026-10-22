package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * High-level aggregated platform key performance indicators for the Admin Dashboard.
 * Pre-computed asynchronously and cached to guarantee O(1) response time without
 * hitting transactional database tables.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Aggregated platform KPIs and system health summary")
public record AdminSummaryMetricsDto(
        @Schema(description = "Total registered user accounts on the platform", example = "1540")
        long totalUsers,

        @Schema(description = "Count of user accounts currently locked out", example = "3")
        long lockedUsers,

        @Schema(description = "Total number of expense entries recorded across all users", example = "45120")
        long totalExpensesCount,

        @Schema(description = "Grand total monetary sum of all expenses logged", example = "1284500.50")
        BigDecimal totalExpensesAmount,

        @Schema(description = "Grand total monetary sum of all income flows logged", example = "2150000.00")
        BigDecimal totalIncomesAmount,

        @Schema(description = "Estimated active users within the current period", example = "342")
        long activeUsers,

        @Schema(description = "Status of the primary database connectivity", example = "HEALTHY")
        String dbStatus,

        @Schema(description = "Dialect/Engine of the active database", example = "PostgreSQL")
        String dbType,

        @Schema(description = "Whether Project Loom virtual threads are enabled and active", example = "true")
        boolean virtualThreadsActive,

        @Schema(description = "Timestamp when these metrics were compiled into cache")
        LocalDateTime lastCalculatedAt
) {}
