package com.example.expensetracker.service;

import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.SavingsGoalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("RecurringSavingsScheduler Unit Tests")
class RecurringSavingsSchedulerTest {

    @Mock
    private SavingsGoalRepository savingsGoalRepository;

    private RecurringSavingsScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new RecurringSavingsScheduler(savingsGoalRepository);
    }

    @Test
    @DisplayName("processRecurringSavings -> processes due chit installment and advances nextDueDate")
    void processRecurringSavings_advancesDueInstallment() {
        User user = new User();
        user.setId(1L);

        SavingsGoal goal = new SavingsGoal();
        goal.setId(10L);
        goal.setName("Chit Fund #1");
        goal.setTargetAmount(new BigDecimal("100000.00"));
        goal.setCurrentAmount(new BigDecimal("10000.00"));
        goal.setIsRecurring(true);
        goal.setRecurringAmount(new BigDecimal("5000.00"));
        goal.setFrequency("MONTHLY");
        goal.setNextDueDate(LocalDate.now().minusDays(1));
        goal.setUser(user);

        when(savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(goal));

        scheduler.processRecurringSavings();

        ArgumentCaptor<SavingsGoal> captor = ArgumentCaptor.forClass(SavingsGoal.class);
        verify(savingsGoalRepository).save(captor.capture());

        SavingsGoal updated = captor.getValue();
        assertThat(updated.getCurrentAmount()).isEqualByComparingTo(new BigDecimal("15000.00"));
        assertThat(updated.getNextDueDate()).isAfter(LocalDate.now());
    }

    @Test
    @DisplayName("processRecurringSavings -> marks goal COMPLETED when cumulative installments reach target")
    void processRecurringSavings_marksCompletedWhenTargetReached() {
        User user = new User();
        user.setId(1L);

        SavingsGoal goal = new SavingsGoal();
        goal.setId(11L);
        goal.setName("Emergency RD");
        goal.setTargetAmount(new BigDecimal("50000.00"));
        goal.setCurrentAmount(new BigDecimal("45000.00"));
        goal.setIsRecurring(true);
        goal.setRecurringAmount(new BigDecimal("5000.00"));
        goal.setFrequency("MONTHLY");
        goal.setNextDueDate(LocalDate.now());
        goal.setUser(user);

        when(savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(goal));

        scheduler.processRecurringSavings();

        ArgumentCaptor<SavingsGoal> captor = ArgumentCaptor.forClass(SavingsGoal.class);
        verify(savingsGoalRepository).save(captor.capture());

        SavingsGoal updated = captor.getValue();
        assertThat(updated.getCurrentAmount()).isEqualByComparingTo(new BigDecimal("50000.00"));
        assertThat(updated.getStatus()).isEqualTo("COMPLETED");
    }
}
