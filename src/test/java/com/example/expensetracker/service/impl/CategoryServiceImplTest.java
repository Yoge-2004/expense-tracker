package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryServiceImplTest {

    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private ExpenseRepository expenseRepository;
    @Mock
    private RecurringExpenseRepository recurringExpenseRepository;

    private CategoryServiceImpl service;
    private User owner;
    private User otherUser;

    @BeforeEach
    void setUp() {
        service = new CategoryServiceImpl(categoryRepository, expenseRepository, recurringExpenseRepository);
        owner = new User();
        owner.setId(1L);
        owner.setEmail("owner@example.com");

        otherUser = new User();
        otherUser.setId(2L);
        otherUser.setEmail("other@example.com");
    }

    @Test
    @DisplayName("createCategory saves category when valid and non-duplicate")
    void createCategory_success() {
        when(categoryRepository.existsByNameAndUser("Groceries", owner)).thenReturn(false);
        Category saved = new Category();
        saved.setId(10L);
        saved.setName("Groceries");
        saved.setUser(owner);
        when(categoryRepository.save(any(Category.class))).thenReturn(saved);

        Category result = service.createCategory("Groceries", owner);

        assertNotNull(result);
        assertEquals(10L, result.getId());
        assertEquals("Groceries", result.getName());
        assertEquals(owner, result.getUser());
        verify(categoryRepository).save(any(Category.class));
    }

    @Test
    @DisplayName("createCategory throws IllegalArgumentException when user is null")
    void createCategory_nullUser_throwsIllegalArgumentException() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.createCategory("Groceries", null)
        );
        assertEquals("User must be specified", ex.getMessage());
        verifyNoInteractions(categoryRepository);
    }

    @Test
    @DisplayName("createCategory throws IllegalArgumentException when name is null or blank")
    void createCategory_nullOrBlankName_throwsIllegalArgumentException() {
        IllegalArgumentException exNull = assertThrows(IllegalArgumentException.class, () ->
                service.createCategory(null, owner)
        );
        assertEquals("Category name cannot be blank", exNull.getMessage());

        IllegalArgumentException exBlank = assertThrows(IllegalArgumentException.class, () ->
                service.createCategory("   ", owner)
        );
        assertEquals("Category name cannot be blank", exBlank.getMessage());

        verifyNoInteractions(categoryRepository);
    }

    @Test
    @DisplayName("createCategory throws IllegalArgumentException when category name already exists for user")
    void createCategory_duplicate_throwsIllegalArgumentException() {
        when(categoryRepository.existsByNameAndUser("Groceries", owner)).thenReturn(true);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.createCategory("Groceries", owner)
        );

        assertTrue(ex.getMessage().contains("already exists"));
        verify(categoryRepository, never()).save(any());
    }

    @Test
    @DisplayName("getUserCategories loads categories for given user")
    void getUserCategories_returnsList() {
        Category cat = new Category();
        cat.setId(10L);
        cat.setName("Utilities");
        cat.setUser(owner);
        when(categoryRepository.findByUser(owner)).thenReturn(List.of(cat));

        List<Category> results = service.getUserCategories(owner);

        assertEquals(1, results.size());
        assertEquals("Utilities", results.get(0).getName());
        verify(categoryRepository).findByUser(owner);
    }

    @Test
    @DisplayName("getUserCategories throws IllegalArgumentException when user is null")
    void getUserCategories_nullUser_throwsIllegalArgumentException() {
        assertThrows(IllegalArgumentException.class, () -> service.getUserCategories(null));
        verifyNoInteractions(categoryRepository);
    }

    @Test
    @DisplayName("getGlobalCategories loads categories with null user")
    void getGlobalCategories_returnsGlobals() {
        Category globalCat = new Category();
        globalCat.setId(1L);
        globalCat.setName("General");
        globalCat.setUser(null);
        when(categoryRepository.findByUserIsNull()).thenReturn(List.of(globalCat));

        List<Category> results = service.getGlobalCategories();

        assertEquals(1, results.size());
        assertEquals("General", results.get(0).getName());
        verify(categoryRepository).findByUserIsNull();
    }

    @Test
    @DisplayName("deleteCategory throws IllegalArgumentException when categoryId is null")
    void deleteCategory_nullCategoryId_throwsIllegalArgumentException() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.deleteCategory(null, owner)
        );
        assertEquals("Category ID cannot be null", ex.getMessage());
    }

    @Test
    @DisplayName("deleteCategory throws IllegalArgumentException when user is null")
    void deleteCategory_nullUser_throwsIllegalArgumentException() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.deleteCategory(1L, null)
        );
        assertEquals("User must be specified", ex.getMessage());
    }

    @Test
    @DisplayName("deleteCategory throws IllegalArgumentException when category does not exist")
    void deleteCategory_notFound_throwsException() {
        when(categoryRepository.findById(99L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.deleteCategory(99L, owner)
        );

        assertEquals("Category not found", ex.getMessage());
        verify(categoryRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteCategory throws IllegalArgumentException when category is a global system category")
    void deleteCategory_globalCategory_throwsException() {
        Category globalCat = new Category();
        globalCat.setId(5L);
        globalCat.setName("Global System Cat");
        globalCat.setUser(null);
        when(categoryRepository.findById(5L)).thenReturn(Optional.of(globalCat));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.deleteCategory(5L, owner)
        );

        assertEquals("Global categories cannot be deleted", ex.getMessage());
        verify(categoryRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteCategory throws IllegalArgumentException when category belongs to another user")
    void deleteCategory_otherUser_throwsException() {
        Category otherCat = new Category();
        otherCat.setId(6L);
        otherCat.setName("Other Secret");
        otherCat.setUser(otherUser);
        when(categoryRepository.findById(6L)).thenReturn(Optional.of(otherCat));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.deleteCategory(6L, owner)
        );

        assertEquals("Category not found", ex.getMessage());
        verify(categoryRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteCategory throws IllegalStateException when referenced by active expenses")
    void deleteCategory_inUseByExpense_throwsException() {
        Category cat = new Category();
        cat.setId(7L);
        cat.setName("Rent");
        cat.setUser(owner);
        when(categoryRepository.findById(7L)).thenReturn(Optional.of(cat));
        when(expenseRepository.existsByCategory_Id(7L)).thenReturn(true);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                service.deleteCategory(7L, owner)
        );

        assertTrue(ex.getMessage().contains("is still used"));
        verify(categoryRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteCategory throws IllegalStateException when referenced by recurring expenses")
    void deleteCategory_inUseByRecurring_throwsException() {
        Category cat = new Category();
        cat.setId(8L);
        cat.setName("Subscriptions");
        cat.setUser(owner);
        when(categoryRepository.findById(8L)).thenReturn(Optional.of(cat));
        when(expenseRepository.existsByCategory_Id(8L)).thenReturn(false);
        when(recurringExpenseRepository.existsByCategory_Id(8L)).thenReturn(true);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                service.deleteCategory(8L, owner)
        );

        assertTrue(ex.getMessage().contains("is still used"));
        verify(categoryRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteCategory deletes category when not in use and owned by user")
    void deleteCategory_success() {
        Category cat = new Category();
        cat.setId(9L);
        cat.setName("Travel");
        cat.setUser(owner);
        when(categoryRepository.findById(9L)).thenReturn(Optional.of(cat));
        when(expenseRepository.existsByCategory_Id(9L)).thenReturn(false);
        when(recurringExpenseRepository.existsByCategory_Id(9L)).thenReturn(false);

        service.deleteCategory(9L, owner);

        verify(categoryRepository).delete(cat);
    }
}
