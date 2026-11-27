package com.example.expensetracker.domain.expense.service;

/**
 * Extension point allowing external modules (such as budgets) to veto deletion of a
 * {@link com.example.expensetracker.domain.expense.model.Category} while still in use.
 */
@FunctionalInterface
public interface CategoryUsageChecker {

    /**
     * Checks whether any active domain record still references {@code categoryId}.
     *
     * @param categoryId identifier of the category candidate for deletion
     * @return {@code true} if the category is currently referenced
     */
    boolean isCategoryInUse(Long categoryId);
}
