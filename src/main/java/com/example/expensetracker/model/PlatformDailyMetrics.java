package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Pre-aggregated daily platform metrics table for fast O(1) administrative
 * reporting without running expensive table scans on OLTP user transaction tables.
 *
 * @author Yogeshwaran
 */
@Entity
@Table(name = "platform_daily_metrics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlatformDailyMetrics {

    @Id
    @Column(name = "metric_date", nullable = false)
    private LocalDate metricDate;

    @Column(name = "total_users", nullable = false)
    private long totalUsers;

    @Column(name = "active_users", nullable = false)
    private long activeUsers;

    @Column(name = "total_expenses_count", nullable = false)
    private long totalExpensesCount;

    @Column(name = "total_expenses_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalExpensesAmount;

    @Column(name = "total_incomes_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalIncomesAmount;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
