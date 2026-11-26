package com.example.expensetracker.domain.notification.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.notification.model.PendingNotification;
import com.example.expensetracker.domain.user.model.User;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("BudgetNotificationRule spending maths")
class BudgetNotificationRuleReimbursementTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 15);

    private BudgetRepository budgets;
    private ExpenseRepository expenses;
    private IncomeRepository incomes;
    private User user;
    private Category food;

    @BeforeEach
    void setUp() {
        budgets = mock(BudgetRepository.class);
        expenses = mock(ExpenseRepository.class);
        incomes = mock(IncomeRepository.class);
        user = new User();
        user.setId(1L);
        user.setCurrency("INR");
        food = new Category();
        food.setId(1L);
        food.setName("Food");
    }

    private Budget budget(long id, Category category) {
        Budget b = new Budget();
        b.setId(id);
        b.setCategory(category);
        b.setLimitAmount(new BigDecimal("1000.00"));
        b.setPeriod("MONTHLY");
        return b;
    }

    private Expense expense(String amount) {
        Expense e = new Expense();
        e.setAmount(new BigDecimal(amount));
        e.setExpenseDate(LocalDate.of(2026, 9, 10));
        e.setCategory(food);
        return e;
    }

    private Income reimbursement(String amount, long categoryId) {
        Income i = new Income();
        i.setAmount(new BigDecimal(amount));
        i.setSource("Friend paid back");
        i.setKind("REIMBURSEMENT");
        i.setReimbursedCategoryId(categoryId);
        i.setIncomeDate(LocalDate.of(2026, 9, 12));
        return i;
    }

    @Test
    @DisplayName("money paid back for a category is netted off before the budget alert is decided")
    void reimbursementReducesSpentAmount() {
        when(budgets.findByUser(user)).thenReturn(List.of(budget(1L, food)));
        when(expenses.findByUserAndExpenseDateBetween(eq(user), any(), any())).thenReturn(List.of(expense("900.00")));
        when(incomes.findByUserAndIncomeDateBetween(eq(user), any(), any()))
                .thenReturn(List.of(reimbursement("500.00", 1L)));

        List<PendingNotification> result = new BudgetNotificationRule(budgets, expenses, incomes).detect(user, TODAY);

        assertTrue(result.isEmpty(), "900 spent minus 500 repaid is 400 of 1000, so no alert");
    }

    @Test
    @DisplayName("a reimbursement for a different category does not reduce this budget")
    void reimbursementForAnotherCategoryIsIgnored() {
        when(budgets.findByUser(user)).thenReturn(List.of(budget(1L, food)));
        when(expenses.findByUserAndExpenseDateBetween(eq(user), any(), any())).thenReturn(List.of(expense("900.00")));
        when(incomes.findByUserAndIncomeDateBetween(eq(user), any(), any()))
                .thenReturn(List.of(reimbursement("500.00", 99L)));

        List<PendingNotification> result = new BudgetNotificationRule(budgets, expenses, incomes).detect(user, TODAY);

        assertEquals(1, result.size(), "900 of 1000 is still a warning");
    }

    @Test
    @DisplayName("without an income repository the previous gross behaviour is kept")
    void grossBehaviourWithoutIncomeRepository() {
        when(budgets.findByUser(user)).thenReturn(List.of(budget(1L, food)));
        when(expenses.findByUserAndExpenseDateBetween(eq(user), any(), any())).thenReturn(List.of(expense("900.00")));

        List<PendingNotification> result = new BudgetNotificationRule(budgets, expenses).detect(user, TODAY);

        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("budgets sharing a window read the expenses once, not once per budget")
    void identicalWindowsAreReadOnce() {
        Category transport = new Category();
        transport.setId(2L);
        transport.setName("Transport");
        when(budgets.findByUser(user)).thenReturn(List.of(budget(1L, food), budget(2L, transport)));
        when(expenses.findByUserAndExpenseDateBetween(eq(user), any(), any())).thenReturn(List.of(expense("100.00")));

        new BudgetNotificationRule(budgets, expenses).detect(user, TODAY);

        verify(expenses, times(1)).findByUserAndExpenseDateBetween(eq(user), any(), any());
    }
}
