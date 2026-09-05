package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.service.CategoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Business logic for user-owned and global expense categories.
 *
 * <p>User category names are normalized before uniqueness checks so accidental
 * leading/trailing whitespace cannot create visually duplicate categories.
 * Deletion protects global categories, ownership boundaries, and referenced
 * categories.</p>
 */
@Service
public class CategoryServiceImpl implements CategoryService {

    private static final Logger log = LoggerFactory.getLogger(CategoryServiceImpl.class);

    private final CategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final RecurringExpenseRepository recurringExpenseRepository;

    public CategoryServiceImpl(CategoryRepository categoryRepository,
                               ExpenseRepository expenseRepository,
                               RecurringExpenseRepository recurringExpenseRepository) {
        this.categoryRepository = categoryRepository;
        this.expenseRepository = expenseRepository;
        this.recurringExpenseRepository = recurringExpenseRepository;
    }

    @Override
    @CacheEvict(value = "userCategories", key = "#user.id")
    public Category createCategory(String name, User user) {
        if (user == null) {
            throw new IllegalArgumentException("User is required");
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Category name is required");
        }

        String normalizedName = name.trim();
        if (categoryRepository.existsByNameAndUser(normalizedName, user)) {
            throw new IllegalArgumentException(
                    "Category '" + normalizedName + "' already exists for this user"
            );
        }

        Category category = new Category();
        category.setName(normalizedName);
        category.setUser(user);

        Category saved = categoryRepository.save(category);
        log.info("Saved category '{}' with id={} for userId={}",
                normalizedName, saved.getId(), user.getId());
        return saved;
    }

    @Override
    @Cacheable(value = "userCategories", key = "#user.id")
    public List<Category> getUserCategories(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User is required");
        }
        return categoryRepository.findByUser(user);
    }

    @Override
    @Cacheable(value = "globalCategories")
    public List<Category> getGlobalCategories() {
        return categoryRepository.findByUserIsNull();
    }

    @Override
    @CacheEvict(value = "userCategories", key = "#user.id")
    public void deleteCategory(Long categoryId, User user) {
        if (user == null) {
            throw new IllegalArgumentException("User is required");
        }
        if (categoryId == null) {
            throw new IllegalArgumentException("Category ID is required");
        }

        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        if (category.getUser() == null) {
            throw new IllegalArgumentException("Global categories cannot be deleted");
        }
        if (category.getUser().getId() == null
                || !category.getUser().getId().equals(user.getId())) {
            // Deliberately keep ownership failures indistinguishable from a
            // missing category so the endpoint cannot become an ownership probe.
            throw new IllegalArgumentException("Category not found");
        }

        boolean referencedByExpense = expenseRepository.existsByCategory_Id(categoryId);
        boolean referencedByRecurring = recurringExpenseRepository.existsByCategory_Id(categoryId);
        if (referencedByExpense || referencedByRecurring) {
            throw new IllegalStateException(
                    "Category '" + category.getName() + "' is still used by one or more expenses and can't be deleted");
        }

        categoryRepository.delete(category);
    }
}
