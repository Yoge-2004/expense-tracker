package com.example.expensetracker.service;

import com.example.expensetracker.dto.NotificationInboxDto;
import com.example.expensetracker.dto.NotificationPreferenceDto;
import com.example.expensetracker.model.User;

import java.util.List;

public interface NotificationService {

    /**
     * Stores a notification and pushes it to the user's phones, unless the user switched that kind off
     * or the same event was already notified.
     *
     * @return true when a notification was created
     */
    boolean notify(User user, PendingNotification notification);

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

    void registerDevice(User user, String token, String platform);

    void unregisterDevice(User user, String token);

    /** Sends a test notification so the user can check that push works end to end. */
    boolean sendTest(User user);
}
