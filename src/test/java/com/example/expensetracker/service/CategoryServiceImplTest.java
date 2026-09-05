package com.example.expensetracker.service;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.service.impl.CategoryServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryServiceImplTest {

    @Mock private CategoryRepository categoryRepository;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private RecurringExpenseRepository recurringExpenseRepository;

    private CategoryServiceImpl service;
    private User owner;
    private User otherUser;
    private Category category;

    @BeforeEach
    void setUp() {
        service = new CategoryServiceImpl(categoryRepository, expenseRepository, recurringExpenseRepository);
        owner = user(1L);
        otherUser = user(2L);
        category = category(10L, "Food", owner);
    }

    @Test
    void createCategory_trimsNameBeforeCheckingAndSaving() {
        when(categoryRepository.existsByNameAndUser("Food", owner)).thenReturn(false);
        when(categoryRepository.save(any(Category.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Category saved = service.createCategory("  Food  ", owner);

        assertThat(saved.getName()).isEqualTo("Food");
        assertThat(saved.getUser()).isSameAs(owner);
        verify(categoryRepository).existsByNameAndUser("Food", owner);
        verify(categoryRepository).save(saved);
    }

    @Test
    void createCategory_rejectsBlankNameBeforeRepositoryAccess() {
        assertThatThrownBy(() -> service.createCategory("   ", owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Category name is required");

        verifyNoInteractions(categoryRepository);
    }

    @Test
    void createCategory_rejectsNullOwnerBeforeRepositoryAccess() {
        assertThatThrownBy(() -> service.createCategory("Food", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User is required");

        verifyNoInteractions(categoryRepository);
    }

    @Test
    void createCategory_rejectsDuplicateAfterNormalization() {
        when(categoryRepository.existsByNameAndUser("Food", owner)).thenReturn(true);

        assertThatThrownBy(() -> service.createCategory(" Food ", owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Category 'Food' already exists for this user");

        verify(categoryRepository).existsByNameAndUser("Food", owner);
        verify(categoryRepository, never()).save(any(Category.class));
    }

    @Test
    void getUserCategories_requiresOwnerAndDelegates() {
        when(categoryRepository.findByUser(owner)).thenReturn(List.of(category));

        assertThat(service.getUserCategories(owner)).containsExactly(category);
        verify(categoryRepository).findByUser(owner);
    }

    @Test
    void getGlobalCategories_delegatesToGlobalQuery() {
        Category global = category(11L, "Transport", null);
        when(categoryRepository.findByUserIsNull()).thenReturn(List.of(global));

        assertThat(service.getGlobalCategories()).containsExactly(global);
        verify(categoryRepository).findByUserIsNull();
    }

    @Test
    void deleteCategory_rejectsGlobalCategory() {
        Category global = category(20L, "Food", null);
        when(categoryRepository.findById(20L)).thenReturn(Optional.of(global));

        assertThatThrownBy(() -> service.deleteCategory(20L, owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Global categories cannot be deleted");

        verifyNoInteractions(expenseRepository, recurringExpenseRepository);
        verify(categoryRepository, never()).delete(any(Category.class));
    }

    @Test
    void deleteCategory_rejectsOtherOwnersWithoutUsageProbe() {
        Category foreign = category(21L, "Private", otherUser);
        when(categoryRepository.findById(21L)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.deleteCategory(21L, owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Category not found");

        verifyNoInteractions(expenseRepository, recurringExpenseRepository);
        verify(categoryRepository, never()).delete(any(Category.class));
    }

    @Test
    void deleteCategory_rejectsWhenReferencedByExpense() {
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(category));
        when(expenseRepository.existsByCategory_Id(10L)).thenReturn(true);
        when(recurringExpenseRepository.existsByCategory_Id(10L)).thenReturn(false);

        assertThatThrownBy(() -> service.deleteCategory(10L, owner))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("still used by one or more expenses");

        verify(categoryRepository, never()).delete(any(Category.class));
    }

    @Test
    void deleteCategory_rejectsWhenReferencedByRecurringExpense() {
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(category));
        when(expenseRepository.existsByCategory_Id(10L)).thenReturn(false);
        when(recurringExpenseRepository.existsByCategory_Id(10L)).thenReturn(true);

        assertThatThrownBy(() -> service.deleteCategory(10L, owner))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("still used by one or more expenses");

        verify(categoryRepository, never()).delete(any(Category.class));
    }

    @Test
    void deleteCategory_deletesUnusedOwnedCategory() {
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(category));
        when(expenseRepository.existsByCategory_Id(10L)).thenReturn(false);
        when(recurringExpenseRepository.existsByCategory_Id(10L)).thenReturn(false);

        service.deleteCategory(10L, owner);

        verify(categoryRepository).delete(category);
    }

    @Test
    void deleteCategory_rejectsNullIdBeforeRepositoryAccess() {
        assertThatThrownBy(() -> service.deleteCategory(null, owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Category ID is required");

        verifyNoInteractions(categoryRepository, expenseRepository, recurringExpenseRepository);
    }

    private User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setName("User " + id);
        user.setEmail("user" + id + "@example.com");
        return user;
    }

    private Category category(Long id, String name, User user) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        category.setUser(user);
        return category;
    }
}
