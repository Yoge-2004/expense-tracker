package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** A phone (Expo push token) that should receive a user's push notifications. */
@Entity
@Table(name = "device_tokens", uniqueConstraints = @UniqueConstraint(name = "uk_device_token", columnNames = "token"))
@Getter
@Setter
@NoArgsConstructor
public class DeviceToken extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 255)
    private String token;

    /** ANDROID, IOS or UNKNOWN. */
    @Column(nullable = false, length = 20)
    private String platform = "UNKNOWN";

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    /** Version of the mobile app installed on this phone, as reported when it registered; null for older apps. */
    @Column(name = "app_version", length = 32)
    private String appVersion;

    /** The newest app version this phone has already been told about, so each release is announced once per phone. */
    @Column(name = "update_announced_version", length = 32)
    private String updateAnnouncedVersion;
}
