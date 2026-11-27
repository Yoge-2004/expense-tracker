package com.example.expensetracker.domain.admin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.example.expensetracker.domain.admin.dto.AdminSummaryMetricsDto;
import com.example.expensetracker.domain.admin.dto.AdminVolumeTrendDto;
import com.example.expensetracker.domain.admin.model.PlatformDailyMetrics;
import com.example.expensetracker.domain.admin.repository.PlatformDailyMetricsRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.repository.UserRepository;

/**
 * High-performance metrics service using asynchronous background rollups
 * and in-memory caching to guarantee zero latency penalty on OLTP queries.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
public class AdminMetricsServiceImpl implements AdminMetricsService {

    private final UserRepository userRepository;
    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final PlatformDailyMetricsRepository dailyMetricsRepository;
    private final DataSource dataSource;
    private final ObjectProvider<AdminMetricsService> selfProvider;
    private final TaskExecutor taskExecutor;

    @Value("${spring.threads.virtual.enabled:false}")
    private boolean virtualThreadsConfigured;

    private volatile AdminSummaryMetricsDto cachedSummary;

    @Autowired
    public AdminMetricsServiceImpl(
            UserRepository userRepository,
            ExpenseRepository expenseRepository,
            IncomeRepository incomeRepository,
            PlatformDailyMetricsRepository dailyMetricsRepository,
            DataSource dataSource,
            ObjectProvider<AdminMetricsService> selfProvider,
            @Autowired(required = false) TaskExecutor taskExecutor) {
        this.userRepository = userRepository;
        this.expenseRepository = expenseRepository;
        this.incomeRepository = incomeRepository;
        this.dailyMetricsRepository = dailyMetricsRepository;
        this.dataSource = dataSource;
        this.selfProvider = selfProvider;
        this.taskExecutor = taskExecutor;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Initializing AdminMetricsService with initial pre-aggregation rollup");
        try {
            refreshViaProxy();
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
        long startNanos = System.nanoTime();
        java.util.concurrent.Executor executor = taskExecutor != null ? taskExecutor : Runnable::run;

        var totalUsersFuture = java.util.concurrent.CompletableFuture.supplyAsync(userRepository::count, executor);
        var lockedUsersFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> userRepository.countByAccountLocked(true), executor);
        var totalExpensesCountFuture = java.util.concurrent.CompletableFuture.supplyAsync(expenseRepository::count, executor);
        var totalExpensesAmountFuture = java.util.concurrent.CompletableFuture.supplyAsync(expenseRepository::sumTotalExpensesAmount, executor);
        var totalIncomesAmountFuture = java.util.concurrent.CompletableFuture.supplyAsync(incomeRepository::sumTotalIncomesAmount, executor);

        java.util.concurrent.CompletableFuture.allOf(
                totalUsersFuture, lockedUsersFuture, totalExpensesCountFuture,
                totalExpensesAmountFuture, totalIncomesAmountFuture
        ).join();

        long totalUsers = totalUsersFuture.join();
        long lockedUsers = lockedUsersFuture.join();
        long totalExpensesCount = totalExpensesCountFuture.join();
        BigDecimal totalExpensesAmount = java.util.Objects.requireNonNullElse(totalExpensesAmountFuture.join(), BigDecimal.ZERO);
        BigDecimal totalIncomesAmount = java.util.Objects.requireNonNullElse(totalIncomesAmountFuture.join(), BigDecimal.ZERO);

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

        long duration = (System.nanoTime() - startNanos) / 1_000_000;
        log.debug("Admin metrics pre-aggregation completed in {}ms: users={}, expenses={}",
                duration, totalUsers, totalExpensesCount);
    }

    @Override
    public AdminSummaryMetricsDto getSummaryMetrics() {
        if (cachedSummary == null) {
            synchronized (this) {
                if (cachedSummary == null) {
                    refreshViaProxy();
                }
            }
        }
        return cachedSummary;
    }

    private void refreshViaProxy() {
        AdminMetricsService proxy = selfProvider != null ? selfProvider.getIfAvailable() : null;
        if (proxy != null) {
            proxy.refreshMetrics();
        } else {
            refreshMetrics();
        }
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

        return metrics.stream()
                .map(m -> new AdminVolumeTrendDto(
                        m.getMetricDate(),
                        m.getTotalUsers(),
                        m.getTotalExpensesCount(),
                        m.getTotalExpensesAmount(),
                        m.getTotalIncomesAmount()
                ))
                .toList();
    }
}
