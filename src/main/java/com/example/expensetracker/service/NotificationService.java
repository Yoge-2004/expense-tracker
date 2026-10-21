package com.example.expensetracker.service;

import com.example.expensetracker.dto.NotificationInboxDto;
import com.example.expensetracker.dto.NotificationPreferenceDto;
import com.example.expensetracker.model.DeviceToken;
import com.example.expensetracker.model.User;

import java.util.List;
import java.util.function.Predicate;

public interface NotificationService {

    /**
     * Stores a notification and pushes it to the user's phones, unless the user switched that kind off
     * or the same event was already notified.
     *
     * @return true when a notification was created
     */
    boolean notify(User user, PendingNotification notification);

    /**
     * Like {@link #notify}, but the push goes only to the user's phones that {@code devices} accepts. The inbox
     * entry is created once either way. Used when only some of a user's phones need to hear about something,
     * for example the ones still on an older app version.
     */
    boolean notifyDevices(User user, PendingNotification notification, Predicate<DeviceToken> devices);

    NotificationInboxDto getInbox(User user, int limit);

    /** Marks the given notifications (or all of them when {@code ids} is null/empty) as read; returns how many changed. */
    int markRead(User user, List<Long> ids);

    /** Deletes/clears a single notification by id for the given user. */
    void deleteNotification(User user, Long id);

    /** Deletes/clears all notifications for the given user. */
    int clearAll(User user);

    List<NotificationPreferenceDto> getPreferences(User user);

    /** Replaces the set of switched-off kinds. Unknown names are rejected; locked kinds stay on. */
    List<NotificationPreferenceDto> updatePreferences(User user, List<String> disabledTypes);

    default void registerDevice(User user, String token, String platform) {
        registerDevice(user, token, platform, null);
    }

    /** Registers a phone; {@code appVersion} (may be null) lets the server tell which phones are behind. */
    void registerDevice(User user, String token, String platform, String appVersion);

    void unregisterDevice(User user, String token);

    /** Sends a test notification so the user can check that push works end to end. */
    boolean sendTest(User user);
}
