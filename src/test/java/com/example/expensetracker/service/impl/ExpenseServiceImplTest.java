package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpenseServiceImplTest {

    @Mock ExpenseRepository expenseRepository;
    @Mock CategoryRepository categoryRepository;

    private ExpenseServiceImpl service;
    private User owner;
    private User otherUser;

    @BeforeEach
    void setUp() {
        service = new ExpenseServiceImpl(expenseRepository, categoryRepository);
        owner = user(1L);
        otherUser = user(2L);
    }

    @Test
    void createExpenseResolvesGlobalCategorySetsOwnerAndSaves() {
        Category global = category(10L, "Food", null);
        Expense expense = expense(199.99, LocalDate.of(2026, 9, 1));
        Category categoryReference = category(10L, null, null);
        expense.setCategory(categoryReference);
        Expense saved = expense(199.99, expense.getExpenseDate());
        saved.setId(50L);

        when(categoryRepository.findById(10L)).thenReturn(Optional.of(global));
        when(expenseRepository.save(expense)).thenReturn(saved);

        Expense result = service.createExpense(expense, owner);

        assertSame(saved, result);
        assertSame(owner, expense.getUser());
        assertSame(global, expense.getCategory());
        verify(expenseRepository).save(expense);
    }

    @Test
    void createExpenseRejectsMissingCategoryBeforeSave() {
        Expense expense = expense(100, LocalDate.of(2026, 9, 1));
        expense.setCategory(category(99L, null, null));
        when(categoryRepository.findById(99L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.createExpense(expense, owner));

        assertEquals("Category not found", ex.getMessage());
        verify(expenseRepository, never()).save(any());
    }

    @Test
    void createExpenseRejectsAnotherUsersCategoryBeforeSave() {
        Category foreign = category(20L, "Private", otherUser);
        Expense expense = expense(250, LocalDate.of(2026, 9, 2));
        expense.setCategory(category(20L, null, null));
        when(categoryRepository.findById(20L)).thenReturn(Optional.of(foreign));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.createExpense(expense, owner));

        assertEquals("Category does not belong to this user", ex.getMessage());
        verify(expenseRepository, never()).save(any());
    }

    @Test
    void createExpenseAcceptsUsersOwnCategory() {
        Category personal = category(21L, "Rent", owner);
        Expense expense = expense(1500, LocalDate.of(2026, 9, 3));
        expense.setCategory(category(21L, null, null));
        when(categoryRepository.findById(21L)).thenReturn(Optional.of(personal));
        when(expenseRepository.save(expense)).thenReturn(expense);

        service.createExpense(expense, owner);

        assertSame(personal, expense.getCategory());
        assertSame(owner, expense.getUser());
        verify(expenseRepository).save(expense);
    }

    @Test
    void createExpenseWithoutCategoryStillSetsOwnerAndSaves() {
        Expense expense = expense(75.50, LocalDate.of(2026, 9, 4));
        when(expenseRepository.save(expense)).thenReturn(expense);

        Expense result = service.createExpense(expense, owner);

        assertSame(expense, result);
        assertSame(owner, expense.getUser());
        assertNull(expense.getCategory());
        verifyNoInteractions(categoryRepository);
        verify(expenseRepository).save(expense);
    }

    @Test
    void getUserExpensesDelegatesToRepositoryAndReturnsExactList() {
        List<Expense> expected = List.of(expense(10, LocalDate.of(2026, 9, 1)));
        when(expenseRepository.findByUser(owner)).thenReturn(expected);

        List<Expense> result = service.getUserExpenses(owner);

        assertSame(expected, result);
        verify(expenseRepository).findByUser(owner);
        verifyNoMoreInteractions(expenseRepository);
    }

    @Test
    void deleteExpenseDeletesOwnedExpense() {
        Expense existing = expense(300, LocalDate.of(2026, 9, 5));
        existing.setId(70L);
        existing.setUser(owner);
        when(expenseRepository.findById(70L)).thenReturn(Optional.of(existing));

        assertDoesNotThrow(() -> service.deleteExpense(70L, owner));

        verify(expenseRepository).delete(existing);
    }

    @Test
    void deleteExpenseRejectsMissingExpenseWithoutDeleting() {
        when(expenseRepository.findById(71L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.deleteExpense(71L, owner));

        assertEquals("Expense not found", ex.getMessage());
        verify(expenseRepository, never()).delete(any());
    }

    @Test
    void deleteExpenseRejectsForeignExpenseWithoutDeleting() {
        Expense existing = expense(300, LocalDate.of(2026, 9, 5));
        existing.setId(72L);
        existing.setUser(otherUser);
        when(expenseRepository.findById(72L)).thenReturn(Optional.of(existing));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.deleteExpense(72L, owner));

        assertEquals("Expense does not belong to this user", ex.getMessage());
        verify(expenseRepository, never()).delete(any());
    }

    @Test
    void updateExpenseChangesOnlyNonNullFieldsForOwnedExpense() {
        Expense existing = expense(500, LocalDate.of(2026, 9, 6));
        existing.setId(80L);
        existing.setDescription("Original");
        existing.setUser(owner);

        Expense updates = new Expense();
        updates.setAmount(new BigDecimal("650.75"));
        updates.setDescription("Updated");
        updates.setExpenseDate(null);
        updates.setCategory(null);

        when(expenseRepository.findById(80L)).thenReturn(Optional.of(existing));
        when(expenseRepository.save(existing)).thenReturn(existing);

        Expense result = service.updateExpense(80L, updates, owner);

        assertSame(existing, result);
        assertEquals(new BigDecimal("650.75"), existing.getAmount());
        assertEquals("Updated", existing.getDescription());
        assertEquals(LocalDate.of(2026, 9, 6), existing.getExpenseDate());
        assertNull(existing.getCategory());
        verify(expenseRepository).save(existing);
    }

    @Test
    void updateExpenseRejectsMissingExpense() {
        // FIXED: previously threw RuntimeException (-> 500 INTERNAL_SERVER_ERROR via GlobalExceptionHandler).
        // Now throws IllegalArgumentException (-> 400 BAD_REQUEST) for proper REST semantics.
        when(expenseRepository.findById(81L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.updateExpense(81L, new Expense(), owner));

        assertEquals("Expense not found", ex.getMessage());
        verify(expenseRepository, never()).save(any());
    }

    @Test
    void updateExpenseRejectsForeignExpense() {
        Expense existing = expense(500, LocalDate.of(2026, 9, 7));
        existing.setId(82L);
        existing.setUser(otherUser);
        when(expenseRepository.findById(82L)).thenReturn(Optional.of(existing));

        // FIXED: previously threw RuntimeException (-> 500). Now throws AccessDeniedException
        // (-> 403 FORBIDDEN) for proper REST semantics on ownership violations.
        org.springframework.security.access.AccessDeniedException ex = assertThrows(
                org.springframework.security.access.AccessDeniedException.class,
                () -> service.updateExpense(82L, new Expense(), owner));

        assertEquals("Expense does not belong to this user", ex.getMessage());
        verify(expenseRepository, never()).save(any());
    }

    @Test
    void updateExpensePersistsChangedCategoryReference() {
        Expense existing = expense(400, LocalDate.of(2026, 9, 8));
        existing.setId(83L);
        existing.setUser(owner);
        Category replacement = category(30L, "Transport", owner);
        Expense updates = new Expense();
        updates.setCategory(replacement);
        when(expenseRepository.findById(83L)).thenReturn(Optional.of(existing));
        when(expenseRepository.save(existing)).thenReturn(existing);

        service.updateExpense(83L, updates, owner);

        assertSame(replacement, existing.getCategory());
        ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepository).save(captor.capture());
        assertSame(replacement, captor.getValue().getCategory());
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setName("User " + id);
        return user;
    }

    private static Category category(Long id, String name, User user) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        category.setUser(user);
        return category;
    }

    private static Expense expense(double amount, LocalDate date) {
        return expense(BigDecimal.valueOf(amount), date);
    }

    private static Expense expense(BigDecimal amount, LocalDate date) {
        Expense expense = new Expense();
        expense.setAmount(amount);
        expense.setExpenseDate(date);
        return expense;
    }
}
