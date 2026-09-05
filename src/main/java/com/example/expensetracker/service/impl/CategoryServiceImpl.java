package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.service.CategoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Concrete implementation of {@link CategoryService} that provides
 * business logic for managing expense categories.
 *
 * <p>This service interacts with {@link CategoryRepository} to perform
 * database operations for creating user-specific categories and retrieving
 * both user-owned and global (system-level) categories.</p>
 *
 * <p>Key rules enforced in this implementation:</p>
 * <ul>
 *   <li>Category names must be unique per user — if a user already has a category
 *       with the same name, an {@link IllegalArgumentException} is thrown.</li>
 *   <li>Global categories are identified by a {@code null} user reference and
 *       are retrieved separately from user-owned categories.</li>
 * </ul>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see CategoryService
 * @see CategoryRepository
 */
@Service
public class CategoryServiceImpl implements CategoryService {

    private static final Logger log = LoggerFactory.getLogger(CategoryServiceImpl.class);

    /** Repository used for category persistence and querying. */
    private final CategoryRepository categoryRepository;
    private final com.example.expensetracker.repository.ExpenseRepository expenseRepository;
    private final com.example.expensetracker.repository.RecurringExpenseRepository recurringExpenseRepository;

    /**
     * Constructs a {@code CategoryServiceImpl} with the required repositories.
     *
     * @param categoryRepository the JPA repository for {@link Category} entities
     * @param expenseRepository  used to check whether a category is referenced
     *                           by any one-off expense before deletion
     * @param recurringExpenseRepository used to check whether a category is
     *                           referenced by any recurring expense/subscription
     *                           before deletion
     */
    public CategoryServiceImpl(CategoryRepository categoryRepository,
                                com.example.expensetracker.repository.ExpenseRepository expenseRepository,
                                com.example.expensetracker.repository.RecurringExpenseRepository recurringExpenseRepository) {
        this.categoryRepository = categoryRepository;
        this.expenseRepository = expenseRepository;
        this.recurringExpenseRepository = recurringExpenseRepository;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Before creating the category, checks whether a category with the same name
     * already exists for the specified user using
     * {@link CategoryRepository#existsByNameAndUser(String, User)}.\n     * If a duplicate is found, an {@link IllegalArgumentException} is thrown
     * to enforce per-user uniqueness of category names.</p>
     *
     * <p>After a successful save, both the per-user cache and the global categories
     * cache are evicted to ensure freshness on the next fetch.</p>
     *
     * @param name the name of the new category; must not be blank
     * @param user the owner of the new category; must not be {@code null}
     * @return the saved {@link Category} entity with a generated ID
     * @throws IllegalArgumentException if a category with this name already exists for the user
     */
    @Override
    @Caching(evict = {
        @CacheEvict(value = "userCategories", key = "#user.id"),
        @CacheEvict(value = "globalCategories", allEntries = true)
    })
    public Category createCategory(String name, User user) {
        log.info("Creating category '{}' for userId={}", name, user.getId());
        if (categoryRepository.existsByNameAndUser(name, user)) {
            log.warn("Duplicate category creation attempt: '{}' already exists for userId={}", name, user.getId());
            throw new IllegalArgumentException(
                    "Category '" + name + "' already exists for this user"
            );
        }

        Category category = new Category();
        category.setName(name);
        category.setUser(user);

        Category saved = categoryRepository.save(category);
        log.info("Saved category '{}' with id={} for userId={}", name, saved.getId(), user.getId());
        return saved;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Result is cached in {@code userCategories} by {@code user.id}.
     * Cache is evicted whenever a category is created for this user.</p>
     *
     * @param user the {@link User} whose categories are to be retrieved
     * @return a list of user-owned {@link Category} entities; empty list if none exist
     */
    @Override
    @Cacheable(value = "userCategories", key = "#user.id")
    public List<Category> getUserCategories(User user) {
        log.debug("Loading categories for userId={}", user.getId());
        List<Category> categories = categoryRepository.findByUser(user);
        log.debug("Loaded {} categories for userId={}", categories.size(), user.getId());
        return categories;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Global categories change infrequently; this result is cached in
     * {@code globalCategories}. The cache is evicted when any new category
     * is created (since global categories can only be seeded at startup).</p>
     *
     * @return a list of global {@link Category} entities; empty list if none are defined
     */
    @Override
    @Cacheable(value = "globalCategories")
    public List<Category> getGlobalCategories() {
        log.debug("Loading global categories");
        List<Category> globals = categoryRepository.findByUserIsNull();
        log.debug("Loaded {} global categories", globals.size());
        return globals;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Ownership and the global-category guard are checked before the usage
     * check, so a user attempting to delete someone else's category (or a
     * global one) gets a clear "not found/not yours" error rather than a
     * confusing "in use" message. Both {@link ExpenseRepository} and
     * {@link RecurringExpenseRepository} are checked, since a category can be
     * referenced by either a one-off expense or a recurring subscription.</p>
     */
    @Override
    @Caching(evict = {
        @CacheEvict(value = "userCategories", key = "#user.id"),
        @CacheEvict(value = "globalCategories", allEntries = true)
    })
    public void deleteCategory(Long categoryId, User user) {
        log.info("Deleting category id={} for userId={}", categoryId, user.getId());
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        if (category.getUser() == null) {
            log.warn("Attempt to delete global category id={}", categoryId);
            throw new IllegalArgumentException("Global categories cannot be deleted");
        }
        if (!category.getUser().getId().equals(user.getId())) {
            log.warn("Ownership mismatch: category id={} does not belong to userId={}", categoryId, user.getId());
            throw new IllegalArgumentException("Category not found");
        }
        if (expenseRepository.existsByCategory_Id(categoryId)
                || recurringExpenseRepository.existsByCategory_Id(categoryId)) {
            log.warn("Category id={} cannot be deleted because it is still referenced by expenses or recurring expenses", categoryId);
            throw new IllegalStateException(
                    "Category '" + category.getName() + "' is still used by one or more expenses and can't be deleted");
        }

        categoryRepository.delete(category);
        log.info("Category id={} deleted successfully for userId={}", categoryId, user.getId());
    }
}
