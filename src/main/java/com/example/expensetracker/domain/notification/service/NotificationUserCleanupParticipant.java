package com.example.expensetracker.domain.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.notification.repository.AppNotificationRepository;
import com.example.expensetracker.domain.notification.repository.DeviceTokenRepository;
import com.example.expensetracker.domain.notification.repository.NotificationPreferenceRepository;

/**
 * Deletes notification inbox items, registered push device tokens, and notification preferences for a user.
 */
@Component
@RequiredArgsConstructor
public class NotificationUserCleanupParticipant implements UserCleanupParticipant {

    private final AppNotificationRepository appNotificationRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final NotificationPreferenceRepository notificationPreferenceRepository;

    @Override
    public int order() {
        return 10;
    }

    @Override
    public void cleanupForUser(Long userId, String email) {
        if (userId == null) return;
        appNotificationRepository.deleteByUserId(userId);
        deviceTokenRepository.deleteByUserId(userId);
        notificationPreferenceRepository.deleteByUserId(userId);
    }
}
