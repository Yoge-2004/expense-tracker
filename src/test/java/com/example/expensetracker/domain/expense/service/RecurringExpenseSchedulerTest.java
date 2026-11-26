package com.example.expensetracker.domain.expense.service;

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

import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.model.RecurringExpense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;
import com.example.expensetracker.domain.user.model.User;




@ExtendWith(MockitoExtension.class)
class RecurringExpenseSchedulerTest {

    @Mock
    private RecurringExpenseRepository recurringExpenseRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    @InjectMocks
    private RecurringExpenseScheduler scheduler;

    private User testUser;
    private Category testCategory;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setEmail("scheduler@test.com");

        testCategory = new Category();
        testCategory.setId(10L);
        testCategory.setName("Subscriptions");
    }

    @Test
    @DisplayName("processRecurringExpenses does nothing when no expenses are due")
    void testProcessRecurringExpenses_NoneDue() {
        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        scheduler.processRecurringExpenses();

        verify(expenseRepository, never()).save(any());
        verify(recurringExpenseRepository, never()).save(any());
    }

    @Test
    @DisplayName("processRecurringExpenses processes a due monthly recurring expense")
    void testProcessRecurringExpenses_MonthlySuccess() {
        LocalDate today = LocalDate.now();
        RecurringExpense rec = new RecurringExpense();
        rec.setId(100L);
        rec.setAmount(new BigDecimal("19.99"));
        rec.setDescription("Netflix");
        rec.setFrequency("MONTHLY");
        rec.setNextDueDate(today);
        rec.setUser(testUser);
        rec.setCategory(testCategory);

        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(rec));

        scheduler.processRecurringExpenses();

        ArgumentCaptor<Expense> expenseCaptor = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepository, times(1)).save(expenseCaptor.capture());

        Expense savedExpense = expenseCaptor.getValue();
        assertEquals(new BigDecimal("19.99"), savedExpense.getAmount());
        assertEquals("Netflix (Auto)", savedExpense.getDescription());
        assertEquals(today, savedExpense.getExpenseDate());
        assertEquals(testUser, savedExpense.getUser());
        assertEquals(testCategory, savedExpense.getCategory());

        // Next due date rolled forward by 1 month
        assertEquals(today.plusMonths(1), rec.getNextDueDate());
        verify(recurringExpenseRepository, times(1)).save(rec);
    }

    @Test
    @DisplayName("processRecurringExpenses handles weekly and custom frequency correctly")
    void testProcessRecurringExpenses_WeeklyAndCustom() {
        LocalDate today = LocalDate.now();

        RecurringExpense weekly = new RecurringExpense();
        weekly.setId(101L);
        weekly.setAmount(new BigDecimal("50.00"));
        weekly.setDescription("Weekly Gym");
        weekly.setFrequency("WEEKLY");
        weekly.setNextDueDate(today);
        weekly.setUser(testUser);
        weekly.setCategory(testCategory);

        RecurringExpense custom = new RecurringExpense();
        custom.setId(102L);
        custom.setAmount(new BigDecimal("75.00"));
        custom.setDescription("Bi-weekly cleaning");
        custom.setFrequency("CUSTOM");
        custom.setIntervalDays(14);
        custom.setNextDueDate(today);
        custom.setUser(testUser);
        custom.setCategory(testCategory);

        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(weekly, custom));

        scheduler.processRecurringExpenses();

        verify(expenseRepository, times(2)).save(any(Expense.class));
        assertEquals(today.plusWeeks(1), weekly.getNextDueDate());
        assertEquals(today.plusDays(14), custom.getNextDueDate());
        verify(recurringExpenseRepository, times(2)).save(any(RecurringExpense.class));
    }

    @Test
    @DisplayName("processRecurringExpenses catches up multiple missed occurrences")
    void testProcessRecurringExpenses_MultipleMissedOccurrences() {
        LocalDate twoMonthsAgo = LocalDate.now().minusMonths(2);

        RecurringExpense rec = new RecurringExpense();
        rec.setId(103L);
        rec.setAmount(new BigDecimal("10.00"));
        rec.setDescription("Server Hosting");
        rec.setFrequency("MONTHLY");
        rec.setNextDueDate(twoMonthsAgo);
        rec.setUser(testUser);
        rec.setCategory(testCategory);

        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(rec));

        scheduler.processRecurringExpenses();

        // Should catch up at -2 months, -1 month, and today (3 occurrences)
        verify(expenseRepository, times(3)).save(any(Expense.class));
        assertTrue(rec.getNextDueDate().isAfter(LocalDate.now()));
        verify(recurringExpenseRepository, times(1)).save(rec);
    }

    @Test
    @DisplayName("processRecurringExpenses continues processing when one record fails")
    void testProcessRecurringExpenses_FailureIsolation() {
        LocalDate today = LocalDate.now();

        RecurringExpense faultyRec = new RecurringExpense();
        faultyRec.setId(201L);
        faultyRec.setAmount(new BigDecimal("10.00"));
        faultyRec.setDescription("Faulty Subscription");
        faultyRec.setFrequency("MONTHLY");
        faultyRec.setNextDueDate(today);

        RecurringExpense validRec = new RecurringExpense();
        validRec.setId(202L);
        validRec.setAmount(new BigDecimal("20.00"));
        validRec.setDescription("Valid Subscription");
        validRec.setFrequency("MONTHLY");
        validRec.setNextDueDate(today);
        validRec.setUser(testUser);
        validRec.setCategory(testCategory);

        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(faultyRec, validRec));

        // Let saving the faulty expense throw a runtime exception
        doThrow(new RuntimeException("Database error saving expense"))
                .doAnswer(invocation -> invocation.getArgument(0))
                .when(expenseRepository).save(any(Expense.class));

        assertDoesNotThrow(() -> scheduler.processRecurringExpenses());

        // The valid record should still be saved
        verify(recurringExpenseRepository, times(1)).save(validRec);
    }

    @Test
    @DisplayName("onApplicationReady triggers processRecurringExpenses")
    void testOnApplicationReady() {
        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        scheduler.onApplicationReady();

        verify(recurringExpenseRepository, times(1)).findByNextDueDateLessThanEqual(any(LocalDate.class));
    }

    private RecurringExpense dueSubscription(long id) {
        RecurringExpense rec = new RecurringExpense();
        rec.setId(id);
        rec.setAmount(new BigDecimal("10.00"));
        rec.setDescription("Sub " + id);
        rec.setFrequency("MONTHLY");
        rec.setNextDueDate(LocalDate.now());
        rec.setUser(testUser);
        rec.setCategory(testCategory);
        return rec;
    }

    @Test
    @DisplayName("auto-generated expenses are flagged recurring so reports count them as recurring spend")
    void generatedExpenseIsFlaggedRecurring() {
        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(dueSubscription(1L)));

        scheduler.processRecurringExpenses();

        ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepository).save(captor.capture());
        org.junit.jupiter.api.Assertions.assertTrue(captor.getValue().isRecurring());
    }

    @Test
    @DisplayName("each subscription commits in its own transaction, so one failure rolls back only that one")
    void eachSubscriptionHasItsOwnTransaction() {
        org.springframework.transaction.PlatformTransactionManager tm =
                org.mockito.Mockito.mock(org.springframework.transaction.PlatformTransactionManager.class);
        org.springframework.test.util.ReflectionTestUtils.setField(scheduler, "transactionTemplate",
                new org.springframework.transaction.support.TransactionTemplate(tm));

        RecurringExpense failing = dueSubscription(1L);
        RecurringExpense healthy = dueSubscription(2L);
        when(recurringExpenseRepository.findByNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(failing, healthy));
        when(recurringExpenseRepository.findById(1L)).thenReturn(java.util.Optional.of(failing));
        when(recurringExpenseRepository.findById(2L)).thenReturn(java.util.Optional.of(healthy));
        when(expenseRepository.save(any(Expense.class)))
                .thenThrow(new IllegalStateException("database hiccup"))
                .thenAnswer(invocation -> invocation.getArgument(0));

        scheduler.processRecurringExpenses();

        verify(tm, times(1)).rollback(any());
        verify(tm, times(1)).commit(any());
        assertEquals(LocalDate.now().plusMonths(1), healthy.getNextDueDate());
    }
}
