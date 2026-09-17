package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.dto.SavingsGoalRequest;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.SavingsGoalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SavingsGoalServiceImplTest {

    @Mock
    private SavingsGoalRepository savingsGoalRepository;

    private SavingsGoalServiceImpl service;
    private User user;
    private User otherUser;

    @BeforeEach
    void setUp() {
        service = new SavingsGoalServiceImpl(savingsGoalRepository);
        user = new User();
        user.setId(1L);
        user.setEmail("user@example.com");

        otherUser = new User();
        otherUser.setId(2L);
        otherUser.setEmail("other@example.com");
    }

    @Test
    @DisplayName("createGoal creates and returns savings goal DTO")
    void createGoal_success() {
        SavingsGoalRequest req = new SavingsGoalRequest(
                "Emergency Fund",
                BigDecimal.valueOf(10000),
                BigDecimal.valueOf(1000),
                LocalDate.of(2027, 1, 1),
                "IN_PROGRESS",
                true,
                BigDecimal.valueOf(500),
                "MONTHLY",
                1,
                LocalDate.of(2026, 10, 1),
                LocalDate.of(2027, 1, 1)
        );

        when(savingsGoalRepository.save(any(SavingsGoal.class))).thenAnswer(inv -> {
            SavingsGoal sg = inv.getArgument(0);
            sg.setId(501L);
            return sg;
        });

        SavingsGoalDto result = service.createGoal(req, user);

        assertNotNull(result);
        assertEquals(501L, result.id());
        assertEquals("Emergency Fund", result.name());
        assertEquals(BigDecimal.valueOf(10000), result.targetAmount());
        assertEquals(BigDecimal.valueOf(1000), result.currentAmount());
        verify(savingsGoalRepository).save(any(SavingsGoal.class));
    }

    @Test
    @DisplayName("getUserGoals returns list of user savings goals")
    void getUserGoals_returnsList() {
        SavingsGoal goal = new SavingsGoal();
        goal.setId(502L);
        goal.setName("Vacation");
        goal.setUser(user);
        goal.setTargetAmount(BigDecimal.valueOf(3000));
        goal.setCurrentAmount(BigDecimal.valueOf(500));

        when(savingsGoalRepository.findByUser(user)).thenReturn(List.of(goal));

        List<SavingsGoalDto> list = service.getUserGoals(user);

        assertEquals(1, list.size());
        assertEquals("Vacation", list.get(0).name());
        verify(savingsGoalRepository).findByUser(user);
    }

    @Test
    @DisplayName("updateGoal throws when goal does not exist or user mismatch")
    void updateGoal_validatesExistenceAndOwnership() {
        when(savingsGoalRepository.findById(999L)).thenReturn(Optional.empty());
        SavingsGoalRequest req = new SavingsGoalRequest("Test", BigDecimal.valueOf(100), null, null, null, null, null, null, null, null, null);

        assertThrows(IllegalArgumentException.class, () -> service.updateGoal(999L, req, user));

        SavingsGoal otherGoal = new SavingsGoal();
        otherGoal.setId(503L);
        otherGoal.setUser(otherUser);
        when(savingsGoalRepository.findById(503L)).thenReturn(Optional.of(otherGoal));

        assertThrows(IllegalArgumentException.class, () -> service.updateGoal(503L, req, user));
        verify(savingsGoalRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateGoal updates goal fields and auto-completes when target lowered below current amount")
    void updateGoal_autoCompletesIfTargetLowered() {
        SavingsGoal existing = new SavingsGoal();
        existing.setId(504L);
        existing.setName("Old Target");
        existing.setUser(user);
        existing.setTargetAmount(BigDecimal.valueOf(5000));
        existing.setCurrentAmount(BigDecimal.valueOf(3000));
        existing.setStatus("IN_PROGRESS");

        when(savingsGoalRepository.findById(504L)).thenReturn(Optional.of(existing));
        when(savingsGoalRepository.save(any(SavingsGoal.class))).thenAnswer(inv -> inv.getArgument(0));

        // Lower target to 2500 (below current 3000)
        SavingsGoalRequest req = new SavingsGoalRequest(
                "New Target",
                BigDecimal.valueOf(2500),
                null, // current amount should be ignored on direct update
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );

        SavingsGoalDto result = service.updateGoal(504L, req, user);

        assertEquals("New Target", result.name());
        assertEquals(BigDecimal.valueOf(2500), result.targetAmount());
        assertEquals("COMPLETED", result.status());
    }

    @Test
    @DisplayName("depositToGoal rejects non-positive or null deposit amount")
    void depositToGoal_invalidAmount_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> service.depositToGoal(1L, null, user));
        assertThrows(IllegalArgumentException.class, () -> service.depositToGoal(1L, BigDecimal.ZERO, user));
        assertThrows(IllegalArgumentException.class, () -> service.depositToGoal(1L, BigDecimal.valueOf(-10), user));
        verify(savingsGoalRepository, never()).addToCurrentAmount(any(), any(), any());
    }

    @Test
    @DisplayName("depositToGoal throws when goal does not exist or user mismatch")
    void depositToGoal_validatesOwnership() {
        when(savingsGoalRepository.findById(800L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.depositToGoal(800L, BigDecimal.valueOf(100), user));

        SavingsGoal otherGoal = new SavingsGoal();
        otherGoal.setId(801L);
        otherGoal.setUser(otherUser);
        when(savingsGoalRepository.findById(801L)).thenReturn(Optional.of(otherGoal));
        assertThrows(IllegalArgumentException.class, () -> service.depositToGoal(801L, BigDecimal.valueOf(100), user));

        verify(savingsGoalRepository, never()).addToCurrentAmount(any(), any(), any());
    }

    @Test
    @DisplayName("depositToGoal applies atomic deposit and marks completed if target reached")
    void depositToGoal_success_andMarksCompleted() {
        SavingsGoal goal = new SavingsGoal();
        goal.setId(802L);
        goal.setUser(user);
        goal.setTargetAmount(BigDecimal.valueOf(1000));
        goal.setCurrentAmount(BigDecimal.valueOf(800));
        goal.setStatus("IN_PROGRESS");

        when(savingsGoalRepository.findById(802L)).thenReturn(Optional.of(goal));
        when(savingsGoalRepository.addToCurrentAmount(802L, user, BigDecimal.valueOf(200))).thenReturn(1);

        // After update reload
        SavingsGoal updated = new SavingsGoal();
        updated.setId(802L);
        updated.setUser(user);
        updated.setTargetAmount(BigDecimal.valueOf(1000));
        updated.setCurrentAmount(BigDecimal.valueOf(1000));
        updated.setStatus("IN_PROGRESS");

        when(savingsGoalRepository.findById(802L))
                .thenReturn(Optional.of(goal))
                .thenReturn(Optional.of(updated));
        when(savingsGoalRepository.save(any(SavingsGoal.class))).thenAnswer(inv -> inv.getArgument(0));

        SavingsGoalDto result = service.depositToGoal(802L, BigDecimal.valueOf(200), user);

        assertNotNull(result);
        assertEquals(BigDecimal.valueOf(1000), result.currentAmount());
        assertEquals("COMPLETED", result.status());
        verify(savingsGoalRepository).addToCurrentAmount(802L, user, BigDecimal.valueOf(200));
    }

    @Test
    @DisplayName("deleteGoal throws when goal does not exist or user mismatch")
    void deleteGoal_validatesOwnership() {
        when(savingsGoalRepository.findById(900L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.deleteGoal(900L, user));

        SavingsGoal otherGoal = new SavingsGoal();
        otherGoal.setId(901L);
        otherGoal.setUser(otherUser);
        when(savingsGoalRepository.findById(901L)).thenReturn(Optional.of(otherGoal));
        assertThrows(IllegalArgumentException.class, () -> service.deleteGoal(901L, user));

        verify(savingsGoalRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteGoal deletes owned savings goal")
    void deleteGoal_success() {
        SavingsGoal goal = new SavingsGoal();
        goal.setId(902L);
        goal.setUser(user);
        when(savingsGoalRepository.findById(902L)).thenReturn(Optional.of(goal));

        service.deleteGoal(902L, user);

        verify(savingsGoalRepository).delete(goal);
    }

    @Test
    @DisplayName("getRecurringGoals retrieves recurring savings goals for user")
    void getRecurringGoals_success() {
        SavingsGoal goal = new SavingsGoal();
        goal.setId(950L);
        goal.setName("SIP Mutual Fund");
        goal.setUser(user);
        goal.setIsRecurring(true);
        goal.setRecurringAmount(BigDecimal.valueOf(5000));

        when(savingsGoalRepository.findByUserAndIsRecurringTrue(user)).thenReturn(List.of(goal));

        List<SavingsGoalDto> results = service.getRecurringGoals(user);

        assertNotNull(results);
        assertEquals(1, results.size());
        assertEquals("SIP Mutual Fund", results.get(0).name());
        assertTrue(results.get(0).isRecurring());
        verify(savingsGoalRepository).findByUserAndIsRecurringTrue(user);
    }
}
