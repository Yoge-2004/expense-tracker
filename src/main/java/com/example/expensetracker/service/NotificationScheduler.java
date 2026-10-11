package com.example.expensetracker.service;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.AppNotificationRepository;
import com.example.expensetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Runs the notification detectors on a schedule. Times are in {@code app.notifications.zone}
 * (default Asia/Kolkata) so "9 in the morning" means the user's morning, not the server's.
 * Set {@code app.notifications.scheduler.enabled=false} to switch every job off.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationScheduler {

    private static final int KEEP_DAYS = 90;

    private final UserRepository userRepository;
    private final NotificationDetector detector;
    private final NotificationService notificationService;
    private final AppNotificationRepository notificationRepository;

    @Value("${app.notifications.zone:Asia/Kolkata}")
    private String zone;

    @Value("${app.notifications.scheduler.enabled:true}")
    private boolean enabled;

    /** Budgets, bills, goals and large expenses, every morning. */
    @Scheduled(cron = "0 0 9 * * *", zone = "${app.notifications.zone:Asia/Kolkata}")
    public void runDaily() {
        if (enabled) {
            log.info("Daily notifications: {} created", process(today(), false));
        }
    }

    /** The weekly summary, Sunday evening. */
    @Scheduled(cron = "0 0 18 * * SUN", zone = "${app.notifications.zone:Asia/Kolkata}")
    public void runWeekly() {
        if (enabled) {
            log.info("Weekly digests: {} created", process(today(), true));
        }
    }

    /** Notifications older than {@value #KEEP_DAYS} days are removed. */
    @Scheduled(cron = "0 30 3 * * *", zone = "${app.notifications.zone:Asia/Kolkata}")
    public void purgeOld() {
        if (enabled) {
            long removed = notificationRepository.deleteByCreatedAtBefore(LocalDateTime.now().minusDays(KEEP_DAYS));
            log.info("Removed {} notifications older than {} days", removed, KEEP_DAYS);
        }
    }

    /** @return how many notifications were created */
    int process(LocalDate today, boolean weekly) {
        int created = 0;
        List<User> users = userRepository.findAll();
        for (User user : users) {
            try {
                List<PendingNotification> due = weekly
                        ? detector.detectWeeklyDigest(user, today)
                        : detector.detectDaily(user, today);
                for (PendingNotification notification : due) {
                    if (notificationService.notify(user, notification)) {
                        created++;
                    }
                }
            } catch (Exception e) {
                // One account's problem must never stop everyone else's notifications.
                log.warn("Notification run failed for userId={}: {}", user.getId(), e.getMessage());
            }
        }
        return created;
    }

    private LocalDate today() {
        return LocalDate.now(ZoneId.of(zone));
    }
}
