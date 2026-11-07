package com.example.expensetracker.service;

import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Strict precision accounting test. Replaces decorative assertions like notNullValue()
 * with mathematical proofs on edge cases: zero income division, leap years, fraction summing,
 * and deficit handling.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MonthlyReportAccountingIntegrationTest {

    @Autowired
    private MonthlyReportService monthlyReportService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private IncomeRepository incomeRepository;

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.save(User.builder()
                .name("Accounting Tester")
                .username("accounting_" + System.currentTimeMillis())
                .email("accounting_" + System.currentTimeMillis() + "@test.com")
                .password("SecureP@ss123")
                .currency("USD")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());
    }

    @Test
    @DisplayName("Zero income with positive expenses produces exact deficit, 0.0% savings rate, and no DivideByZero error")
    void zeroIncome_positiveExpenses_producesExactDeficit() {
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("350.00"))
                .description("Rent Portion")
                .expenseDate(LocalDate.of(2026, 6, 10))
                .user(user)
                .build());

        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("150.00"))
                .description("Utilities")
                .expenseDate(LocalDate.of(2026, 6, 12))
                .user(user)
                .build());

        MonthlyReportDto report = monthlyReportService.generateMonthlyReport(user.getId(), 2026, 6);

        assertEquals(0, BigDecimal.ZERO.compareTo(report.totalIncome()));
        assertEquals(0, new BigDecimal("500.00").compareTo(report.totalOutflow()));
        assertEquals(0, new BigDecimal("-500.00").compareTo(report.netCashFlow()));
        assertEquals(0.0, report.savingsRate(), "Savings rate when income is 0 must safely be 0.0%, never NaN or infinity");
        assertEquals(2, report.transactionCount());

        boolean hasDeficitInsight = report.insights().stream().anyMatch(i -> i.toLowerCase().contains("deficit"));
        assertTrue(hasDeficitInsight, "Insights must explicitly identify a deficit when outflow exceeds inflow");
    }

    @Test
    @DisplayName("Zero expenses with positive income produces 100.0% savings rate and equal net cash flow")
    void positiveIncome_zeroExpenses_produces100PercentSavingsRate() {
        incomeRepository.save(Income.builder()
                .amount(new BigDecimal("5000.00"))
                .source("Salary")
                .incomeDate(LocalDate.of(2026, 7, 1))
                .user(user)
                .build());

        MonthlyReportDto report = monthlyReportService.generateMonthlyReport(user.getId(), 2026, 7);

        assertEquals(0, new BigDecimal("5000.00").compareTo(report.totalIncome()));
        assertEquals(0, BigDecimal.ZERO.compareTo(report.totalOutflow()));
        assertEquals(0, new BigDecimal("5000.00").compareTo(report.netCashFlow()));
        assertEquals(100.0, report.savingsRate(), "Savings rate with 0 expenses must be exactly 100.0%");
        assertEquals(0, report.transactionCount());
    }

    @Test
    @DisplayName("Exact BigDecimal decimal summation avoids IEEE-754 floating point precision drift")
    void decimalArithmetic_noFloatingPointDrift() {
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("33.33"))
                .description("Fraction 1")
                .expenseDate(LocalDate.of(2026, 8, 5))
                .user(user)
                .build());
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("33.33"))
                .description("Fraction 2")
                .expenseDate(LocalDate.of(2026, 8, 10))
                .user(user)
                .build());
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("33.34"))
                .description("Fraction 3")
                .expenseDate(LocalDate.of(2026, 8, 15))
                .user(user)
                .build());

        MonthlyReportDto report = monthlyReportService.generateMonthlyReport(user.getId(), 2026, 8);

        // In binary float: 33.33 + 33.33 + 33.34 often produces 100.00000000000001 or 99.99999999999999
        assertEquals(0, new BigDecimal("100.00").compareTo(report.totalOutflow()),
                "Total outflow must sum to exactly 100.00 without floating point drift");
    }

    @Test
    @DisplayName("Leap year February daily average divides by 29 days instead of 28")
    void leapYearDailyAverage_dividesBy29() {
        // 2024 is a leap year (29 days in February). 290.00 / 29 = 10.00 daily average
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("290.00"))
                .description("Monthly Pass")
                .expenseDate(LocalDate.of(2024, 2, 14))
                .user(user)
                .build());

        MonthlyReportDto report = monthlyReportService.generateMonthlyReport(user.getId(), 2024, 2);

        assertEquals(0, new BigDecimal("10.00").compareTo(report.dailyAverage()),
                "Daily average for Feb 2024 (29 days) with $290 outflow must be exactly $10.00");
    }

    @Test
    @DisplayName("Non-leap year February daily average divides by 28 days")
    void nonLeapYearDailyAverage_dividesBy28() {
        // 2025 is not a leap year (28 days in February). 280.00 / 28 = 10.00 daily average
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("280.00"))
                .description("Monthly Pass")
                .expenseDate(LocalDate.of(2025, 2, 14))
                .user(user)
                .build());

        MonthlyReportDto report = monthlyReportService.generateMonthlyReport(user.getId(), 2025, 2);

        assertEquals(0, new BigDecimal("10.00").compareTo(report.dailyAverage()),
                "Daily average for Feb 2025 (28 days) with $280 outflow must be exactly $10.00");
    }
}
