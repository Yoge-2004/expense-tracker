package com.example.expensetracker.domain.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import com.example.expensetracker.domain.notification.repository.AppNotificationRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;



/**
 * Runs the notification detectors on a schedule. Times are in {@code app.notifications.zone}
 * (default Asia/Kolkata) so "9 in the morning" means the user's morning, not the server's.
 * Set {@code app.notifications.scheduler.enabled=false} to switch every job off.
 */
@Slf4j
@Component
public class NotificationScheduler {

    private static final int KEEP_DAYS = 90;


    /** Users read per query by the scheduled runs. */

    private static final int USER_PAGE_SIZE = 200;

    private final UserRepository userRepository;
    private final NotificationDetector detector;
    private final NotificationService notificationService;
    private final AppNotificationRepository notificationRepository;
    private final TaskExecutor taskExecutor;
    private final Clock clock;

    @Value("${app.notifications.zone:Asia/Kolkata}")
    private String zone;

    @Value("${app.notifications.scheduler.enabled:true}")
    private boolean enabled;

    /** Most users processed at once; keep it below the database pool size so live requests still get connections. */
    @Value("${app.async.batch-concurrency:4}")
    private int batchConcurrency = 4;

    public NotificationScheduler(
            UserRepository userRepository,
            NotificationDetector detector,
            NotificationService notificationService,
            AppNotificationRepository notificationRepository) {
        this(userRepository, detector, notificationService, notificationRepository, null, null);
    }

    @Autowired
    public NotificationScheduler(
            UserRepository userRepository,
            NotificationDetector detector,
            NotificationService notificationService,
            AppNotificationRepository notificationRepository,
            @Autowired(required = false) TaskExecutor taskExecutor,
            @Autowired(required = false) Clock clock) {
        this.userRepository = userRepository;
        this.detector = detector;
        this.notificationService = notificationService;
        this.notificationRepository = notificationRepository;
        this.taskExecutor = taskExecutor;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

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
            long removed = notificationRepository.deleteByCreatedAtBefore(LocalDateTime.now(clock).minusDays(KEEP_DAYS));
            log.info("Removed {} notifications older than {} days", removed, KEEP_DAYS);
        }
    }

    /** @return how many notifications were created */
    int process(LocalDate today, boolean weekly) {
        java.util.concurrent.atomic.AtomicInteger created = new java.util.concurrent.atomic.AtomicInteger(0);
        java.util.concurrent.Executor executor = taskExecutor != null ? taskExecutor : Runnable::run;
        // Users are read a page at a time so memory and query size stay flat as the user base grows.
        Pageable pageable = PageRequest.of(0, USER_PAGE_SIZE, Sort.by("id"));
        Page<User> page;
        do {
            page = userRepository.findAll(pageable);
            com.example.expensetracker.infrastructure.concurrent.BoundedFanOut.forEach(
                page.getContent(), batchConcurrency, executor, user -> {
                try {
                    List<PendingNotification> due = weekly
                            ? detector.detectWeeklyDigest(user, today)
                            : detector.detectDaily(user, today);
                    for (PendingNotification notification : due) {
                        if (notificationService.notify(user, notification)) {
                            created.incrementAndGet();
                        }
                    }
                } catch (Exception e) {
                    // One account's problem must never stop everyone else's notifications.
                    log.warn("Notification run failed for userId={}: {}", user.getId(), e.getMessage());
                }
                });
            pageable = page.nextPageable();
        } while (page.hasNext());
        return created.get();
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(ZoneId.of(zone)));
    }
}
