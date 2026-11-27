package com.example.expensetracker.domain.expense.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;

/**
 * Deletes one-off and recurring expense records for a user before categories are removed.
 */
@Component
@RequiredArgsConstructor
public class ExpenseUserCleanupParticipant implements UserCleanupParticipant {

    private final ExpenseRepository expenseRepository;
    private final RecurringExpenseRepository recurringExpenseRepository;

    @Override
    public int order() {
        return 60;
    }

    @Override
    public void cleanupForUser(Long userId, String email) {
        if (userId == null) return;
        expenseRepository.deleteByUserId(userId);
        recurringExpenseRepository.deleteByUserId(userId);
    }
}
