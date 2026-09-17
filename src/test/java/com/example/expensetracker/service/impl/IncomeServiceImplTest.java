package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.CashFlowSummaryDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
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
class IncomeServiceImplTest {

    @Mock
    private IncomeRepository incomeRepository;
    @Mock
    private ExpenseRepository expenseRepository;

    private IncomeServiceImpl service;
    private User user;
    private User otherUser;

    @BeforeEach
    void setUp() {
        service = new IncomeServiceImpl(incomeRepository, expenseRepository);
        user = new User();
        user.setId(1L);
        user.setEmail("user@example.com");

        otherUser = new User();
        otherUser.setId(2L);
        otherUser.setEmail("other@example.com");
    }

    @Test
    @DisplayName("createIncome rejects non-positive or null amount")
    void createIncome_invalidAmount_throwsException() {
        IncomeRequest nullReq = new IncomeRequest(null, "Salary", "Bonus", LocalDate.now(), false, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.createIncome(nullReq, user));

        IncomeRequest zeroReq = new IncomeRequest(BigDecimal.ZERO, "Salary", "Bonus", LocalDate.now(), false, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.createIncome(zeroReq, user));

        IncomeRequest negReq = new IncomeRequest(BigDecimal.valueOf(-50), "Salary", "Bonus", LocalDate.now(), false, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.createIncome(negReq, user));

        verify(incomeRepository, never()).save(any());
    }

    @Test
    @DisplayName("createIncome rejects blank or null source")
    void createIncome_blankSource_throwsException() {
        IncomeRequest nullSource = new IncomeRequest(BigDecimal.valueOf(100), null, "Bonus", LocalDate.now(), false, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.createIncome(nullSource, user));

        IncomeRequest blankSource = new IncomeRequest(BigDecimal.valueOf(100), "   ", "Bonus", LocalDate.now(), false, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.createIncome(blankSource, user));

        verify(incomeRepository, never()).save(any());
    }

    @Test
    @DisplayName("createIncome creates one-off income with nullified recurring fields")
    void createIncome_oneOff_success() {
        LocalDate date = LocalDate.of(2026, 9, 15);
        IncomeRequest req = new IncomeRequest(BigDecimal.valueOf(2500), "Freelance", "Project payment", date, false, "MONTHLY", 1);

        when(incomeRepository.save(any(Income.class))).thenAnswer(inv -> {
            Income saved = inv.getArgument(0);
            saved.setId(101L);
            return saved;
        });

        IncomeDto result = service.createIncome(req, user);

        assertNotNull(result);
        assertEquals(101L, result.id());
        assertEquals(BigDecimal.valueOf(2500), result.amount());
        assertEquals("Freelance", result.source());
        assertFalse(result.isRecurring());
        assertNull(result.frequency());
        assertNull(result.nextDueDate());
    }

    @Test
    @DisplayName("createIncome creates recurring income with calculated nextDueDate")
    void createIncome_recurring_success() {
        LocalDate date = LocalDate.of(2026, 9, 1);
        IncomeRequest req = new IncomeRequest(BigDecimal.valueOf(5000), "Salary", "Monthly Paycheck", date, true, "MONTHLY", 1);

        when(incomeRepository.save(any(Income.class))).thenAnswer(inv -> {
            Income saved = inv.getArgument(0);
            saved.setId(102L);
            return saved;
        });

        IncomeDto result = service.createIncome(req, user);

        assertNotNull(result);
        assertEquals(102L, result.id());
        assertTrue(result.isRecurring());
        assertEquals("MONTHLY", result.frequency());
        assertEquals(LocalDate.of(2026, 10, 1), result.nextDueDate());
    }

    @Test
    @DisplayName("getUserIncomes retrieves all incomes for user")
    void getUserIncomes_returnsList() {
        Income income = new Income();
        income.setId(201L);
        income.setUser(user);
        income.setAmount(BigDecimal.valueOf(1200));
        income.setSource("Dividends");
        income.setIncomeDate(LocalDate.of(2026, 8, 1));
        income.setIsRecurring(false);

        when(incomeRepository.findByUser(user)).thenReturn(List.of(income));

        List<IncomeDto> list = service.getUserIncomes(user);

        assertEquals(1, list.size());
        assertEquals("Dividends", list.get(0).source());
        verify(incomeRepository).findByUser(user);
    }

