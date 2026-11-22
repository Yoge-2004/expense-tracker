package com.example.expensetracker.domain.report.service;

import com.example.expensetracker.domain.user.model.User;

/**
 * Service contract for aggregating multi-domain executive financial report data.
 * Adheres to SRP and DIP by decoupling data layer orchestration from presentation controllers.
 *
 * @author Yogeshwaran
 */
public interface ExecutiveReportService {

    /**
     * Loads aggregated financial report records for a given user across the specified date range.
     *
     * @param user the authenticated user
     * @param range the date range for expenses and incomes
     * @return assembled {@link ExecutiveReportData}
     */
    ExecutiveReportData loadReportData(User user, ExecutiveReportDateRange range);
}
