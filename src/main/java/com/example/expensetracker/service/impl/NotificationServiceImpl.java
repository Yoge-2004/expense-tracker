package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.NotificationDto;
import com.example.expensetracker.dto.NotificationInboxDto;
import com.example.expensetracker.dto.NotificationPreferenceDto;
import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.AppNotificationRepository;
import com.example.expensetracker.repository.DeviceTokenRepository;
import com.example.expensetracker.repository.NotificationPreferenceRepository;
import com.example.expensetracker.service.ExpoPushClient;
import com.example.expensetracker.service.NotificationService;
import com.example.expensetracker.service.PendingNotification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private static final int MAX_INBOX = 100;

    private final AppNotificationRepository notificationRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final NotificationPreferenceRepository preferenceRepository;

    // Deliberately not @Transactional: saving is its own short transaction and the network push
    // below must not run inside one.
    @Override
    public boolean notify(User user, PendingNotification notification) {
        if (!isEnabled(user, notification.type())) {
            return false;
        }
        if (notificationRepository.existsByUserAndDedupeKey(user, notification.dedupeKey())) {
            return false;
        }

        AppNotification entity = new AppNotification();
        entity.setUser(user);
        entity.setType(notification.type().name());
        entity.setTitle(clip(notification.title(), 120));
        entity.setBody(clip(notification.body(), 500));
        entity.setRoute(notification.route());
        entity.setDedupeKey(clip(notification.dedupeKey(), 160));
        try {
            notificationRepository.save(entity);
        } catch (DataIntegrityViolationException duplicate) {
            return false;   // another run created the same event first
        }
        push(user, notification);
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationInboxDto getInbox(User user, int limit) {
        int size = Math.max(1, Math.min(limit, MAX_INBOX));
        List<NotificationDto> items = notificationRepository
                .findByUserOrderByCreatedAtDesc(user, PageRequest.of(0, size)).stream()
                .map(n -> new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getBody(), n.getRoute(),
                        n.getReadAt() != null, n.getCreatedAt()))
                .toList();
        return new NotificationInboxDto(notificationRepository.countByUserAndReadAtIsNull(user), items);
    }

    @Override
    @Transactional
    public int markRead(User user, List<Long> ids) {
        List<AppNotification> targets = ids == null || ids.isEmpty()
                ? notificationRepository.findByUserAndReadAtIsNull(user)
                : notificationRepository.findByUserAndIdIn(user, ids);
        LocalDateTime now = LocalDateTime.now();
        int changed = 0;
        for (AppNotification n : targets) {
            if (n.getReadAt() == null) {
                n.setReadAt(now);
                changed++;
            }
        }
        notificationRepository.saveAll(targets);
        return changed;
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationPreferenceDto> getPreferences(User user) {
        Set<NotificationType> disabled = preferenceRepository.findByUser(user)
                .map(NotificationPreference::disabledSet).orElseGet(() -> EnumSet.noneOf(NotificationType.class));
        return describe(disabled);
    }

    @Override
    @Transactional
    public List<NotificationPreferenceDto> updatePreferences(User user, List<String> disabledTypes) {
        Set<NotificationType> disabled = EnumSet.noneOf(NotificationType.class);
        for (String name : disabledTypes == null ? List.<String>of() : disabledTypes) {
            NotificationType type;
            try {
                type = NotificationType.valueOf(name == null ? "" : name.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Unknown notification type '" + name + "'");
            }
            if (type.isUserControllable()) {
                disabled.add(type);
            }
        }
        NotificationPreference preference = preferenceRepository.findByUser(user).orElseGet(() -> {
            NotificationPreference created = new NotificationPreference();
            created.setUser(user);
            return created;
        });
        preference.setDisabled(disabled);
        preferenceRepository.save(preference);
        return describe(disabled);
    }

    @Override
    @Transactional
    public void registerDevice(User user, String token, String platform) {
        if (!ExpoPushClient.isValidToken(token)) {
            throw new IllegalArgumentException("That is not a valid Expo push token.");
        }
        DeviceToken device = deviceTokenRepository.findByToken(token).orElseGet(DeviceToken::new);
        // The same phone may sign in with another account: the token follows the latest one.
        device.setUser(user);
        device.setToken(token);
        device.setPlatform(normalisePlatform(platform));
        device.setLastSeenAt(LocalDateTime.now());
        deviceTokenRepository.save(device);
    }

    @Override
    public void unregisterDevice(User user, String token) {
        if (token != null && !token.isBlank()) {
            deviceTokenRepository.deleteByTokenAndUser(token, user);
        }
    }

    @Override
    public boolean sendTest(User user) {
        return notify(user, new PendingNotification(NotificationType.SYSTEM, "Notifications are working",
                "This is a test notification from Expense Tracker.", null, "test:" + System.currentTimeMillis()));
    }

    // ------------------------------------------------------------------ internals

    private boolean isEnabled(User user, NotificationType type) {
        if (!type.isUserControllable()) {
            return true;
        }
        return preferenceRepository.findByUser(user)
                .map(p -> !p.disabledSet().contains(type))
                .orElse(true);
    }

    private void push(User user, PendingNotification notification) {
        try {
            List<String> tokens = deviceTokenRepository.findByUser(user).stream()
                    .map(DeviceToken::getToken)
                    .filter(ExpoPushClient::isValidToken)
                    .collect(Collectors.toList());
            if (tokens.isEmpty()) {
                return;
            }
            for (String dead : ExpoPushClient.send(tokens, notification.title(), notification.body(), notification.route())) {
                deviceTokenRepository.deleteByToken(dead);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            // The notification is already in the inbox; a failed push is only logged.
            log.warn("Push delivery failed for userId={}: {}", user.getId(), e.getMessage());
        }
    }

    private static List<NotificationPreferenceDto> describe(Set<NotificationType> disabled) {
        return Arrays.stream(NotificationType.values())
                .map(t -> new NotificationPreferenceDto(t.name(), t.getLabel(), t.getDescription(),
                        !t.isUserControllable() || !disabled.contains(t), !t.isUserControllable()))
                .toList();
    }

    private static String normalisePlatform(String platform) {
        String value = platform == null ? "" : platform.trim().toUpperCase(Locale.ROOT);
        return value.equals("ANDROID") || value.equals("IOS") ? value : "UNKNOWN";
    }

    private static String clip(String text, int max) {
        if (text == null) return "";
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}
