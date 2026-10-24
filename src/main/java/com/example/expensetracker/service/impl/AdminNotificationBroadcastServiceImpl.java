package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.AdminBroadcastRequest;
import com.example.expensetracker.dto.AdminBroadcastResultDto;
import com.example.expensetracker.exception.BadRequestException;
import com.example.expensetracker.model.NotificationType;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.security.StepUpPinVerifier;
import com.example.expensetracker.service.AdminAuditService;
import com.example.expensetracker.service.AdminNotificationBroadcastService;
import com.example.expensetracker.service.NotificationService;
import com.example.expensetracker.service.PendingNotification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Implementation of {@link AdminNotificationBroadcastService}.
 *
 * <p>Users are read in fixed-size pages so a large user base is never loaded into memory at once.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminNotificationBroadcastServiceImpl implements AdminNotificationBroadcastService {

    private static final int BATCH_SIZE = 200;
    private static final Set<String> AUDIENCES = Set.of("ALL", "ACTIVE", "ADMINS");

    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AdminAuditService auditService;
    private final StepUpPinVerifier stepUpPinVerifier;

    @Override
    public AdminBroadcastResultDto broadcastAnnouncement(AdminBroadcastRequest request,
                                                         User actor,
                                                         String ipAddress,
                                                         String userAgent) {
        stepUpPinVerifier.verify(actor, request.stepUpPin());

        String audience = request.targetAudience() == null || request.targetAudience().isBlank()
                ? "ALL"
                : request.targetAudience().trim().toUpperCase(Locale.ROOT);
        if (!AUDIENCES.contains(audience)) {
            throw new BadRequestException("Unknown audience '" + request.targetAudience()
                    + "'. Use ALL, ACTIVE or ADMINS.");
        }

        int targeted = 0;
        int successCount = 0;
        int failedCount = 0;
        String broadcastId = "admin-broadcast-" + UUID.randomUUID();
        String route = request.route() != null && !request.route().isBlank() ? request.route() : "/dashboard";

        Pageable pageable = PageRequest.of(0, BATCH_SIZE, Sort.by("id"));
        Page<User> page;
        do {
            page = userRepository.findAll(pageable);
            for (User u : page.getContent()) {
                if (!matchesAudience(u, audience)) {
                    continue;
                }
                targeted++;
                try {
                    PendingNotification pending = new PendingNotification(
                            NotificationType.SYSTEM,
                            request.title(),
                            request.message(),
                            route,
                            broadcastId + "-user-" + u.getId()
                    );
                    if (notificationService.notify(u, pending)) {
                        successCount++;
                    } else {
                        failedCount++;
                    }
                } catch (Exception ex) {
                    log.warn("Failed to dispatch broadcast to user {}: {}", u.getId(), ex.getMessage());
                    failedCount++;
                }
            }
            pageable = page.nextPageable();
        } while (page.hasNext());

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "BROADCAST_ANNOUNCEMENT",
                "NOTIFICATION",
                audience,
                String.format("Title: '%s', Targeted: %d, Success: %d, Failed: %d",
                        request.title(), targeted, successCount, failedCount),
                ipAddress,
                userAgent
        );

        log.info("Broadcast '{}' completed: targeted={}, sent={}", request.title(), targeted, successCount);

        return new AdminBroadcastResultDto(targeted, successCount, failedCount, "COMPLETED");
    }

    private static boolean matchesAudience(User user, String audience) {
        return switch (audience) {
            case "ACTIVE" -> user.isEnabled() && !user.isAccountLocked();
            case "ADMINS" -> user.isAdmin();
            default -> true;
        };
    }
}
