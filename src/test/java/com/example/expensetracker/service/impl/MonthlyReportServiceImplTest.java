package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.exception.EmailDeliveryException;
import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("MonthlyReportServiceImpl Unit Tests")
class MonthlyReportServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private IncomeRepository incomeRepository;

    @Mock
    private SavingsGoalRepository savingsGoalRepository;

    @Mock
    private BudgetRepository budgetRepository;

    @Mock
    private MonthlyReportLogRepository reportLogRepository;

    @Mock
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    private MonthlyReportServiceImpl reportService;

    private User testUser;
    private Expense testExpense;
    private Income testIncome;
    private Budget testBudget;
    private SavingsGoal testGoal;

    @BeforeEach
    void setUp() {
        reportService = new MonthlyReportServiceImpl(
                userRepository,
                expenseRepository,
                incomeRepository,
                savingsGoalRepository,
                budgetRepository,
                reportLogRepository,
                mailSenderProvider
        );

        testUser = new User();
        testUser.setId(1L);
        testUser.setName("Alice Walker");
        testUser.setEmail("alice@example.com");
        testUser.setCurrency("USD");

        Category foodCategory = new Category();
        foodCategory.setId(10L);
        foodCategory.setName("Dining");

        testExpense = new Expense();
        testExpense.setId(101L);
        testExpense.setUser(testUser);
        testExpense.setAmount(new BigDecimal("200.00"));
        testExpense.setDescription("Dinner Party");
        testExpense.setExpenseDate(LocalDate.of(2026, 8, 15));
        testExpense.setCategory(foodCategory);
        testExpense.setRecurring(false);

        testIncome = new Income();
        testIncome.setId(201L);
        testIncome.setUser(testUser);
        testIncome.setAmount(new BigDecimal("1000.00"));
        testIncome.setSource("Salary");
        testIncome.setIncomeDate(LocalDate.of(2026, 8, 1));
        testIncome.setIsRecurring(true);

        testBudget = new Budget();
        testBudget.setId(301L);
        testBudget.setUser(testUser);
        testBudget.setCategory(foodCategory);
        testBudget.setLimitAmount(new BigDecimal("300.00"));

        testGoal = new SavingsGoal();
        testGoal.setId(401L);
        testGoal.setUser(testUser);
        testGoal.setName("Vacation");
        testGoal.setTargetAmount(new BigDecimal("2000.00"));
        testGoal.setCurrentAmount(new BigDecimal("500.00"));
        testGoal.setStatus("IN_PROGRESS");
    }

    @Test
    @DisplayName("generateMonthlyReport: calculates accurate aggregates, net flow, and savings rate")
    void generateMonthlyReport_success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(testExpense));
        when(incomeRepository.findByUserAndIncomeDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(testIncome));
        when(savingsGoalRepository.findByUser(testUser)).thenReturn(List.of(testGoal));
        when(budgetRepository.findByUser(testUser)).thenReturn(List.of(testBudget));

        MonthlyReportDto report = reportService.generateMonthlyReport(1L, 2026, 8);

        assertNotNull(report);
        assertEquals(2026, report.year());
        assertEquals(8, report.month());
        assertEquals(new BigDecimal("200.00"), report.totalOutflow());
        assertEquals(new BigDecimal("1000.00"), report.totalIncome());
        assertEquals(new BigDecimal("800.00"), report.netCashFlow());
        assertEquals(80.0, report.savingsRate());
        assertEquals(1, report.transactionCount());
        assertEquals(100, report.budgetHealthScore());
        assertFalse(report.insights().isEmpty());
    }

    @Test
    @DisplayName("generateMonthlyReport: throws IllegalArgumentException when userId is null")
    void generateMonthlyReport_nullUserId() {
        assertThrows(IllegalArgumentException.class, () -> reportService.generateMonthlyReport(null, 2026, 8));
    }

    @Test
    @DisplayName("generateMonthlyReport: throws IllegalArgumentException when month is invalid")
    void generateMonthlyReport_invalidMonth() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> reportService.generateMonthlyReport(1L, 2026, 13));
        assertTrue(ex.getMessage().contains("Month must be between 1 and 12"));
    }

    @Test
    @DisplayName("generateMonthlyReport: throws IllegalArgumentException when year is out of bounds")
    void generateMonthlyReport_invalidYear() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> reportService.generateMonthlyReport(1L, 1899, 5));
        assertTrue(ex.getMessage().contains("Year must be between 1900 and 2100"));
    }

    @Test
    @DisplayName("generateMonthlyReport: throws IllegalArgumentException when user does not exist")
    void generateMonthlyReport_userNotFound() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> reportService.generateMonthlyReport(999L, 2026, 8));
        assertTrue(ex.getMessage().contains("User not found"));
    }

    @Test
    @DisplayName("generateMonthlyReportHtml: renders responsive standalone HTML report")
    void generateMonthlyReportHtml_success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(testExpense));
        when(incomeRepository.findByUserAndIncomeDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(testIncome));
        when(savingsGoalRepository.findByUser(testUser)).thenReturn(Collections.emptyList());
        when(budgetRepository.findByUser(testUser)).thenReturn(Collections.emptyList());

        String html = reportService.generateMonthlyReportHtml(1L, 2026, 8);

        assertNotNull(html);
        assertTrue(html.contains("<!DOCTYPE html>"));
        assertTrue(html.contains("Alice Walker"));
        assertTrue(html.contains("Executive Financial Summary"));
        assertTrue(html.contains("August 2026"));
    }

    @Test
    @DisplayName("generateMonthlyReportHtml: throws IllegalArgumentException when userId is null")
    void generateMonthlyReportHtml_nullUserId() {
        assertThrows(IllegalArgumentException.class, () -> reportService.generateMonthlyReportHtml(null, 2026, 8));
    }

    @Test
    @DisplayName("sendMonthlyReportEmail: throws EmailDeliveryException and records failure log when mail delivery is disabled")
    void sendMonthlyReportEmail_disabledMailThrowsAndLogs() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(reportLogRepository.findByUserAndReportYearAndReportMonth(testUser, 2026, 8))
                .thenReturn(Optional.empty());

        EmailDeliveryException ex = assertThrows(EmailDeliveryException.class,
                () -> reportService.sendMonthlyReportEmail(1L, 2026, 8));
        assertTrue(ex.getMessage().contains("Email delivery is disabled or unconfigured"));

        verify(reportLogRepository).save(any(MonthlyReportLog.class));
    }

    @Test
    @DisplayName("sendMonthlyReportEmail: throws IllegalArgumentException on invalid params")
    void sendMonthlyReportEmail_invalidParams() {
        assertThrows(IllegalArgumentException.class, () -> reportService.sendMonthlyReportEmail(null, 2026, 8));
        assertThrows(IllegalArgumentException.class, () -> reportService.sendMonthlyReportEmail(1L, 2026, 0));
        assertThrows(IllegalArgumentException.class, () -> reportService.sendMonthlyReportEmail(1L, 1800, 8));
    }
}
