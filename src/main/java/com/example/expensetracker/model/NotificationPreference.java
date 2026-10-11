package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Which notification kinds a user has switched OFF. Everything is on by default, so a user with no row
 * receives everything.
 */
@Entity
@Table(name = "notification_preferences",
        uniqueConstraints = @UniqueConstraint(name = "uk_notification_pref_user", columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class NotificationPreference extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Comma-separated {@link NotificationType} names that are switched off. */
    @Column(name = "disabled_types", length = 500)
    private String disabledTypes;

    public Set<NotificationType> disabledSet() {
        Set<NotificationType> result = EnumSet.noneOf(NotificationType.class);
        if (disabledTypes == null || disabledTypes.isBlank()) {
            return result;
        }
        Arrays.stream(disabledTypes.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .forEach(name -> {
                    try {
                        result.add(NotificationType.valueOf(name));
                    } catch (IllegalArgumentException ignored) {
                        // a type that no longer exists is simply ignored
                    }
                });
        return result;
    }

    public void setDisabled(Collection<NotificationType> types) {
        this.disabledTypes = types.stream().map(Enum::name).sorted().collect(Collectors.joining(","));
    }
}
