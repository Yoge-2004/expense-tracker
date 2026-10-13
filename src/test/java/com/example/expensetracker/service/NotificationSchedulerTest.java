package com.example.expensetracker.service;

import com.example.expensetracker.model.NotificationType;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.AppNotificationRepository;
import com.example.expensetracker.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationScheduler")
class NotificationSchedulerTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);

    @Mock private UserRepository userRepository;
    @Mock private NotificationDetector detector;
    @Mock private NotificationService notificationService;
    @Mock private AppNotificationRepository notificationRepository;
    @InjectMocks private NotificationScheduler scheduler;

    private static User user(long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private static PendingNotification pending(String key) {
        return new PendingNotification(NotificationType.BUDGET_WARNING, "T", "B", null, key);
    }

    @Test
    @DisplayName("counts only the notifications that were actually created, skipping duplicates")
    void countsCreated() {
        User user = user(1);
        when(userRepository.findAll()).thenReturn(List.of(user));
        when(detector.detectDaily(user, TODAY)).thenReturn(List.of(pending("a"), pending("b")));
        // First notification is created, the second one was already sent before.
        when(notificationService.notify(eq(user), any())).thenReturn(true, false);

        assertEquals(1, scheduler.process(TODAY, false));
    }

    @Test
    @DisplayName("one account failing never stops notifications for the others")
    void isolatesFailures() {
        User broken = user(1);
        User fine = user(2);
        when(userRepository.findAll()).thenReturn(List.of(broken, fine));
        when(detector.detectDaily(broken, TODAY)).thenThrow(new IllegalStateException("bad data"));
        when(detector.detectDaily(fine, TODAY)).thenReturn(List.of(pending("a")));
        when(notificationService.notify(eq(fine), any())).thenReturn(true);

        assertEquals(1, scheduler.process(TODAY, false));
        verify(notificationService, never()).notify(eq(broken), any());
    }

    @Test
    @DisplayName("the weekly run asks for the digest, not the daily alerts")
    void weeklyUsesDigest() {
        User user = user(1);
        when(userRepository.findAll()).thenReturn(List.of(user));
        when(detector.detectWeeklyDigest(user, TODAY)).thenReturn(List.of());

        assertEquals(0, scheduler.process(TODAY, true));

        verify(detector, never()).detectDaily(any(), any());
    }
}
