package com.example.expensetracker.repository;

import com.example.expensetracker.model.PlatformDailyMetrics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Repository for pre-aggregated platform metrics.
 *
 * @author Yogeshwaran
 */
@Repository
public interface PlatformDailyMetricsRepository extends JpaRepository<PlatformDailyMetrics, LocalDate> {

    Optional<PlatformDailyMetrics> findFirstByOrderByMetricDateDesc();

    @Query("SELECT m FROM PlatformDailyMetrics m WHERE m.metricDate >= :startDate ORDER BY m.metricDate ASC")
    List<PlatformDailyMetrics> findTrendsSince(LocalDate startDate);
}
