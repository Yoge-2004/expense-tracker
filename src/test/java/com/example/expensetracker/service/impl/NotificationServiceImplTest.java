package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.NotificationInboxDto;
import com.example.expensetracker.dto.NotificationPreferenceDto;
import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.AppNotificationRepository;
import com.example.expensetracker.repository.DeviceTokenRepository;
import com.example.expensetracker.repository.NotificationPreferenceRepository;
import com.example.expensetracker.service.PendingNotification;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationServiceImpl")
class NotificationServiceImplTest {

    @Mock private AppNotificationRepository notificationRepository;
    @Mock private DeviceTokenRepository deviceTokenRepository;
    @Mock private NotificationPreferenceRepository preferenceRepository;
    @InjectMocks private NotificationServiceImpl service;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
    }

    private static PendingNotification pending(NotificationType type, String key) {
        return new PendingNotification(type, "Title", "Body", "budgets", key);
    }

    @Nested
    @DisplayName("notify")
    class Notify {

        @Test
        @DisplayName("stores a new notification with its fields when the kind is on and the event is new")
        void storesNewNotification() {
            when(preferenceRepository.findByUser(user)).thenReturn(Optional.empty());
            when(notificationRepository.existsByUserAndDedupeKey(user, "k1")).thenReturn(false);

            assertTrue(service.notify(user, pending(NotificationType.BUDGET_WARNING, "k1")));

            ArgumentCaptor<AppNotification> saved = ArgumentCaptor.forClass(AppNotification.class);
            verify(notificationRepository).save(saved.capture());
            assertEquals("BUDGET_WARNING", saved.getValue().getType());
            assertEquals("Title", saved.getValue().getTitle());
            assertEquals("k1", saved.getValue().getDedupeKey());
            assertEquals("budgets", saved.getValue().getRoute());
            assertNull(saved.getValue().getReadAt());
        }

        @Test
        @DisplayName("a kind the user switched off is not stored")
        void respectsPreference() {
            NotificationPreference preference = new NotificationPreference();
            preference.setDisabled(List.of(NotificationType.BUDGET_WARNING));
            when(preferenceRepository.findByUser(user)).thenReturn(Optional.of(preference));

            assertFalse(service.notify(user, pending(NotificationType.BUDGET_WARNING, "k1")));

            verify(notificationRepository, never()).save(any());
        }

        @Test
        @DisplayName("the same event is never notified twice")
        void dedupes() {
            when(preferenceRepository.findByUser(user)).thenReturn(Optional.empty());
            when(notificationRepository.existsByUserAndDedupeKey(user, "k1")).thenReturn(true);

            assertFalse(service.notify(user, pending(NotificationType.GOAL_MILESTONE, "k1")));

            verify(notificationRepository, never()).save(any());
        }

        @Test
        @DisplayName("a concurrent run that created the same event first is treated as a duplicate, not an error")
        void duplicateKeyRace() {
            when(preferenceRepository.findByUser(user)).thenReturn(Optional.empty());
            when(notificationRepository.existsByUserAndDedupeKey(user, "k1")).thenReturn(false);
            when(notificationRepository.save(any())).thenThrow(new DataIntegrityViolationException("duplicate"));

            assertFalse(service.notify(user, pending(NotificationType.GOAL_MILESTONE, "k1")));
        }

        @Test
        @DisplayName("system notices are always delivered and never consult the preferences")
        void systemIsAlwaysOn() {
            when(notificationRepository.existsByUserAndDedupeKey(user, "k1")).thenReturn(false);

            assertTrue(service.notify(user, pending(NotificationType.SYSTEM, "k1")));

            verifyNoInteractions(preferenceRepository);
        }

        @Test
        @DisplayName("overlong text is clipped to the column sizes instead of failing the insert")
        void clipsLongText() {
            when(preferenceRepository.findByUser(user)).thenReturn(Optional.empty());
            String longBody = "x".repeat(900);

            service.notify(user, new PendingNotification(NotificationType.WEEKLY_DIGEST, "T", longBody, null, "k1"));

            ArgumentCaptor<AppNotification> saved = ArgumentCaptor.forClass(AppNotification.class);
            verify(notificationRepository).save(saved.capture());
            assertEquals(500, saved.getValue().getBody().length());
        }
    }

    @Nested
    @DisplayName("inbox")
    class Inbox {

        @Test
        @DisplayName("limit is clamped to 1..100 and the unread count is included")
        void clampsLimit() {
            when(notificationRepository.findByUserOrderByCreatedAtDesc(user, PageRequest.of(0, 100))).thenReturn(List.of());
            when(notificationRepository.countByUserAndReadAtIsNull(user)).thenReturn(4L);

            NotificationInboxDto inbox = service.getInbox(user, 500);

            assertEquals(4L, inbox.unreadCount());
            assertTrue(inbox.items().isEmpty());
        }

        @Test
        @DisplayName("markRead with no ids marks every unread notification once")
        void markAllRead() {
            AppNotification unread = new AppNotification();
            AppNotification alreadyRead = new AppNotification();
            alreadyRead.setReadAt(java.time.LocalDateTime.now().minusDays(1));
            when(notificationRepository.findByUserAndReadAtIsNull(user)).thenReturn(List.of(unread, alreadyRead));

            assertEquals(1, service.markRead(user, null));
            assertNotNull(unread.getReadAt());
        }

        @Test
        @DisplayName("markRead with ids only touches those notifications")
        void markSomeRead() {
            AppNotification one = new AppNotification();
            when(notificationRepository.findByUserAndIdIn(user, List.of(5L))).thenReturn(List.of(one));

            assertEquals(1, service.markRead(user, List.of(5L)));
            verify(notificationRepository, never()).findByUserAndReadAtIsNull(any());
        }

        @Test
        @DisplayName("deleteNotification deletes specific notification for user")
        void deleteSpecificNotification() {
            service.deleteNotification(user, 10L);
            verify(notificationRepository).deleteByUserAndId(user, 10L);

            service.deleteNotification(user, null);
            service.deleteNotification(null, 10L);
            verifyNoMoreInteractions(notificationRepository);
        }

        @Test
        @DisplayName("clearAll deletes all notifications for user")
        void clearAllNotifications() {
            when(notificationRepository.deleteByUser(user)).thenReturn(7L);

            assertEquals(7, service.clearAll(user));
            verify(notificationRepository).deleteByUser(user);

            assertEquals(0, service.clearAll(null));
        }
    }

    @Nested
    @DisplayName("preferences")
    class Preferences {

        @Test
        @DisplayName("everything is on for a user who never changed anything, and system notices are locked")
        void defaults() {
            when(preferenceRepository.findByUser(user)).thenReturn(Optional.empty());

            List<NotificationPreferenceDto> prefs = service.getPreferences(user);

            assertEquals(NotificationType.values().length, prefs.size());
            assertTrue(prefs.stream().allMatch(NotificationPreferenceDto::enabled));
            assertTrue(prefs.stream().filter(p -> p.type().equals("SYSTEM")).allMatch(NotificationPreferenceDto::locked));
            assertTrue(prefs.stream().filter(p -> !p.type().equals("SYSTEM")).noneMatch(NotificationPreferenceDto::locked));
        }

        @Test
        @DisplayName("switching kinds off is saved; the locked system kind cannot be switched off")
        void switchOff() {
            when(preferenceRepository.findByUser(user)).thenReturn(Optional.empty());

            List<NotificationPreferenceDto> prefs = service.updatePreferences(user, List.of("budget_warning", "SYSTEM"));

            ArgumentCaptor<NotificationPreference> saved = ArgumentCaptor.forClass(NotificationPreference.class);
            verify(preferenceRepository).save(saved.capture());
            assertEquals("BUDGET_WARNING", saved.getValue().getDisabledTypes());
            assertFalse(prefs.stream().filter(p -> p.type().equals("BUDGET_WARNING")).findFirst().orElseThrow().enabled());
            assertTrue(prefs.stream().filter(p -> p.type().equals("SYSTEM")).findFirst().orElseThrow().enabled());
        }

        @Test
        @DisplayName("an unknown kind is rejected instead of silently ignored")
        void unknownKind() {
            assertThrows(IllegalArgumentException.class, () -> service.updatePreferences(user, List.of("NOPE")));
            verify(preferenceRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("devices")
    class Devices {

        @Test
        @DisplayName("something that is not an Expo push token is rejected")
        void rejectsBadToken() {
            assertThrows(IllegalArgumentException.class, () -> service.registerDevice(user, "not-a-token", "ANDROID"));
            verify(deviceTokenRepository, never()).save(any());
        }

        @Test
        @DisplayName("a new phone is stored with a normalised platform")
        void registersNewDevice() {
            when(deviceTokenRepository.findByToken("ExponentPushToken[abc]")).thenReturn(Optional.empty());

            service.registerDevice(user, "ExponentPushToken[abc]", "android");

            ArgumentCaptor<DeviceToken> saved = ArgumentCaptor.forClass(DeviceToken.class);
            verify(deviceTokenRepository).save(saved.capture());
            assertEquals("ANDROID", saved.getValue().getPlatform());
            assertEquals(user, saved.getValue().getUser());
            assertNotNull(saved.getValue().getLastSeenAt());
        }

        @Test
        @DisplayName("a phone that signs in with another account moves to that account instead of duplicating")
        void tokenFollowsLatestAccount() {
            User previousOwner = new User();
            previousOwner.setId(99L);
            DeviceToken existing = new DeviceToken();
            existing.setUser(previousOwner);
            existing.setToken("ExponentPushToken[abc]");
            when(deviceTokenRepository.findByToken("ExponentPushToken[abc]")).thenReturn(Optional.of(existing));

            service.registerDevice(user, "ExponentPushToken[abc]", "weird-platform");

            assertSame(user, existing.getUser());
            assertEquals("UNKNOWN", existing.getPlatform());
            verify(deviceTokenRepository).save(existing);
        }

        @Test
        @DisplayName("unregistering only removes the token for the signed-in user")
        void unregister() {
            service.unregisterDevice(user, "ExponentPushToken[abc]");
            verify(deviceTokenRepository).deleteByTokenAndUser("ExponentPushToken[abc]", user);

            service.unregisterDevice(user, " ");
            verifyNoMoreInteractions(deviceTokenRepository);
        }
    }
}
