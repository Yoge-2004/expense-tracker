package com.example.expensetracker.service;

import com.example.expensetracker.dto.MonthlyReportDto;

/**
 * Service interface for generating and dispatching monthly executive financial reports.
 *
 * <p>Supports generating detailed financial intelligence reports spanning expenses, incomes,
 * net savings, category allocations, budget adherence, and savings milestones. Provides both
 * JSON DTO representations and responsive executive HTML document generation for direct download
 * or scheduled email distribution.</p>
 *
 * @author Yogeshwaran
 */
public interface MonthlyReportService {

    /**
     * Generates a consolidated monthly financial report DTO for the specified user and period.
     *
     * @param userId the ID of the user
     * @param year the 4-digit calendar year (e.g. 2026)
     * @param month the month number (1-12)
     * @return the populated {@link MonthlyReportDto}
     * @throws IllegalArgumentException if the user does not exist
     */
    MonthlyReportDto generateMonthlyReport(Long userId, int year, int month);

    /**
     * Generates and dispatches the monthly executive financial report via HTML email.
     * If mail delivery is disabled, records the dispatch attempt in the audit log.
     *
     * @param userId the ID of the recipient user
     * @param year the 4-digit calendar year
     * @param month the month number (1-12)
     */
    void sendMonthlyReportEmail(Long userId, int year, int month);

    /**
     * Scheduled task that checks for all users with pending unsent monthly financial reports
     * for the preceding calendar month and automatically dispatches them.
     */
    void sendAutomatedMonthlyReports();

    /**
     * Renders the executive HTML template for the monthly financial report,
     * allowing the client to download the report as a standalone .html document.
     *
     * @param userId the ID of the user
     * @param year the 4-digit calendar year
     * @param month the month number (1-12)
     * @return rendered HTML string
     * @throws IllegalArgumentException if the user does not exist
     */
    String generateMonthlyReportHtml(Long userId, int year, int month);
}
