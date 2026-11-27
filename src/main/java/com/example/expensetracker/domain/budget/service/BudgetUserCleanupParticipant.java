package com.example.expensetracker.domain.budget.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;

/**
 * Deletes budgets for a user before custom categories are removed.
 */
@Component
@RequiredArgsConstructor
public class BudgetUserCleanupParticipant implements UserCleanupParticipant {

    private final BudgetRepository budgetRepository;

    @Override
    public int order() {
        return 80;
    }

    @Override
    public void cleanupForUser(Long userId, String email) {
        if (userId != null) {
            budgetRepository.deleteByUserId(userId);
        }
    }
}
