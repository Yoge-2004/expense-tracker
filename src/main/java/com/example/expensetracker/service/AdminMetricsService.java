package com.example.expensetracker.service;

import com.example.expensetracker.dto.AdminSummaryMetricsDto;
import com.example.expensetracker.dto.AdminVolumeTrendDto;

import java.util.List;

/**
 * Service for computing, caching, and serving administrative platform metrics.
 *
 * @author Yogeshwaran
 */
public interface AdminMetricsService {

    AdminSummaryMetricsDto getSummaryMetrics();

    List<AdminVolumeTrendDto> getVolumeTrends(int days);

    void refreshMetrics();
}
