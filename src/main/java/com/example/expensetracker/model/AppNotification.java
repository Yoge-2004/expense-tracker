package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * One notification in a user's inbox. The same row backs the in-app inbox (web and mobile) and the
 * push that was sent for it.
 *
 * <p>{@code dedupeKey} identifies the event that caused it (for example
 * {@code budget:12:2026-10-01:80}), so a detector that runs every day never sends the same alert twice.</p>
 */
@Entity
@Table(name = "app_notifications",
        uniqueConstraints = @UniqueConstraint(name = "uk_notification_user_dedupe", columnNames = {"user_id", "dedupe_key"}))
@Getter
@Setter
@NoArgsConstructor
public class AppNotification extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** A {@link NotificationType} name. */
    @Column(name = "notification_type", nullable = false, length = 40)
    private String type;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "message_body", nullable = false, length = 500)
    private String body;

    /** Where tapping it should go in the app, e.g. "budgets" or "subscriptions". Optional. */
    @Column(length = 60)
    private String route;

    @Column(name = "dedupe_key", nullable = false, length = 160)
    private String dedupeKey;

    /** Null while unread. */
    @Column(name = "read_at")
    private LocalDateTime readAt;
}