    @Test
    @DisplayName("updateIncome throws IllegalArgumentException when income not found")
    void updateIncome_notFound_throwsException() {
        when(incomeRepository.findById(999L)).thenReturn(Optional.empty());
        IncomeRequest req = new IncomeRequest(BigDecimal.valueOf(100), "Interest", null, null, null, null, null);

        assertThrows(IllegalArgumentException.class, () -> service.updateIncome(999L, req, user));
        verify(incomeRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateIncome throws IllegalArgumentException when user does not own the income")
    void updateIncome_otherUser_throwsException() {
        Income income = new Income();
        income.setId(301L);
        income.setUser(otherUser);
        when(incomeRepository.findById(301L)).thenReturn(Optional.of(income));

        IncomeRequest req = new IncomeRequest(BigDecimal.valueOf(100), "Interest", null, null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.updateIncome(301L, req, user));
        verify(incomeRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateIncome updates amount, source and recurring flags")
    void updateIncome_success() {
        Income income = new Income();
        income.setId(401L);
        income.setUser(user);
        income.setAmount(BigDecimal.valueOf(500));
        income.setSource("Old Source");
        income.setIsRecurring(false);

        when(incomeRepository.findById(401L)).thenReturn(Optional.of(income));
        when(incomeRepository.save(any(Income.class))).thenAnswer(inv -> inv.getArgument(0));

        IncomeRequest req = new IncomeRequest(BigDecimal.valueOf(750), "New Source", "Updated notes", LocalDate.of(2026, 9, 10), false, null, null);
        IncomeDto updated = service.updateIncome(401L, req, user);

        assertEquals(BigDecimal.valueOf(750), updated.amount());
        assertEquals("New Source", updated.source());
        assertEquals("Updated notes", updated.description());
        verify(incomeRepository).save(income);
    }

    @Test
    @DisplayName("deleteIncome throws when not found or user mismatch")
    void deleteIncome_validatesOwnership() {
        when(incomeRepository.findById(500L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.deleteIncome(500L, user));

        Income otherIncome = new Income();
        otherIncome.setId(501L);
        otherIncome.setUser(otherUser);
        when(incomeRepository.findById(501L)).thenReturn(Optional.of(otherIncome));
        assertThrows(IllegalArgumentException.class, () -> service.deleteIncome(501L, user));
        verify(incomeRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteIncome deletes owned income record")
    void deleteIncome_success() {
        Income income = new Income();
        income.setId(502L);
        income.setUser(user);
        when(incomeRepository.findById(502L)).thenReturn(Optional.of(income));

        service.deleteIncome(502L, user);

        verify(incomeRepository).delete(income);
    }

    @Test
    @DisplayName("getCashFlowSummary computes net savings and savings rate correctly")
    void getCashFlowSummary_calculatesMetrics() {
        LocalDate start = LocalDate.of(2026, 9, 1);
        LocalDate end = LocalDate.of(2026, 9, 30);

        Income inc1 = new Income();
        inc1.setAmount(BigDecimal.valueOf(3000));
        inc1.setIncomeDate(LocalDate.of(2026, 9, 5));

        Income inc2 = new Income();
        inc2.setAmount(BigDecimal.valueOf(2000));
        inc2.setIncomeDate(LocalDate.of(2026, 9, 20));

        Expense exp = new Expense();
        exp.setAmount(BigDecimal.valueOf(2500));
        exp.setExpenseDate(LocalDate.of(2026, 9, 10));

        when(incomeRepository.findByUserAndIncomeDateBetween(user, start, end)).thenReturn(List.of(inc1, inc2));
        when(expenseRepository.findByUserAndExpenseDateBetween(user, start, end)).thenReturn(List.of(exp));

        CashFlowSummaryDto summary = service.getCashFlowSummary(user, 2026, 9);

        assertNotNull(summary);
        assertEquals(2026, summary.year());
        assertEquals(9, summary.month());
        assertEquals(BigDecimal.valueOf(5000), summary.totalIncome());
        assertEquals(BigDecimal.valueOf(2500), summary.totalExpense());
        assertEquals(BigDecimal.valueOf(2500), summary.netSavings());
        assertEquals(50.0, summary.savingsRate());
        assertEquals(2, summary.incomeCount());
        assertEquals(1, summary.expenseCount());
    }

    @Test
    @DisplayName("getCashFlowSummary handles zero income without divide-by-zero")
    void getCashFlowSummary_zeroIncome_handlesGracefully() {
        LocalDate start = LocalDate.of(2026, 9, 1);
        LocalDate end = LocalDate.of(2026, 9, 30);

        when(incomeRepository.findByUserAndIncomeDateBetween(user, start, end)).thenReturn(List.of());
        when(expenseRepository.findByUserAndExpenseDateBetween(user, start, end)).thenReturn(List.of());

        CashFlowSummaryDto summary = service.getCashFlowSummary(user, 2026, 9);

        assertNotNull(summary);
        assertEquals(BigDecimal.ZERO, summary.totalIncome());
        assertEquals(BigDecimal.ZERO, summary.totalExpense());
        assertEquals(BigDecimal.ZERO, summary.netSavings());
        assertEquals(0.0, summary.savingsRate());
    }
}
