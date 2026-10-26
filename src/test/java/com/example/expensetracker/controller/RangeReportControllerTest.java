package com.example.expensetracker.controller;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
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
    // FIXED: RangeReportController has 7 constructor dependencies. The original test only
    // mocked 4 (expenses, incomes, users, security), leaving savingsGoals, recurringExpenses,
    // and budgets as null. When the controller called savingsGoals.findByUser(user), it NPE'd.
    // Now all repository dependencies are mocked so the controller's export paths work.
    @Mock SavingsGoalRepository savingsGoals;
    @Mock RecurringExpenseRepository recurringExpenses;
    @Mock BudgetRepository budgets;
    @Mock UserService users;
    @Mock UserSecurity security;
    @InjectMocks RangeReportController controller;

    @Test
    void invalidFromDateFormat_screamsIllegalArgumentException() {
        when(users.findById(11L)).thenReturn(Optional.of(user(11L, "Range User")));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> controller.excel(11L, "invalid-date", "2026-09-30", "INR"));
        assertTrue(ex.getMessage().contains("Invalid 'from' date format"));
        verifyNoInteractions(expenses, incomes);
    }

    @Test
    void invalidToDateFormat_screamsIllegalArgumentException() {
        when(users.findById(12L)).thenReturn(Optional.of(user(12L, "Range User")));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> controller.pdf(12L, "2026-09-01", "not-a-date", "INR"));
        assertTrue(ex.getMessage().contains("Invalid 'to' date format"));
        verifyNoInteractions(expenses, incomes);
    }

    @Test
    void excelIncludesOnlyTransactionsInsideRequestedRangeAndUsesDownloadHeaders() {
        User user = user(7L, "Test User");
        Category food = category("Food");
        when(users.findById(7L)).thenReturn(Optional.of(user));
        when(expenses.findByUserAndExpenseDateBetween(user, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30)))
                .thenReturn(List.of(expense(100, LocalDate.of(2026, 9, 1), "Lunch", food)));
        when(incomes.findByUserAndIncomeDateBetween(user, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30)))
                .thenReturn(List.of(income(3000, LocalDate.of(2026, 9, 5), "Salary")));
        // Stub the additional repository mocks so the controller's export path doesn't NPE.
        when(savingsGoals.findByUser(user)).thenReturn(List.of());
        when(recurringExpenses.findByUser(user)).thenReturn(List.of());
        when(budgets.findByUser(user)).thenReturn(List.of());

        var response = controller.excel(7L, "2026-09-01", "2026-09-30", "INR");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                response.getHeaders().getContentType().toString());
        assertEquals("attachment; filename=\"ExpenseTracker_Executive_Dashboard.xlsx\"",
                response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
        assertNotNull(response.getBody());
        assertTrue(response.getBody().length > 1000);
        verify(security).validateUserAccess(7L);
        verify(expenses).findByUserAndExpenseDateBetween(user, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30));
        verify(incomes).findByUserAndIncomeDateBetween(user, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30));
    }

    @Test
    void pdfProducesNonEmptyReportForAllTime() {
        User user = user(8L, "PDF User");
        when(users.findById(8L)).thenReturn(Optional.of(user));
        when(expenses.findByUser(user)).thenReturn(List.of(expense(250, LocalDate.of(2026, 1, 2), "Groceries", null)));
        when(incomes.findByUser(user)).thenReturn(List.of(income(1000, LocalDate.of(2026, 1, 1), "Salary")));
        // Stub the additional repository mocks so the controller's export path doesn't NPE.
        when(savingsGoals.findByUser(user)).thenReturn(List.of());
        when(recurringExpenses.findByUser(user)).thenReturn(List.of());
        when(budgets.findByUser(user)).thenReturn(List.of());

        var response = controller.pdf(8L, null, null, "USD");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("application/pdf", response.getHeaders().getContentType().toString());
        assertEquals("attachment; filename=\"ExpenseTracker_Executive_Report.pdf\"",
                response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
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


    @Test
    void excelWithPopulatedBudgetsSubscriptionsAndGoalsSucceeds() {
        User user = user(15L, "Full User");
        Category food = category("Food");
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(expenses.findByUser(user)).thenReturn(List.of(expense(100, LocalDate.of(2026, 9, 1), "Lunch", food)));
        when(incomes.findByUser(user)).thenReturn(List.of(income(3000, LocalDate.of(2026, 9, 5), "Salary")));

        SavingsGoal goal = new SavingsGoal();
        goal.setName("Car Down Payment");
        goal.setTargetAmount(BigDecimal.valueOf(50000));
        goal.setCurrentAmount(BigDecimal.valueOf(12000));
        goal.setStatus("IN_PROGRESS");
        goal.setUser(user);
        when(savingsGoals.findByUser(user)).thenReturn(List.of(goal));

        RecurringExpense rec = new RecurringExpense();
        rec.setDescription("Netflix");
        rec.setAmount(BigDecimal.valueOf(649));
        rec.setFrequency("MONTHLY");
        rec.setNextDueDate(LocalDate.of(2026, 10, 15));
        rec.setCategory(food);
        rec.setUser(user);
        when(recurringExpenses.findByUser(user)).thenReturn(List.of(rec));

        Budget b = new Budget();
        b.setLimitAmount(BigDecimal.valueOf(15000));
        b.setCategory(food);
        b.setPeriod("MONTHLY");
        b.setStartDate(LocalDate.of(2026, 9, 1));
        b.setEndDate(LocalDate.of(2026, 9, 30));
        b.setUser(user);
        when(budgets.findByUser(user)).thenReturn(List.of(b));

        var response = controller.excel(15L, null, null, "INR");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().length > 2000);
    }

    @Test
    void excelGracefullyHandlesLazyInitializationExceptionOnProxyCategory() {
        User user = user(16L, "Lazy User");
        Category mockLazyCategory = mock(Category.class);
        when(mockLazyCategory.getName()).thenThrow(new org.hibernate.LazyInitializationException("Could not initialize proxy - no session"));

        when(users.findById(16L)).thenReturn(Optional.of(user));
        when(expenses.findByUser(user)).thenReturn(List.of(expense(200, LocalDate.of(2026, 9, 2), "Coffee", mockLazyCategory)));
        when(incomes.findByUser(user)).thenReturn(List.of());
        when(savingsGoals.findByUser(user)).thenReturn(List.of());

        Budget b = new Budget();
        b.setLimitAmount(BigDecimal.valueOf(5000));
        b.setCategory(mockLazyCategory);
        b.setUser(user);
        when(budgets.findByUser(user)).thenReturn(List.of(b));

        RecurringExpense r = new RecurringExpense();
        r.setDescription("Sub");
        r.setAmount(BigDecimal.valueOf(99));
        r.setCategory(mockLazyCategory);
        r.setUser(user);
        when(recurringExpenses.findByUser(user)).thenReturn(List.of(r));

        var response = controller.excel(16L, null, null, "INR");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().length > 2000);
    }

    @Test
    void pdfGracefullyHandlesLazyInitializationExceptionOnProxyCategory() {
        User user = user(17L, "Lazy User PDF");
        Category mockLazyCategory = mock(Category.class);
        when(mockLazyCategory.getName()).thenThrow(new org.hibernate.LazyInitializationException("Could not initialize proxy - no session"));

        when(users.findById(17L)).thenReturn(Optional.of(user));
        when(expenses.findByUser(user)).thenReturn(List.of(expense(200, LocalDate.of(2026, 9, 2), "Coffee", mockLazyCategory)));
        when(incomes.findByUser(user)).thenReturn(List.of());
        when(savingsGoals.findByUser(user)).thenReturn(List.of());

        Budget b = new Budget();
        b.setLimitAmount(BigDecimal.valueOf(5000));
        b.setCategory(mockLazyCategory);
        b.setUser(user);
        when(budgets.findByUser(user)).thenReturn(List.of(b));

        RecurringExpense r = new RecurringExpense();
        r.setDescription("Sub");
        r.setAmount(BigDecimal.valueOf(99));
        r.setCategory(mockLazyCategory);
        r.setUser(user);
        when(recurringExpenses.findByUser(user)).thenReturn(List.of(r));

        var response = controller.pdf(17L, null, null, "INR");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().length > 1000);
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
