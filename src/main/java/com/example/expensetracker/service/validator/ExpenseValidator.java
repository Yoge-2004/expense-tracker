package com.example.expensetracker.service.validator;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Dedicated validator enforcing domain invariants and security ownership policies for expenses.
 * <p>
 * Fulfills the Single Responsibility Principle (SRP) by decoupling validation rules,
 * IDOR authorization checks, and category resolution from persistence orchestration.
 * </p>
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExpenseValidator {

    private final CategoryRepository categoryRepository;

    /**
     * Validates that the user context is present and has an assigned ID.
     *
     * @param user the user requesting the operation
     * @throws IllegalArgumentException if the user or user ID is null
     */
    public void validateUser(User user) {
        if (user == null || user.getId() == null) {
            log.warn("Rejected expense operation with null user context");
            throw new IllegalArgumentException("User must be specified");
        }
    }

    /**
     * Validates that an expense payload satisfies basic integrity constraints.
     *
     * @param expense the expense entity
     * @param userId  ID of the operating user for diagnostic logging
     * @throws IllegalArgumentException if the expense is null, amount is non-positive, or date is null
     */
    public void validateExpenseBasic(Expense expense, Long userId) {
        if (expense == null) {
            log.warn("Rejected null expense for userId={}", userId);
            throw new IllegalArgumentException("Expense cannot be null");
        }
        if (expense.getAmount() == null || expense.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Rejected non-positive expense amount={} for userId={}", expense.getAmount(), userId);
            throw new IllegalArgumentException("Expense amount must be greater than zero");
        }
        if (expense.getExpenseDate() == null) {
            log.warn("Rejected expense with null date for userId={}", userId);
            throw new IllegalArgumentException("Expense date cannot be null");
        }
    }

    /**
     * Resolves the referenced category from the database and verifies that it either belongs
     * to the user or is a global category (no owner).
     *
     * @param categoryId ID of the category to resolve
     * @param userId     ID of the operating user
     * @return the resolved {@link Category} entity, or {@code null} if categoryId is null
     * @throws IllegalArgumentException if the category is not found or belongs to another user
     */
    public Category resolveAndValidateCategory(Long categoryId, Long userId) {
        if (categoryId == null) {
            return null;
        }
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        if (category.getUser() != null && !category.getUser().getId().equals(userId)) {
            log.warn("Category ownership violation: categoryId={} does not belong to userId={}", categoryId, userId);
            throw new IllegalArgumentException("Category does not belong to this user");
        }
        return category;
    }

    /**
     * Validates user ownership on an existing expense to prevent IDOR attacks.
     *
     * @param existing the existing expense from the database
     * @param userId   ID of the operating user
     * @throws AccessDeniedException if the expense does not belong to the user
     */
    public void validateOwnership(Expense existing, Long userId) {
        if (existing == null) {
            log.warn("Rejected null existing expense ownership verification for userId={}", userId);
            throw new IllegalArgumentException("Expense cannot be null");
        }
        if (existing.getUser() == null || !existing.getUser().getId().equals(userId)) {
            log.warn("Ownership mismatch: expense id={} does not belong to userId={}",
                    existing.getId(), userId);
            throw new AccessDeniedException("Expense does not belong to this user");
        }
    }

    /**
     * Validates a batch of expense entries, populating a local cache to prevent redundant DB lookups.
     *
     * @param expenses      the list of expenses to validate
     * @param user          the owner context
     * @param categoryCache in-memory cache for resolved categories
     */
    public void validateBatch(java.util.List<Expense> expenses, User user, Map<Long, Category> categoryCache) {
        validateUser(user);
        if (expenses == null || expenses.isEmpty()) {
            return;
        }

        for (Expense exp : expenses) {
            validateExpenseBasic(exp, user.getId());
            if (exp.getCategory() != null && exp.getCategory().getId() != null) {
                Long catId = exp.getCategory().getId();
                Category category = categoryCache.computeIfAbsent(catId, id -> {
                    Category c = categoryRepository.findById(id)
                            .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + id));
                    if (c.getUser() != null && !c.getUser().getId().equals(user.getId())) {
                        throw new IllegalArgumentException("Category does not belong to this user");
                    }
                    return c;
                });
                exp.setCategory(category);
            }
            exp.setUser(user);
        }
    }
}
