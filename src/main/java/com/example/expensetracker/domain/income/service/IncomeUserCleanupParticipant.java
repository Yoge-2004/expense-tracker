package com.example.expensetracker.domain.income.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.income.repository.IncomeRepository;

/**
 * Deletes income entries for a user.
 */
@Component
@RequiredArgsConstructor
public class IncomeUserCleanupParticipant implements UserCleanupParticipant {

    private final IncomeRepository incomeRepository;

    @Override
    public int order() {
        return 70;
    }

    @Override
    public void cleanupForUser(Long userId, String email) {
        if (userId != null) {
            incomeRepository.deleteByUserId(userId);
        }
    }
}
