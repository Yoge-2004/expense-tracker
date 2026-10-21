package com.example.expensetracker.service;

import com.example.expensetracker.model.DeviceToken;
import com.example.expensetracker.model.NotificationType;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.DeviceTokenRepository;
import com.example.expensetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

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

    int announce(AppReleaseService.Release release) {
        int notified = 0;
        for (User user : userRepository.findAll()) {
            try {
                List<DeviceToken> due = deviceTokenRepository.findByUser(user).stream()
                        .filter(device -> needsNotice(device, release))
                        .toList();
                if (due.isEmpty()) {
                    continue;
                }
                Set<Long> dueIds = new HashSet<>();
                due.forEach(device -> dueIds.add(device.getId()));

                PendingNotification notice = new PendingNotification(
                        NotificationType.APP_UPDATE,
                        "Update available",
                        "Expense Tracker " + release.tag() + " is ready. Open the app to update.",
                        "app-update",
                        "app-update:" + release.version());
                if (notificationService.notifyDevices(user, notice, device -> dueIds.contains(device.getId()))) {
                    due.forEach(device -> device.setUpdateAnnouncedVersion(release.version()));
                    deviceTokenRepository.saveAll(due);
                    notified++;
                }
            } catch (RuntimeException e) {
                log.warn("Could not send the app update notice for userId={}: {}", user.getId(), e.getMessage());
            }
        }
        return notified;
    }

    /** True when this phone is behind the release and has not been told about it yet. */
    static boolean needsNotice(DeviceToken device, AppReleaseService.Release release) {
        String installed = device.getAppVersion();
        boolean behind = installed == null || installed.isBlank() || AppVersion.isNewer(installed, release.version());
        return behind && !release.version().equals(device.getUpdateAnnouncedVersion());
    }
}
