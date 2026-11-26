package com.example.expensetracker.domain.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.notification.model.DeviceToken;
import com.example.expensetracker.domain.notification.model.NotificationType;
import com.example.expensetracker.domain.notification.repository.DeviceTokenRepository;
import com.example.expensetracker.domain.notification.service.NotificationService;
import com.example.expensetracker.domain.notification.service.PendingNotification;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;



/**
 * Tells people with the mobile app installed when a newer version has been published, even while the app is closed.
 *
 * <p>Every few hours it looks up the latest release. A phone is told once per release, and only if it is behind: a
 * phone that reports an older app version, or no version (apps from before versions were reported, which are
 * necessarily older than any release carrying this feature). The notice is stored in the notification inbox and
 * pushed to just those phones. Users can switch the "App updates" kind off in their notification settings.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AppUpdateNotifier {

    private final AppReleaseService releases;
    private final UserRepository userRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final NotificationService notificationService;

    /** Users read per query when announcing a release. */
    private static final int USER_PAGE_SIZE = 200;

    @Value("${app.release.notify.enabled:true}")
    private boolean enabled;

    @Value("${app.notifications.scheduler.enabled:true}")
    private boolean schedulerEnabled;

    @Scheduled(cron = "0 15 */6 * * *", zone = "${app.notifications.zone:Asia/Kolkata}")
    public void check() {
        if (!enabled || !schedulerEnabled) {
            return;
        }
        int sent = announce();
        if (sent > 0) {
            log.info("App update notice sent to {} user(s).", sent);
        }
    }

    /** Looks up the latest release and announces it; returns how many users were notified. */
    int announce() {
        Optional<AppReleaseService.Release> latest = releases.latest();
        return latest.map(this::announce).orElse(0);
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.core.task.TaskExecutor taskExecutor;

    /** Most users processed at once; keep it below the database pool size so live requests still get connections. */
    @org.springframework.beans.factory.annotation.Value("${app.async.batch-concurrency:4}")
    private int batchConcurrency = 4;

    int announce(AppReleaseService.Release release) {
        java.util.concurrent.atomic.AtomicInteger notified = new java.util.concurrent.atomic.AtomicInteger(0);
        java.util.concurrent.Executor executor = taskExecutor != null ? taskExecutor : Runnable::run;
        // Users are read a page at a time so memory and query size stay flat as the user base grows.
        Pageable pageable = PageRequest.of(0, USER_PAGE_SIZE, Sort.by("id"));
        Page<User> page;
        do {
            page = userRepository.findAll(pageable);
            com.example.expensetracker.infrastructure.concurrent.BoundedFanOut.forEach(
                page.getContent(), batchConcurrency, executor, user -> {
                try {
                    List<DeviceToken> due = deviceTokenRepository.findByUser(user).stream()
                            .filter(device -> needsNotice(device, release))
                            .toList();
                    if (due.isEmpty()) {
                        return;
                    }
                    Set<Long> dueIds = due.stream()
                            .map(DeviceToken::getId)
                            .collect(java.util.stream.Collectors.toUnmodifiableSet());

                    PendingNotification notice = new PendingNotification(
                            NotificationType.APP_UPDATE,
                            "Update available",
                            "Expense Tracker " + release.tag() + " is ready. Open the app to update.",
                            "app-update",
                            "app-update:" + release.version());
                    if (notificationService.notifyDevices(user, notice, device -> dueIds.contains(device.getId()))) {
                        due.forEach(device -> device.setUpdateAnnouncedVersion(release.version()));
                        deviceTokenRepository.saveAll(due);
                        notified.incrementAndGet();
                    }
                } catch (RuntimeException e) {
                    log.warn("Could not send the app update notice for userId={}: {}", user.getId(), e.getMessage());
                }
                });
            pageable = page.nextPageable();
        } while (page.hasNext());
        return notified.get();
    }

    /** True when this phone is behind the release and has not been told about it yet. */
    static boolean needsNotice(DeviceToken device, AppReleaseService.Release release) {
        String installed = device.getAppVersion();
        boolean behind = installed == null || installed.isBlank() || AppVersion.isNewer(installed, release.version());
        return behind && !release.version().equals(device.getUpdateAnnouncedVersion());
    }
}
