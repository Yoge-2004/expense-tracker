package com.example.expensetracker.domain.ai.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.ai.repository.MlFeedbackRepository;

/**
 * Deletes ML feedback rows submitted by a user.
 */
@Component
@RequiredArgsConstructor
public class AiUserCleanupParticipant implements UserCleanupParticipant {

    private final MlFeedbackRepository mlFeedbackRepository;

    @Override
    public int order() {
        return 30;
    }

    @Override
    public void cleanupForUser(Long userId, String email) {
        if (userId != null) {
            mlFeedbackRepository.deleteByUserId(userId);
        }
    }
}
