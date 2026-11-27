package com.example.expensetracker.domain.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.loan.repository.LoanAdjustmentRepository;

/**
 * Deletes loan and split-adjustment records before expenses are removed.
 */
@Component
@RequiredArgsConstructor
public class LoanUserCleanupParticipant implements UserCleanupParticipant {

    private final LoanAdjustmentRepository loanAdjustmentRepository;

    @Override
    public int order() {
        return 20;
    }

    @Override
    public void cleanupForUser(Long userId, String email) {
        if (userId != null) {
            loanAdjustmentRepository.deleteByUserId(userId);
        }
    }
}
