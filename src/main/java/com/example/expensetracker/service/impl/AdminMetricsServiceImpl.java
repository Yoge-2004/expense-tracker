package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.AdminSummaryMetricsDto;
import com.example.expensetracker.dto.AdminVolumeTrendDto;
import com.example.expensetracker.model.PlatformDailyMetrics;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.PlatformDailyMetricsRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.AdminMetricsService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * High-performance metrics service using asynchronous background rollups
 * and in-memory caching to guarantee zero latency penalty on OLTP queries.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminMetricsServiceImpl implements AdminMetricsService {

    private final UserRepository userRepository;
    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final PlatformDailyMetricsRepository dailyMetricsRepository;
    private final DataSource dataSource;

    @Value("${spring.threads.virtual.enabled:false}")
    private boolean virtualThreadsConfigured;

    private volatile AdminSummaryMetricsDto cachedSummary;

    @PostConstruct
    public void init() {
        log.info("Initializing AdminMetricsService with initial pre-aggregation rollup");
        try {
            refreshMetrics();
        } catch (Exception e) {
            log.warn("Deferred initial admin metrics aggregation: {}", e.getMessage());
        }
    }

    /**
     * Re-aggregates metrics every 5 minutes in a background task.
     */
    @Scheduled(fixedRate = 300000, initialDelay = 60000)
    @Transactional
    @Override
    public void refreshMetrics() {
        long startTime = System.currentTimeMillis();
        long totalUsers = userRepository.count();
        long lockedUsers = userRepository.countByAccountLocked(true);
        long totalExpensesCount = expenseRepository.count();
        BigDecimal totalExpensesAmount = expenseRepository.sumTotalExpensesAmount();
        BigDecimal totalIncomesAmount = incomeRepository.sumTotalIncomesAmount();

        if (totalExpensesAmount == null) totalExpensesAmount = BigDecimal.ZERO;
        if (totalIncomesAmount == null) totalIncomesAmount = BigDecimal.ZERO;

        long activeUsers = Math.max(0, totalUsers - lockedUsers);

        String dbType = "Unknown";
        String dbStatus = "HEALTHY";
        try (Connection conn = dataSource.getConnection()) {
            dbType = conn.getMetaData().getDatabaseProductName();
        } catch (Exception e) {
            dbStatus = "DEGRADED: " + e.getMessage();
        }

        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        // Upsert into platform_daily_metrics
        PlatformDailyMetrics daily = dailyMetricsRepository.findById(today)
                .orElse(PlatformDailyMetrics.builder().metricDate(today).build());
        daily.setTotalUsers(totalUsers);
        daily.setActiveUsers(activeUsers);
        daily.setTotalExpensesCount(totalExpensesCount);
        daily.setTotalExpensesAmount(totalExpensesAmount);
        daily.setTotalIncomesAmount(totalIncomesAmount);
        daily.setUpdatedAt(now);
        dailyMetricsRepository.save(daily);

        cachedSummary = new AdminSummaryMetricsDto(
                totalUsers,
                lockedUsers,
                totalExpensesCount,
                totalExpensesAmount,
                totalIncomesAmount,
                activeUsers,
                dbStatus,
                dbType,
                virtualThreadsConfigured,
                now
        );

        long duration = System.currentTimeMillis() - startTime;
        log.debug("Admin metrics pre-aggregation completed in {}ms: users={}, expenses={}",
                duration, totalUsers, totalExpensesCount);
    }

    @Override
    public AdminSummaryMetricsDto getSummaryMetrics() {
        if (cachedSummary == null) {
            refreshMetrics();
        }
        return cachedSummary;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminVolumeTrendDto> getVolumeTrends(int days) {
        if (days <= 0 || days > 365) {
            days = 30;
        }
        LocalDate startDate = LocalDate.now().minusDays(days);
        List<PlatformDailyMetrics> metrics = dailyMetricsRepository.findTrendsSince(startDate);

        if (metrics.isEmpty() && cachedSummary != null) {
            // Provide current point if historical table is newly initialized
            return List.of(new AdminVolumeTrendDto(
                    LocalDate.now(),
                    cachedSummary.totalUsers(),
                    cachedSummary.totalExpensesCount(),
                    cachedSummary.totalExpensesAmount(),
                    cachedSummary.totalIncomesAmount()
            ));
        }

        List<AdminVolumeTrendDto> dtos = new ArrayList<>();
        for (PlatformDailyMetrics m : metrics) {
            dtos.add(new AdminVolumeTrendDto(
                    m.getMetricDate(),
                    m.getTotalUsers(),
                    m.getTotalExpensesCount(),
                    m.getTotalExpensesAmount(),
                    m.getTotalIncomesAmount()
            ));
        }
        return dtos;
    }
}
