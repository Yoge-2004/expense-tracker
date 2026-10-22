package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.AdminBroadcastRequest;
import com.example.expensetracker.dto.AdminBroadcastResultDto;
import com.example.expensetracker.exception.BadRequestException;
import com.example.expensetracker.model.NotificationType;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.AdminAuditService;
import com.example.expensetracker.service.AdminNotificationBroadcastService;
import com.example.expensetracker.service.NotificationService;
import com.example.expensetracker.service.PendingNotification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Implementation of {@link AdminNotificationBroadcastService}.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminNotificationBroadcastServiceImpl implements AdminNotificationBroadcastService {

    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AdminAuditService auditService;
    private final PasswordEncoder passwordEncoder;

    @Override
    public AdminBroadcastResultDto broadcastAnnouncement(AdminBroadcastRequest request,
                                                         User actor,
                                                         String ipAddress,
                                                         String userAgent) {
        if (actor.getSecurityPinHash() == null || actor.getSecurityPinHash().isBlank()) {
            throw new BadRequestException("You must configure a Security PIN before sending broadcast announcements");
        }
        if (!passwordEncoder.matches(request.stepUpPin(), actor.getSecurityPinHash())) {
            throw new BadRequestException("Invalid step-up Security PIN. Verification failed.");
        }

        List<User> targetUsers = userRepository.findAll();
        String audience = request.targetAudience() != null ? request.targetAudience().toUpperCase() : "ALL";

        if ("ACTIVE".equals(audience)) {
            targetUsers = targetUsers.stream().filter(u -> u.isEnabled() && !u.isAccountLocked()).toList();
        } else if ("ADMINS".equals(audience)) {
            targetUsers = targetUsers.stream().filter(User::isAdmin).toList();
        }

        int successCount = 0;
        int failedCount = 0;
        String broadcastId = "admin-broadcast-" + UUID.randomUUID();

        for (User u : targetUsers) {
            try {
                String dedupeKey = broadcastId + "-user-" + u.getId();
                PendingNotification pending = new PendingNotification(
                        NotificationType.SYSTEM,
                        request.title(),
                        request.message(),
                        request.route() != null ? request.route() : "/dashboard",
                        dedupeKey
                );
                boolean sent = notificationService.notify(u, pending);
                if (sent) {
                    successCount++;
                } else {
                    failedCount++;
                }
            } catch (Exception ex) {
                log.warn("Failed to dispatch broadcast to user {}: {}", u.getId(), ex.getMessage());
                failedCount++;
            }
        }

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "BROADCAST_ANNOUNCEMENT",
                "NOTIFICATION",
                audience,
                String.format("Title: '%s', Targeted: %d, Success: %d, Failed: %d",
                        request.title(), targetUsers.size(), successCount, failedCount),
                ipAddress,
                userAgent
        );

        log.info("Broadcast '{}' completed: targeted={}, sent={}", request.title(), targetUsers.size(), successCount);

        return new AdminBroadcastResultDto(
                targetUsers.size(),
                successCount,
                failedCount,
                "COMPLETED"
        );
    }
}
