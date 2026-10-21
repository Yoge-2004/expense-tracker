package com.example.expensetracker.service;

import com.example.expensetracker.model.DeviceToken;
import com.example.expensetracker.model.NotificationType;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.DeviceTokenRepository;
import com.example.expensetracker.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AppUpdateNotifier")
class AppUpdateNotifierTest {

    private static final AppReleaseService.Release RELEASE =
            new AppReleaseService.Release("1.0.5", "v1.0.5", "https://example.test/releases/v1.0.5");

    @Mock private AppReleaseService releases;
    @Mock private UserRepository userRepository;
    @Mock private DeviceTokenRepository deviceTokenRepository;
    @Mock private NotificationService notificationService;
    @InjectMocks private AppUpdateNotifier notifier;

    private static User user(long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private static DeviceToken device(long id, String installed, String announced) {
        DeviceToken device = new DeviceToken();
        device.setId(id);
        device.setAppVersion(installed);
        device.setUpdateAnnouncedVersion(announced);
        return device;
    }

    @Test
    @DisplayName("tells a phone on an older version, pushes only to the phones that are behind, and remembers it")
    void notifiesPhonesThatAreBehind() {
        User user = user(1);
        DeviceToken behind = device(10, "1.0.4", null);
        DeviceToken current = device(11, "1.0.5", null);
        when(userRepository.findAll()).thenReturn(List.of(user));
        when(deviceTokenRepository.findByUser(user)).thenReturn(List.of(behind, current));
        when(notificationService.notifyDevices(eq(user), any(), any())).thenReturn(true);

        assertEquals(1, notifier.announce(RELEASE));

        ArgumentCaptor<PendingNotification> notice = ArgumentCaptor.forClass(PendingNotification.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Predicate<DeviceToken>> filter = ArgumentCaptor.forClass(Predicate.class);
        verify(notificationService).notifyDevices(eq(user), notice.capture(), filter.capture());
        assertEquals(NotificationType.APP_UPDATE, notice.getValue().type());
        assertEquals("app-update", notice.getValue().route());
        assertEquals("app-update:1.0.5", notice.getValue().dedupeKey());
        assertTrue(notice.getValue().body().contains("v1.0.5"));
        assertTrue(filter.getValue().test(behind));
        assertFalse(filter.getValue().test(current));

        assertEquals("1.0.5", behind.getUpdateAnnouncedVersion());
        assertEquals(null, current.getUpdateAnnouncedVersion());
        verify(deviceTokenRepository).saveAll(List.of(behind));
    }

    @Test
    @DisplayName("a phone that never reported its version is older than any release with this feature, so it is told")
    void notifiesPhonesWithUnknownVersion() {
        User user = user(1);
        DeviceToken unknown = device(10, null, null);
        when(userRepository.findAll()).thenReturn(List.of(user));
        when(deviceTokenRepository.findByUser(user)).thenReturn(List.of(unknown));
        when(notificationService.notifyDevices(eq(user), any(), any())).thenReturn(true);

        assertEquals(1, notifier.announce(RELEASE));
    }

    @Test
    @DisplayName("does not bother phones that are already up to date")
    void skipsUpToDatePhones() {
        User user = user(1);
        when(userRepository.findAll()).thenReturn(List.of(user));
        when(deviceTokenRepository.findByUser(user)).thenReturn(List.of(device(10, "1.0.5", null), device(11, "1.1.0", null)));

        assertEquals(0, notifier.announce(RELEASE));

        verifyNoInteractions(notificationService);
    }

    @Test
    @DisplayName("announces a release to a phone only once")
    void announcesOncePerRelease() {
        User user = user(1);
        when(userRepository.findAll()).thenReturn(List.of(user));
        when(deviceTokenRepository.findByUser(user)).thenReturn(List.of(device(10, "1.0.4", "1.0.5")));

        assertEquals(0, notifier.announce(RELEASE));

        verifyNoInteractions(notificationService);
    }

    @Test
    @DisplayName("a user who switched App updates off is not marked as told, so enabling it later still works")
    void respectsPreferences() {
        User user = user(1);
        DeviceToken behind = device(10, "1.0.4", null);
        when(userRepository.findAll()).thenReturn(List.of(user));
        when(deviceTokenRepository.findByUser(user)).thenReturn(List.of(behind));
        when(notificationService.notifyDevices(eq(user), any(), any())).thenReturn(false);

        assertEquals(0, notifier.announce(RELEASE));

        assertEquals(null, behind.getUpdateAnnouncedVersion());
        verify(deviceTokenRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("one account failing never stops the others being told")
    void isolatesFailures() {
        User broken = user(1);
        User fine = user(2);
        when(userRepository.findAll()).thenReturn(List.of(broken, fine));
        when(deviceTokenRepository.findByUser(broken)).thenThrow(new IllegalStateException("db hiccup"));
        when(deviceTokenRepository.findByUser(fine)).thenReturn(List.of(device(20, "1.0.4", null)));
        when(notificationService.notifyDevices(eq(fine), any(), any())).thenReturn(true);

        assertEquals(1, notifier.announce(RELEASE));
    }

    @Test
    @DisplayName("does nothing when the latest release cannot be found")
    void noReleaseNoNotice() {
        when(releases.latest()).thenReturn(Optional.empty());

        assertEquals(0, notifier.announce());

        verifyNoInteractions(userRepository, notificationService);
    }

    @Test
    @DisplayName("the scheduled check is a no-op when the feature or the scheduler is switched off")
    void scheduledCheckCanBeDisabled() {
        ReflectionTestUtils.setField(notifier, "enabled", false);
        ReflectionTestUtils.setField(notifier, "schedulerEnabled", true);
        notifier.check();
        ReflectionTestUtils.setField(notifier, "enabled", true);
        ReflectionTestUtils.setField(notifier, "schedulerEnabled", false);
        notifier.check();

        verifyNoInteractions(releases);
    }
}
