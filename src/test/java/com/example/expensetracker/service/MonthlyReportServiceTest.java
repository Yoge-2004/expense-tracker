package com.example.expensetracker.service;

import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
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
    @Mock private BudgetRepository budgetRepository;
    @Mock private ObjectProvider<JavaMailSender> mailSenderProvider;
    @Mock private JavaMailSender mailSender;
    @Mock private MimeMessage mimeMessage;

    private MonthlyReportServiceImpl service;
    private User testUser;

    @BeforeEach
    void setUp() {
        service = new MonthlyReportServiceImpl(userRepository, expenseRepository, budgetRepository, mailSenderProvider);

        testUser = new User();
        testUser.setId(1L);
        testUser.setName("Yogeshwaran");
        testUser.setEmail("yoge@example.com");
        testUser.setCurrency("INR");
    }

    @Test
    @DisplayName("generateMonthlyReport → Aggregates total outflow and category breakdown correctly")
    void generateMonthlyReport_aggregatesCorrectly() {
        Category food = new Category(); food.setId(1L); food.setName("Food");
        Category travel = new Category(); travel.setId(2L); travel.setName("Travel");

        Expense e1 = new Expense(); e1.setAmount(new BigDecimal("150.00")); e1.setCategory(food); e1.setExpenseDate(LocalDate.of(2026, 8, 10));
        Expense e2 = new Expense(); e2.setAmount(new BigDecimal("350.00")); e2.setCategory(travel); e2.setExpenseDate(LocalDate.of(2026, 8, 12));

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(e1, e2));
        when(budgetRepository.findByUser(testUser)).thenReturn(Collections.emptyList());

        MonthlyReportDto report = service.generateMonthlyReport(1L, 2026, 8);

        assertNotNull(report);
        assertEquals("August 2026", report.getPeriod());
        assertEquals(new BigDecimal("500.00"), report.getTotalOutflow());
        assertEquals("INR", report.getCurrency());
        assertEquals(2, report.getTransactionCount());
        assertEquals(2, report.getCategoryBreakdown().size());
        assertEquals("Travel", report.getCategoryBreakdown().get(0).getCategoryName());
    }

    @Test
    @DisplayName("sendMonthlyReportEmail → Triggers HTML email delivery when mail host configured")
    void sendMonthlyReportEmail_sendsMimeMessage() {
        ReflectionTestUtils.setField(service, "configuredMailHost", "smtp.gmail.com");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(testUser), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());
        when(budgetRepository.findByUser(testUser)).thenReturn(Collections.emptyList());
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        service.sendMonthlyReportEmail(1L, 2026, 8);

        verify(mailSender).createMimeMessage();
        verify(mailSender).send(mimeMessage);
    }
}
