package com.example.expensetracker.service;

import com.example.expensetracker.dto.MonthlyReportDto;

public interface MonthlyReportService {
    MonthlyReportDto generateMonthlyReport(Long userId, int year, int month);
    void sendMonthlyReportEmail(Long userId, int year, int month);
    void sendAutomatedMonthlyReports();
}
