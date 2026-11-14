package com.example.expensetracker.infrastructure.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;

@ExtendWith(MockitoExtension.class)
class CategoryInitializerTest {

    @Mock
    private CategoryRepository categoryRepository;

    @InjectMocks
    private CategoryInitializer categoryInitializer;

    @Test
    @DisplayName("initGlobalCategories seeds all ML canonical and baseline categories when repository is empty")
    void initGlobalCategories_seedsAllCategories() {
        when(categoryRepository.findByUserIsNullAndNameIgnoreCase(anyString()))
                .thenReturn(Optional.empty());

        categoryInitializer.initGlobalCategories();

        ArgumentCaptor<Category> captor = ArgumentCaptor.forClass(Category.class);
        verify(categoryRepository, times(27)).save(captor.capture());

        var savedCategories = captor.getAllValues();
        assertEquals(27, savedCategories.size());

        // Verify ML Canonical Categories are present
        assertTrue(savedCategories.stream().anyMatch(c -> "Food & Dining".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Transportation".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Shopping & Retail".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Entertainment & Recreation".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Healthcare & Medical".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Utilities & Services".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Financial Services".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Income".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Government & Legal".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Charity & Donations".equalsIgnoreCase(c.getName())));

        // Verify extended financial taxonomy classes are present
        assertTrue(savedCategories.stream().anyMatch(c -> "Housing".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Groceries".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Education".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Personal Care".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Travel".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Insurance".equalsIgnoreCase(c.getName())));
        assertTrue(savedCategories.stream().anyMatch(c -> "Investments".equalsIgnoreCase(c.getName())));

        // All seeded categories must be global (user is null)
        assertTrue(savedCategories.stream().allMatch(c -> c.getUser() == null));
    }

    @Test
    @DisplayName("initGlobalCategories skips already existing global categories")
    void initGlobalCategories_skipsExisting() {
        Category existingFood = new Category();
        existingFood.setId(1L);
        existingFood.setName("Food");
        existingFood.setUser(null);

        when(categoryRepository.findByUserIsNullAndNameIgnoreCase("Food"))
                .thenReturn(Optional.of(existingFood));
        when(categoryRepository.findByUserIsNullAndNameIgnoreCase(argThat(s -> !"Food".equals(s))))
                .thenReturn(Optional.empty());

        categoryInitializer.initGlobalCategories();

        // 26 should be saved, 1 skipped
        verify(categoryRepository, times(26)).save(any(Category.class));
    }
}
