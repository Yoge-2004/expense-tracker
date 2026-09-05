package com.example.expensetracker.service;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.service.impl.ExpenseServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpenseServiceImplTest {

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private CategoryRepository categoryRepository;

    private ExpenseServiceImpl service;
    private User owner;
    private User otherUser;
    private Category globalCategory;
    private Category ownerCategory;
    private Category otherUserCategory;

    @BeforeEach
    void setUp() {
        service = new ExpenseServiceImpl(expenseRepository, categoryRepository);

        owner = user(1L);
        otherUser = user(2L);

        globalCategory = category(10L, "Food", null);
        ownerCategory = category(11L, "Coffee", owner);
        otherUserCategory = category(12L, "Private", otherUser);
    }

    @Test
    void createExpense_resolvesGlobalCategoryAndSetsOwner() {
        Expense expense = expense(100L, owner, categoryRef(10L));
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(globalCategory));
        when(expenseRepository.save(any(Expense.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Expense saved = service.createExpense(expense, owner);

        assertThat(saved.getUser()).isSameAs(owner);
        assertThat(saved.getCategory()).isSameAs(globalCategory);
        verify(expenseRepository).save(saved);
    }

    @Test
    void createExpense_allowsUserOwnedCategory() {
        Expense expense = expense(101L, owner, categoryRef(11L));
        when(categoryRepository.findById(11L)).thenReturn(Optional.of(ownerCategory));
        when(expenseRepository.save(any(Expense.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Expense saved = service.createExpense(expense, owner);

        assertThat(saved.getCategory()).isSameAs(ownerCategory);
        verify(expenseRepository).save(saved);
    }

    @Test
    void createExpense_rejectsCategoryOwnedByAnotherUser() {
        Expense expense = expense(102L, owner, categoryRef(12L));
        when(categoryRepository.findById(12L)).thenReturn(Optional.of(otherUserCategory));

        assertThatThrownBy(() -> service.createExpense(expense, owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Category does not belong to this user");

        verify(expenseRepository, never()).save(any(Expense.class));
    }

    @Test
    void createExpense_rejectsUnknownCategory() {
        Expense expense = expense(103L, owner, categoryRef(999L));
        when(categoryRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createExpense(expense, owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Category not found");

        verify(expenseRepository, never()).save(any(Expense.class));
    }

    @Test
    void updateExpense_resolvesAndAcceptsGlobalCategory() {
        Expense existing = expense(200L, owner, ownerCategory);
        Expense updates = expenseUpdate(categoryRef(10L));

        when(expenseRepository.findById(200L)).thenReturn(Optional.of(existing));
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(globalCategory));
        when(expenseRepository.save(existing)).thenReturn(existing);

        Expense updated = service.updateExpense(200L, updates, owner);

        assertThat(updated.getCategory()).isSameAs(globalCategory);
        verify(expenseRepository).save(existing);
    }

    @Test
    void updateExpense_resolvesAndAcceptsOwnerCategory() {
        Expense existing = expense(201L, owner, globalCategory);
        Expense updates = expenseUpdate(categoryRef(11L));

        when(expenseRepository.findById(201L)).thenReturn(Optional.of(existing));
        when(categoryRepository.findById(11L)).thenReturn(Optional.of(ownerCategory));
        when(expenseRepository.save(existing)).thenReturn(existing);

        service.updateExpense(201L, updates, owner);

        assertThat(existing.getCategory()).isSameAs(ownerCategory);
        verify(expenseRepository).save(existing);
    }

    @Test
    void updateExpense_rejectsCategoryOwnedByAnotherUser() {
        Expense existing = expense(202L, owner, globalCategory);
        Expense updates = expenseUpdate(categoryRef(12L));

        when(expenseRepository.findById(202L)).thenReturn(Optional.of(existing));
        when(categoryRepository.findById(12L)).thenReturn(Optional.of(otherUserCategory));

        assertThatThrownBy(() -> service.updateExpense(202L, updates, owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Category does not belong to this user");

        assertThat(existing.getCategory()).isSameAs(globalCategory);
        verify(expenseRepository, never()).save(any(Expense.class));
    }

    @Test
    void updateExpense_rejectsUnknownCategory() {
        Expense existing = expense(203L, owner, globalCategory);
        Expense updates = expenseUpdate(categoryRef(999L));

        when(expenseRepository.findById(203L)).thenReturn(Optional.of(existing));
        when(categoryRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateExpense(203L, updates, owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Category not found");

        verify(expenseRepository, never()).save(any(Expense.class));
    }

    @Test
    void updateExpense_rejectsExpenseOwnedByAnotherUser() {
        Expense existing = expense(204L, otherUser, globalCategory);
        Expense updates = expenseUpdate(null);

        when(expenseRepository.findById(204L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.updateExpense(204L, updates, owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Expense does not belong to this user");

        verify(expenseRepository, never()).save(any(Expense.class));
    }

    @Test
    void deleteExpense_rejectsExpenseWithNoOwnerInsteadOfThrowingNullPointerException() {
        Expense existing = expense(205L, null, globalCategory);
        when(expenseRepository.findById(205L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.deleteExpense(205L, owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Expense does not belong to this user");

        verify(expenseRepository, never()).delete(any(Expense.class));
    }

    @Test
    void getUserExpenses_delegatesToRepository() {
        Expense first = expense(300L, owner, globalCategory);
        when(expenseRepository.findByUser(owner)).thenReturn(java.util.List.of(first));

        assertThat(service.getUserExpenses(owner)).containsExactly(first);
        verify(expenseRepository).findByUser(owner);
    }

    private Expense expense(Long id, User user, Category category) {
        Expense expense = new Expense();
        expense.setId(id);
        expense.setAmount(new BigDecimal("250.00"));
        expense.setDescription("Lunch");
        expense.setExpenseDate(LocalDate.of(2026, 9, 6));
        expense.setUser(user);
        expense.setCategory(category);
        return expense;
    }

    private Expense expenseUpdate(Category category) {
        Expense update = new Expense();
        update.setAmount(new BigDecimal("300.00"));
        update.setDescription("Updated");
        update.setExpenseDate(LocalDate.of(2026, 9, 7));
        update.setCategory(category);
        return update;
    }

    private Category categoryRef(Long id) {
        Category category = new Category();
        category.setId(id);
        return category;
    }

    private Category category(Long id, String name, User user) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        category.setUser(user);
        return category;
    }

    private User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setName("User " + id);
        user.setEmail("user" + id + "@example.com");
        user.setEnabled(true);
        return user;
    }
}
