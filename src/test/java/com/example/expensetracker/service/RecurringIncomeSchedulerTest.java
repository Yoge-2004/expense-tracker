package com.example.expensetracker.service;

import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.IncomeRepository;
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
class RecurringIncomeSchedulerTest {

    @Mock
    private IncomeRepository incomeRepository;

    @InjectMocks
    private RecurringIncomeScheduler scheduler;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setEmail("income_sched@test.com");
    }

    @Test
    @DisplayName("processRecurringIncomes does nothing when no recurring incomes are due")
    void testProcessRecurringIncomes_NoneDue() {
        when(incomeRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        scheduler.processRecurringIncomes();

        verify(incomeRepository, never()).save(any());
    }

    @Test
    @DisplayName("processRecurringIncomes processes due monthly recurring income")
    void testProcessRecurringIncomes_MonthlySuccess() {
        LocalDate today = LocalDate.now();
        Income rec = new Income();
        rec.setId(50L);
        rec.setAmount(new BigDecimal("4500.00"));
        rec.setSource("Salary");
        rec.setDescription("Monthly Corporate Salary");
        rec.setIsRecurring(true);
        rec.setFrequency("MONTHLY");
        rec.setNextDueDate(today);
        rec.setUser(testUser);

        when(incomeRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(rec));

        scheduler.processRecurringIncomes();

        ArgumentCaptor<Income> incomeCaptor = ArgumentCaptor.forClass(Income.class);
        // Once for concrete income, once for recurring rule update
        verify(incomeRepository, times(2)).save(incomeCaptor.capture());

        List<Income> savedIncomes = incomeCaptor.getAllValues();
        Income concreteIncome = savedIncomes.get(0);
        assertEquals(new BigDecimal("4500.00"), concreteIncome.getAmount());
        assertEquals("Salary", concreteIncome.getSource());
        assertEquals("Monthly Corporate Salary (Auto)", concreteIncome.getDescription());
        assertEquals(today, concreteIncome.getIncomeDate());
        assertFalse(concreteIncome.getIsRecurring());
        assertEquals(testUser, concreteIncome.getUser());

        Income updatedRule = savedIncomes.get(1);
        assertEquals(today.plusMonths(1), updatedRule.getNextDueDate());
    }

    @Test
    @DisplayName("processRecurringIncomes supports custom frequency and falls back when description is blank")
    void testProcessRecurringIncomes_CustomAndBlankDesc() {
        LocalDate today = LocalDate.now();
        Income rec = new Income();
        rec.setId(51L);
        rec.setAmount(new BigDecimal("600.00"));
        rec.setSource("Freelance Retainer");
        rec.setDescription(""); // blank description
        rec.setIsRecurring(true);
        rec.setFrequency("CUSTOM");
        rec.setIntervalDays(15);
        rec.setNextDueDate(today);
        rec.setUser(testUser);

        when(incomeRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(rec));

        scheduler.processRecurringIncomes();

        ArgumentCaptor<Income> incomeCaptor = ArgumentCaptor.forClass(Income.class);
        verify(incomeRepository, times(2)).save(incomeCaptor.capture());

        Income concrete = incomeCaptor.getAllValues().get(0);
        // Should fall back to source + " (Auto)"
        assertEquals("Freelance Retainer (Auto)", concrete.getDescription());
        assertEquals(today.plusDays(15), rec.getNextDueDate());
    }

    @Test
    @DisplayName("processRecurringIncomes handles item exception without breaking the entire run")
    void testProcessRecurringIncomes_ItemFailureIsolation() {
        LocalDate today = LocalDate.now();

        Income faulty = new Income();
        faulty.setId(52L);
        faulty.setAmount(new BigDecimal("100.00"));
        faulty.setSource("Faulty");
        faulty.setIsRecurring(true);
        faulty.setNextDueDate(today);

        Income valid = new Income();
        valid.setId(53L);
        valid.setAmount(new BigDecimal("200.00"));
        valid.setSource("Valid");
        valid.setIsRecurring(true);
        valid.setFrequency("WEEKLY");
        valid.setNextDueDate(today);
        valid.setUser(testUser);

        when(incomeRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(List.of(faulty, valid));

        doThrow(new RuntimeException("DB write error"))
                .doAnswer(inv -> inv.getArgument(0))
                .doAnswer(inv -> inv.getArgument(0))
                .when(incomeRepository).save(any(Income.class));

        assertDoesNotThrow(() -> scheduler.processRecurringIncomes());

        assertEquals(today.plusWeeks(1), valid.getNextDueDate());
    }

    @Test
    @DisplayName("onApplicationReady executes check for missed incomes")
    void testOnApplicationReady() {
        when(incomeRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        scheduler.onApplicationReady();

        verify(incomeRepository, times(1)).findByIsRecurringTrueAndNextDueDateLessThanEqual(any(LocalDate.class));
    }
}
