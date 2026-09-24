package com.example.expensetracker.service;

import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.SavingsGoalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecurringSavingsSchedulerTest {

    @Mock
    private SavingsGoalRepository savingsGoalRepository;

    @InjectMocks
    private RecurringSavingsScheduler scheduler;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setEmail("savings_sched@test.com");
    }

    @Test
    @DisplayName("processRecurringSavings does nothing when no recurring goals are due")
    void testProcessRecurringSavings_NoneDue() {
        when(savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        scheduler.processRecurringSavings();

        verify(savingsGoalRepository, never()).save(any());
    }

    @Test
    @DisplayName("processRecurringSavings adds installment and advances nextDueDate")
    void testProcessRecurringSavings_InstallmentApplied() {
        LocalDate today = LocalDate.now();
        SavingsGoal goal = new SavingsGoal();
        goal.setId(10L);
        goal.setName("Car Downpayment");
        goal.setTargetAmount(new BigDecimal("5000.00"));
        goal.setCurrentAmount(new BigDecimal("1000.00"));
        goal.setRecurringAmount(new BigDecimal("500.00"));
        goal.setIsRecurring(true);
        goal.setFrequency("MONTHLY");
        goal.setStatus("ACTIVE");
        goal.setNextDueDate(today);
        goal.setUser(testUser);

        when(savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(goal));

        scheduler.processRecurringSavings();

        ArgumentCaptor<SavingsGoal> captor = ArgumentCaptor.forClass(SavingsGoal.class);
        verify(savingsGoalRepository, times(1)).save(captor.capture());

        SavingsGoal saved = captor.getValue();
        assertEquals(new BigDecimal("1500.00"), saved.getCurrentAmount());
        assertEquals("ACTIVE", saved.getStatus());
        assertEquals(today.plusMonths(1), saved.getNextDueDate());
    }

    @Test
    @DisplayName("processRecurringSavings automatically marks goal as COMPLETED when target is reached")
    void testProcessRecurringSavings_AutoCompletesWhenTargetReached() {
        LocalDate today = LocalDate.now();
        SavingsGoal goal = new SavingsGoal();
        goal.setId(11L);
        goal.setName("Vacation Fund");
        goal.setTargetAmount(new BigDecimal("1000.00"));
        goal.setCurrentAmount(new BigDecimal("800.00"));
        goal.setRecurringAmount(new BigDecimal("300.00"));
        goal.setIsRecurring(true);
        goal.setFrequency("MONTHLY");
        goal.setStatus("ACTIVE");
        goal.setNextDueDate(today);
        goal.setUser(testUser);

        when(savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(goal));

        scheduler.processRecurringSavings();

        ArgumentCaptor<SavingsGoal> captor = ArgumentCaptor.forClass(SavingsGoal.class);
        verify(savingsGoalRepository, times(1)).save(captor.capture());

        SavingsGoal saved = captor.getValue();
        assertEquals(new BigDecimal("1100.00"), saved.getCurrentAmount());
        assertEquals("COMPLETED", saved.getStatus());
        assertEquals(today.plusMonths(1), saved.getNextDueDate());
    }

    @Test
    @DisplayName("processRecurringSavings supports weekly and yearly frequency")
    void testProcessRecurringSavings_WeeklyAndYearly() {
        LocalDate today = LocalDate.now();

        SavingsGoal weekly = new SavingsGoal();
        weekly.setId(12L);
        weekly.setName("Weekly SIP");
        weekly.setRecurringAmount(new BigDecimal("100.00"));
        weekly.setCurrentAmount(new BigDecimal("200.00"));
        weekly.setIsRecurring(true);
        weekly.setFrequency("WEEKLY");
        weekly.setNextDueDate(today);
        weekly.setUser(testUser);

        SavingsGoal yearly = new SavingsGoal();
        yearly.setId(13L);
        yearly.setName("Annual PPF Deposit");
        yearly.setRecurringAmount(new BigDecimal("1500.00"));
        yearly.setCurrentAmount(new BigDecimal("3000.00"));
        yearly.setIsRecurring(true);
        yearly.setFrequency("YEARLY");
        yearly.setNextDueDate(today);
        yearly.setUser(testUser);

        when(savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(weekly, yearly));

        scheduler.processRecurringSavings();

        assertEquals(today.plusWeeks(1), weekly.getNextDueDate());
        assertEquals(today.plusYears(1), yearly.getNextDueDate());
        verify(savingsGoalRepository, times(2)).save(any(SavingsGoal.class));
    }

    @Test
    @DisplayName("processRecurringSavings isolates failures per record")
    void testProcessRecurringSavings_FailureIsolation() {
        LocalDate today = LocalDate.now();

        SavingsGoal faulty = new SavingsGoal();
        faulty.setId(99L);
        faulty.setIsRecurring(true);
        faulty.setNextDueDate(today);

        SavingsGoal valid = new SavingsGoal();
        valid.setId(100L);
        valid.setCurrentAmount(new BigDecimal("50.00"));
        valid.setRecurringAmount(new BigDecimal("50.00"));
        valid.setIsRecurring(true);
        valid.setFrequency("DAILY");
        valid.setNextDueDate(today);
        valid.setUser(testUser);

        when(savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(faulty, valid));

        doThrow(new RuntimeException("DB error"))
                .doAnswer(inv -> inv.getArgument(0))
                .when(savingsGoalRepository).save(any(SavingsGoal.class));

        assertDoesNotThrow(() -> scheduler.processRecurringSavings());

        verify(savingsGoalRepository, times(1)).save(valid);
        assertEquals(today.plusDays(1), valid.getNextDueDate());
    }

    @Test
    @DisplayName("onApplicationReady checks missed recurring savings installments")
    void testOnApplicationReady() {
        when(savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        scheduler.onApplicationReady();

        verify(savingsGoalRepository, times(1)).findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class));
    }
}
