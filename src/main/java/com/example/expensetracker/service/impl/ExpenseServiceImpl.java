package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.service.ExpenseService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Concrete implementation of {@link ExpenseService} providing business logic
 * for creating, retrieving, updating, and deleting expense records.
 *
 * <p>This service enforces user ownership on all mutating operations —
 * users may only modify or delete their own expense records. Category
 * ownership validation is also applied during expense creation to prevent
 * users from assigning categories that belong to other users.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see ExpenseService
 * @see ExpenseRepository
 * @see CategoryRepository
 */
@Service
public class ExpenseServiceImpl implements ExpenseService {

    private static final Logger log = LoggerFactory.getLogger(ExpenseServiceImpl.class);

    /** Repository for expense persistence and querying. */
    private final ExpenseRepository expenseRepository;

    /** Repository for category lookups during ownership validation. */
    private final CategoryRepository categoryRepository;

    /**
     * Constructs an {@code ExpenseServiceImpl} with the required repositories.
     *
     * @param expenseRepository  the JPA repository for {@link Expense} entities
     * @param categoryRepository the JPA repository for {@link Category} entities
     */
    public ExpenseServiceImpl(ExpenseRepository expenseRepository,
                              CategoryRepository categoryRepository) {
        this.expenseRepository = expenseRepository;
        this.categoryRepository = categoryRepository;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Validates that the referenced {@link Category} exists. If a category ID
     * is provided on the expense, it is resolved from the database and its ownership
     * is checked — the category must either be global (no user) or owned by the
     * requesting user. The user is then linked to the expense before saving.</p>
     *
     * <p>After saving, the expense list cache for this user is evicted to ensure
     * the next read returns fresh data from the database.</p>
     *
     * @param expense the expense to create; category ID must reference an existing category
     * @param user    the owner of the expense
     * @return the persisted {@link Expense} entity with generated ID and audit timestamps
     * @throws IllegalArgumentException if the category does not exist or belongs to
     *                                  a different user
     */
    @Override
    @CacheEvict(value = "userExpenses", key = "#user.id")
    public Expense createExpense(Expense expense, User user) {
        log.info("Creating expense for userId={}: amount={}, date={}, categoryId={}",
                user.getId(), expense.getAmount(), expense.getExpenseDate(),
                expense.getCategory() != null ? expense.getCategory().getId() : null);

        if (expense.getCategory() != null && expense.getCategory().getId() != null) {
            Category category = categoryRepository
                    .findById(expense.getCategory().getId())
                    .orElseThrow(() ->
                            new IllegalArgumentException("Category not found"));

            // Validate ownership: only global or user-owned categories are permitted
            if (category.getUser() != null
                    && !category.getUser().getId().equals(user.getId())) {
                log.warn("Category ownership violation: categoryId={} does not belong to userId={}",
                        category.getId(), user.getId());
                throw new IllegalArgumentException(
                        "Category does not belong to this user");
            }

            expense.setCategory(category);
        }

        expense.setUser(user);
        Expense saved = expenseRepository.save(expense);
        log.info("Saved expense id={} for userId={}", saved.getId(), user.getId());
        return saved;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Result is cached in {@code userExpenses} keyed by {@code user.id}.
     * This avoids repeated SQL round-trips to Neon on every dashboard reload.
     * Cache is evicted on any write (create, update, delete) for this user.</p>
     *
     * @param user the owner of the expenses to retrieve
     * @return a list of all {@link Expense} records owned by the user
     */
    @Override
    @Cacheable(value = "userExpenses", key = "#user.id")
    public List<Expense> getUserExpenses(User user) {
        log.debug("Loading expenses from DB/Cache for userId={}", user.getId());
        List<Expense> expenses = expenseRepository.findByUser(user);
        log.debug("Loaded {} expense records for userId={}", expenses.size(), user.getId());
        return expenses;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Loads the expense by ID, verifies that it belongs to the given user,
     * and deletes it. Throws an {@link IllegalArgumentException} if the expense
     * is not found or ownership does not match.</p>
     *
     * <p>Evicts the user's cached expense list on successful deletion.</p>
     *
     * @param expenseId the ID of the expense to delete
     * @param user      the user requesting deletion; must own the expense
     * @throws IllegalArgumentException if the expense is not found or does not
     *                                  belong to the given user
     */
    @Override
    @CacheEvict(value = "userExpenses", key = "#user.id")
    public void deleteExpense(Long expenseId, User user) {
        log.info("Deleting expense id={} for userId={}", expenseId, user.getId());
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Expense not found"));

        if (!expense.getUser().getId().equals(user.getId())) {
            log.warn("Ownership mismatch: expense id={} does not belong to userId={}", expenseId, user.getId());
            throw new IllegalArgumentException(
                    "Expense does not belong to this user");
        }

        expenseRepository.delete(expense);
        log.info("Deleted expense id={} for userId={}", expenseId, user.getId());
    }

    /**
     * {@inheritDoc}
     *
     * <p>Loads the existing expense by ID and verifies user ownership.
     * Applies updates only to non-null fields provided in {@code expenseUpdates}:
     * description, amount, expense date, and category. Updated entity is then saved.</p>
     *
     * <p>Evicts the user's cached expense list so the next fetch reflects the update.</p>
     *
     * @param expenseId      the ID of the expense to update
     * @param expenseUpdates contains the new field values to apply
     * @param user           the user requesting the update; must own the expense
     * @return the updated and persisted {@link Expense} entity
     * @throws RuntimeException if the expense is not found or does not belong to the user
     */
    @Override
    @CacheEvict(value = "userExpenses", key = "#user.id")
    public Expense updateExpense(Long expenseId, Expense expenseUpdates, User user) {
        log.info("Updating expense id={} for userId={}", expenseId, user.getId());
        Expense existing = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new RuntimeException("Expense not found"));

        if (!existing.getUser().getId().equals(user.getId())) {
            log.warn("Ownership mismatch: expense id={} does not belong to userId={}", expenseId, user.getId());
            throw new RuntimeException("Expense does not belong to this user");
        }

        if (expenseUpdates.getDescription() != null) {
            existing.setDescription(expenseUpdates.getDescription());
        }
        if (expenseUpdates.getAmount() != null) {
            existing.setAmount(expenseUpdates.getAmount());
        }
        if (expenseUpdates.getExpenseDate() != null) {
            existing.setExpenseDate(expenseUpdates.getExpenseDate());
        }
        if (expenseUpdates.getCategory() != null) {
            existing.setCategory(expenseUpdates.getCategory());
        }

        Expense saved = expenseRepository.save(existing);
        log.info("Updated expense id={} successfully for userId={}", saved.getId(), user.getId());
        return saved;
    }
}
