package com.example.expensetracker.domain.admin.service;

import java.util.List;

import com.example.expensetracker.domain.admin.dto.AdminSummaryMetricsDto;
import com.example.expensetracker.domain.admin.dto.AdminVolumeTrendDto;



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
