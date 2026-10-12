package com.example.expensetracker.service;

import com.example.expensetracker.model.NotificationType;

/**
 * A notification a detector decided to send, before it is stored or delivered.
 *
 * @param dedupeKey identifies the event behind it so the same alert is never sent twice
 * @param route     where tapping it should go in the app (optional)
 */
public record PendingNotification(NotificationType type, String title, String body, String route, String dedupeKey) {
}
