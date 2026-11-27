package com.example.expensetracker.domain.report.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.report.repository.MonthlyReportLogRepository;

/**
 * Deletes monthly report delivery logs for a user.
 */
@Component
@RequiredArgsConstructor
public class ReportUserCleanupParticipant implements UserCleanupParticipant {

    private final MonthlyReportLogRepository monthlyReportLogRepository;

    @Override
    public int order() {
        return 50;
    }

    @Override
    public void cleanupForUser(Long userId, String email) {
        if (userId != null) {
            monthlyReportLogRepository.deleteByUserId(userId);
        }
    }
}
