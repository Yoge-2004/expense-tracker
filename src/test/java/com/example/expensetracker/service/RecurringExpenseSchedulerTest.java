package com.example.expensetracker.service;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("RecurringExpenseScheduler Tests")
class RecurringExpenseSchedulerTest {

    @Mock RecurringExpenseRepository recurringExpenseRepository;
    @Mock ExpenseRepository expenseRepository;
    @InjectMocks RecurringExpenseScheduler scheduler;

    static Stream<Arguments> recurrenceIntervals() {
        return Stream.of(
                Arguments.of("DAILY", null, 1),
                Arguments.of("WEEKLY", null, 7),
                Arguments.of("MONTHLY", null, 0),
                Arguments.of("YEARLY", null, 0),
                Arguments.of("CUSTOM", 10, 10)
        );
    }

    @ParameterizedTest(name = "{0} advances after processing a due charge")
    @MethodSource("recurrenceIntervals")
    void dueSubscription_createsExpenseAndAdvances(String frequency, Integer intervalDays, int expectedDays) {
        LocalDate today = LocalDate.now();
        RecurringExpense recurring = subscription(frequency, intervalDays, today);
        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(recurring));

        scheduler.processRecurringExpenses();

        ArgumentCaptor<Expense> expense = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepository).save(expense.capture());
        assertThat(expense.getValue().getExpenseDate()).isEqualTo(today);
        assertThat(expense.getValue().getDescription()).isEqualTo("Subscription (Auto)");

        LocalDate expected = switch (frequency) {
            case "MONTHLY" -> today.plusMonths(1);
            case "YEARLY" -> today.plusYears(1);
            default -> today.plusDays(expectedDays);
        };
        assertThat(recurring.getNextDueDate()).isEqualTo(expected);
        verify(recurringExpenseRepository).save(recurring);
    }

    @Test
    void overdueCustomSubscription_createsEveryMissedOccurrence() {
        LocalDate today = LocalDate.now();
        RecurringExpense recurring = subscription("CUSTOM", 3, today.minusDays(6));
        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(recurring));

        scheduler.processRecurringExpenses();

        ArgumentCaptor<Expense> expenses = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepository, times(3)).save(expenses.capture());
        assertThat(expenses.getAllValues()).extracting(Expense::getExpenseDate)
                .containsExactly(today.minusDays(6), today.minusDays(3), today);
        assertThat(recurring.getNextDueDate()).isEqualTo(today.plusDays(3));
    }

    @Test
    void onApplicationReady_callsProcessRecurringExpenses() {
        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of());

        scheduler.onApplicationReady();

        verify(recurringExpenseRepository).findByNextDueDateLessThanEqual(any(LocalDate.class));
    }

    private RecurringExpense subscription(String frequency, Integer intervalDays, LocalDate nextDueDate) {
        User user = new User();
        user.setId(1L);
        Category category = new Category();
        category.setId(1L);
        RecurringExpense recurring = new RecurringExpense();
        recurring.setAmount(new BigDecimal("99.00"));
        recurring.setDescription("Subscription");
        recurring.setFrequency(frequency);
        recurring.setIntervalDays(intervalDays);
        recurring.setNextDueDate(nextDueDate);
        recurring.setUser(user);
        recurring.setCategory(category);
        return recurring;
    }
}
