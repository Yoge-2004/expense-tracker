package com.example.expensetracker.domain.expense.service;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.user.model.User;

/**
 * Shared helper for resolving user-scoped or global {@link Category} entities during imports
 * and bank statement reconciliation, with per-batch case-insensitive caching.
 */
public final class CategoryResolutionSupport {

    private CategoryResolutionSupport() {}

    /**
     * Finds an existing user-owned or global category matching {@code name}, or creates a new
     * user-scoped category if none exists.
     *
     * @param name               category name
     * @param user               owning user context
     * @param categoryRepository category repository
     * @param categoryCache      optional per-import cache keyed by lower-cased name
     * @return resolved or newly created {@link Category}
     */
    public static Category resolveOrCreateCategoryForUser(String name,
                                                          User user,
                                                          CategoryRepository categoryRepository,
                                                          Map<String, Category> categoryCache) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Category name cannot be blank");
        }
        if (user == null) {
            throw new IllegalArgumentException("User context required for category resolution");
        }
        String trimmed = name.trim();
        String cacheKey = trimmed.toLowerCase(Locale.ROOT);
        if (categoryCache != null && categoryCache.containsKey(cacheKey)) {
            return categoryCache.get(cacheKey);
        }

        Optional<Category> userCat = categoryRepository.findByUserAndNameIgnoreCase(user, trimmed);
        if (userCat.isPresent()) {
            Category cat = userCat.get();
            if (categoryCache != null) {
                categoryCache.put(cacheKey, cat);
            }
            return cat;
        }

        Optional<Category> globalCat = categoryRepository.findByUserIsNullAndNameIgnoreCase(trimmed);
        if (globalCat.isPresent()) {
            Category cat = globalCat.get();
            if (categoryCache != null) {
                categoryCache.put(cacheKey, cat);
            }
            return cat;
        }

        Category newCat = new Category();
        newCat.setName(trimmed);
        newCat.setUser(user);
        Category saved = categoryRepository.save(newCat);
        if (categoryCache != null) {
            categoryCache.put(cacheKey, saved);
        }
        return saved;
    }
}
