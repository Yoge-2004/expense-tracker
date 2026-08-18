package com.example.expensetracker.service;

import com.example.expensetracker.dto.MonthlyReportDto;

public interface MonthlyReportService {
    MonthlyReportDto generateMonthlyReport(Long userId, int year, int month);
    void sendMonthlyReportEmail(Long userId, int year, int month);
    void sendAutomatedMonthlyReports();

    /**
     * Renders the same HTML template used for the emailed monthly report, for
     * cases where email delivery is disabled and the report should instead be
     * downloaded directly by the client as a standalone .html file.
     */
    String generateMonthlyReportHtml(Long userId, int year, int month);
}
