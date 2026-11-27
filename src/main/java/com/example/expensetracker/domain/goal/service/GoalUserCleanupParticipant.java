package com.example.expensetracker.domain.goal.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;

/**
 * Deletes savings goals for a user.
 */
@Component
@RequiredArgsConstructor
public class GoalUserCleanupParticipant implements UserCleanupParticipant {

    private final SavingsGoalRepository savingsGoalRepository;

    @Override
    public int order() {
        return 90;
    }

    @Override
    public void cleanupForUser(Long userId, String email) {
        if (userId != null) {
            savingsGoalRepository.deleteByUserId(userId);
        }
    }
}
