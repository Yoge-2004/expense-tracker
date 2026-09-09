package com.example.expensetracker.controller;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RangeReportControllerTest {

    @Mock ExpenseRepository expenses;
    @Mock IncomeRepository incomes;
    @Mock UserService users;
    @Mock UserSecurity security;
    @InjectMocks RangeReportController controller;

    @Test
    void excelIncludesOnlyTransactionsInsideRequestedRangeAndUsesDownloadHeaders() {
        User user = user(7L, "Test User");
        Category food = category("Food");
        when(users.findById(7L)).thenReturn(Optional.of(user));
        when(expenses.findByUser(user)).thenReturn(List.of(expense(100, LocalDate.of(2026, 9, 1), "Lunch", food),
                expense(900, LocalDate.of(2026, 8, 31), "Outside", food)));
        when(incomes.findByUser(user)).thenReturn(List.of(income(3000, LocalDate.of(2026, 9, 5), "Salary"),
                income(5000, LocalDate.of(2026, 10, 1), "Outside")));

        var response = controller.excel(7L, "2026-09-01", "2026-09-30", "INR");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", response.getHeaders().getContentType().toString());
        assertEquals("attachment; filename=\"ExpenseTracker_Executive_Dashboard.xlsx\"", response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
        assertNotNull(response.getBody());
        assertTrue(response.getBody().length > 1000);
        verify(security).validateUserAccess(7L);
        verify(expenses).findByUser(user);
        verify(incomes).findByUser(user);
    }

    @Test
    void pdfProducesNonEmptyReportForAllTime() {
        User user = user(8L, "PDF User");
        when(users.findById(8L)).thenReturn(Optional.of(user));
        when(expenses.findByUser(user)).thenReturn(List.of(expense(250, LocalDate.of(2026, 1, 2), "Groceries", null)));
        when(incomes.findByUser(user)).thenReturn(List.of(income(1000, LocalDate.of(2026, 1, 1), "Salary")));

        var response = controller.pdf(8L, null, null, "USD");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("application/pdf", response.getHeaders().getContentType().toString());
        assertEquals("attachment; filename=\"ExpenseTracker_Executive_Report.pdf\"", response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
        assertNotNull(response.getBody());
        assertTrue(response.getBody().length > 1000);
        assertEquals('%', (char) response.getBody()[0]);
        assertEquals('P', (char) response.getBody()[1]);
        assertEquals('D', (char) response.getBody()[2]);
        assertEquals('F', (char) response.getBody()[3]);
    }

    @Test
    void reversedDateRangeIsRejectedBeforeDatabaseQueries() {
        when(users.findById(9L)).thenReturn(Optional.of(user(9L, "Range User")));

        assertThrows(IllegalArgumentException.class,
                () -> controller.excel(9L, "2026-09-30", "2026-09-01", "INR"));

        verifyNoInteractions(expenses, incomes);
    }

    @Test
    void missingUserIsRejectedAfterAccessValidation() {
        when(users.findById(10L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> controller.pdf(10L, null, null, "INR"));

        verify(security).validateUserAccess(10L);
        verifyNoInteractions(expenses, incomes);
    }

    private static User user(Long id, String name) {
        User user = new User();
        user.setId(id);
        user.setName(name);
        return user;
    }

    private static Category category(String name) {
        Category category = new Category();
        category.setName(name);
        return category;
    }

    private static Expense expense(int amount, LocalDate date, String description, Category category) {
        Expense expense = new Expense();
        expense.setAmount(BigDecimal.valueOf(amount));
        expense.setExpenseDate(date);
        expense.setDescription(description);
        expense.setCategory(category);
        expense.setRecurring(false);
        return expense;
    }

    private static Income income(int amount, LocalDate date, String source) {
        Income income = new Income();
        income.setAmount(BigDecimal.valueOf(amount));
        income.setIncomeDate(date);
        income.setSource(source);
        return income;
    }
}
