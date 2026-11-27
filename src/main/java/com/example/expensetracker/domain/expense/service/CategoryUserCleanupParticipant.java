package com.example.expensetracker.domain.expense.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;

/**
 * Deletes user-owned categories after all dependent expenses, recurring subscriptions, and budgets are removed.
 */
@Component
@RequiredArgsConstructor
public class CategoryUserCleanupParticipant implements UserCleanupParticipant {

    private final CategoryRepository categoryRepository;

    @Override
    public int order() {
        return 100;
    }

    @Override
    public void cleanupForUser(Long userId, String email) {
        if (userId != null) {
            categoryRepository.deleteByUserId(userId);
        }
    }
}
