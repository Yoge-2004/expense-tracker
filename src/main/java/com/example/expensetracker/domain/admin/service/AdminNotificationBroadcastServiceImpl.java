package com.example.expensetracker.domain.admin.service;

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

import com.example.expensetracker.domain.admin.dto.AdminBroadcastRequest;
import com.example.expensetracker.domain.admin.dto.AdminBroadcastResultDto;
import com.example.expensetracker.domain.notification.model.NotificationType;
import com.example.expensetracker.domain.notification.service.NotificationService;
import com.example.expensetracker.domain.notification.service.PendingNotification;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.infrastructure.exception.BadRequestException;
import com.example.expensetracker.infrastructure.security.StepUpPinVerifier;



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

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.core.task.TaskExecutor taskExecutor;

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

        java.util.concurrent.atomic.AtomicInteger targeted = new java.util.concurrent.atomic.AtomicInteger(0);
        java.util.concurrent.atomic.AtomicInteger successCount = new java.util.concurrent.atomic.AtomicInteger(0);
        java.util.concurrent.atomic.AtomicInteger failedCount = new java.util.concurrent.atomic.AtomicInteger(0);
        String broadcastId = "admin-broadcast-" + UUID.randomUUID();
        String route = request.route() != null && !request.route().isBlank() ? request.route() : "/dashboard";
        java.util.concurrent.Executor executor = taskExecutor != null ? taskExecutor : Runnable::run;

        Pageable pageable = PageRequest.of(0, BATCH_SIZE, Sort.by("id"));
        Page<User> page;
        do {
            page = userRepository.findAll(pageable);
            java.util.List<java.util.concurrent.CompletableFuture<Void>> futures = new java.util.ArrayList<>();
            for (User u : page.getContent()) {
                if (!matchesAudience(u, audience)) {
                    continue;
                }
                targeted.incrementAndGet();
                futures.add(java.util.concurrent.CompletableFuture.runAsync(() -> {
                    try {
                        PendingNotification pending = new PendingNotification(
                                NotificationType.SYSTEM,
                                request.title(),
                                request.message(),
                                route,
                                broadcastId + "-user-" + u.getId()
                        );
                        if (notificationService.notify(u, pending)) {
                            successCount.incrementAndGet();
                        } else {
                            failedCount.incrementAndGet();
                        }
                    } catch (Exception ex) {
                        log.warn("Failed to dispatch broadcast to user {}: {}", u.getId(), ex.getMessage());
                        failedCount.incrementAndGet();
                    }
                }, executor));
            }
            java.util.concurrent.CompletableFuture.allOf(futures.toArray(java.util.concurrent.CompletableFuture[]::new)).join();
            pageable = page.nextPageable();
        } while (page.hasNext());

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "BROADCAST_ANNOUNCEMENT",
                "NOTIFICATION",
                audience,
                String.format("Title: '%s', Targeted: %d, Success: %d, Failed: %d",
                        request.title(), targeted.get(), successCount.get(), failedCount.get()),
                ipAddress,
                userAgent
        );

        log.info("Broadcast '{}' completed: targeted={}, sent={}", request.title(), targeted.get(), successCount.get());

        return new AdminBroadcastResultDto(targeted.get(), successCount.get(), failedCount.get(), "COMPLETED");
    }

    private static boolean matchesAudience(User user, String audience) {
        return switch (audience) {
            case "ACTIVE" -> user.isEnabled() && !user.isAccountLocked();
            case "ADMINS" -> user.isAdmin();
            default -> true;
        };
    }
}
