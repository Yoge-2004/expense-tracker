package com.example.expensetracker.service;

import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.MonthlyReportLogRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.impl.MonthlyReportServiceImpl;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

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
class MonthlyReportServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private IncomeRepository incomeRepository;
    @Mock private SavingsGoalRepository savingsGoalRepository;
    @Mock private BudgetRepository budgetRepository;
    @Mock private MonthlyReportLogRepository reportLogRepository;
    @Mock private ObjectProvider<JavaMailSender> mailSenderProvider;
    @Mock private JavaMailSender mailSender;
    @Mock private MimeMessage mimeMessage;

    private MonthlyReportServiceImpl service;
    private User testUser;

    @BeforeEach
    void setUp() {
        service = new MonthlyReportServiceImpl(
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
        testUser.setName("Yogeshwaran");
        testUser.setEmail("yoge@example.com");
        testUser.setCurrency("INR");
    }

    @Test
    @DisplayName("generateMonthlyReport → Aggregates total outflow, income, savings, and category breakdown correctly")
    void generateMonthlyReport_aggregatesCorrectly() {
        Category food = new Category(); food.setId(1L); food.setName("Food");
        Category travel = new Category(); travel.setId(2L); travel.setName("Travel");

        Expense e1 = new Expense(); e1.setAmount(new BigDecimal("150.00")); e1.setCategory(food); e1.setExpenseDate(LocalDate.of(2026, 8, 10));
        Expense e2 = new Expense(); e2.setAmount(new BigDecimal("350.00")); e2.setCategory(travel); e2.setExpenseDate(LocalDate.of(2026, 8, 12));

        Income i1 = new Income(); i1.setAmount(new BigDecimal("2000.00")); i1.setSource("Salary"); i1.setIncomeDate(LocalDate.of(2026, 8, 1));

        SavingsGoal sg1 = new SavingsGoal();
        sg1.setId(10L);
        sg1.setName("Emergency Fund");
        sg1.setTargetAmount(new BigDecimal("50000.00"));
        sg1.setCurrentAmount(new BigDecimal("25000.00"));
        sg1.setStatus("IN_PROGRESS");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(e1, e2));
        when(incomeRepository.findByUserAndIncomeDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(i1));
        when(savingsGoalRepository.findByUser(testUser)).thenReturn(List.of(sg1));
        when(budgetRepository.findByUser(testUser)).thenReturn(Collections.emptyList());

        MonthlyReportDto report = service.generateMonthlyReport(1L, 2026, 8);

        assertNotNull(report);
        assertEquals("August 2026", report.getPeriod());
        assertEquals(new BigDecimal("500.00"), report.getTotalOutflow());
        assertEquals(new BigDecimal("2000.00"), report.getTotalIncome());
        assertEquals(new BigDecimal("1500.00"), report.getNetCashFlow());
        assertEquals(75.0, report.getSavingsRate());
        assertEquals("INR", report.getCurrency());
        assertEquals(2, report.getTransactionCount());
        assertEquals(2, report.getCategoryBreakdown().size());
        assertEquals("Travel", report.getCategoryBreakdown().get(0).getCategoryName());
        assertEquals(1, report.getIncomes().size());
        assertEquals(1, report.getSavingsGoals().size());
        assertEquals(50.0, report.getSavingsGoals().get(0).getProgressPercentage());
        assertTrue(report.getInsights().stream().anyMatch(ins -> ins.contains("Cash Flow")));
    }

    @Test
    @DisplayName("generateMonthlyReportHtml → Generates valid HTML containing incomes and savings")
    void generateMonthlyReportHtml_containsIncomeAndSavings() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());
        when(incomeRepository.findByUserAndIncomeDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());
        when(savingsGoalRepository.findByUser(testUser)).thenReturn(Collections.emptyList());
        when(budgetRepository.findByUser(testUser)).thenReturn(Collections.emptyList());

        String html = service.generateMonthlyReportHtml(1L, 2026, 8);

        assertNotNull(html);
        assertTrue(html.contains("Monthly Income Sources"));
        assertTrue(html.contains("Active Savings Goals & Milestones"));
    }

    @Test
    @DisplayName("sendMonthlyReportEmail → Triggers HTML email delivery and saves log when mail host configured")
    void sendMonthlyReportEmail_sendsMimeMessageAndSavesLog() {
        ReflectionTestUtils.setField(service, "configuredMailHost", "smtp.gmail.com");
        ReflectionTestUtils.setField(service, "mailEnabled", true);

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(reportLogRepository.existsByUserAndReportYearAndReportMonthAndSentSuccessfullyTrue(testUser, 2026, 8)).thenReturn(false);
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());
        when(incomeRepository.findByUserAndIncomeDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());
        when(savingsGoalRepository.findByUser(testUser)).thenReturn(Collections.emptyList());
        when(budgetRepository.findByUser(testUser)).thenReturn(Collections.emptyList());
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        service.sendMonthlyReportEmail(1L, 2026, 8);

        verify(mailSender).createMimeMessage();
        verify(mailSender).send(mimeMessage);
        verify(reportLogRepository).save(any());
    }

    @Test
    @DisplayName("sendMonthlyReportEmail → Skips dispatch if report already sent in database")
    void sendMonthlyReportEmail_skipsIfAlreadySent() {
        ReflectionTestUtils.setField(service, "configuredMailHost", "smtp.gmail.com");
        ReflectionTestUtils.setField(service, "mailEnabled", true);

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(reportLogRepository.existsByUserAndReportYearAndReportMonthAndSentSuccessfullyTrue(testUser, 2026, 8)).thenReturn(true);

        service.sendMonthlyReportEmail(1L, 2026, 8);

        verify(mailSenderProvider, never()).getIfAvailable();
        verify(expenseRepository, never()).findByUserAndExpenseDateBetween(any(), any(), any());
    }
}
