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
 * <p>This service is the domain boundary for expense ownership and category
 * ownership. A category may be global (no owner) or owned by the same user as
 * the expense. Resource ownership is enforced before persistence.</p>
 */
@Service
public class ExpenseServiceImpl implements ExpenseService {

    private static final Logger log = LoggerFactory.getLogger(ExpenseServiceImpl.class);

    private final ExpenseRepository expenseRepository;
    private final CategoryRepository categoryRepository;

    public ExpenseServiceImpl(ExpenseRepository expenseRepository,
                              CategoryRepository categoryRepository) {
        this.expenseRepository = expenseRepository;
        this.categoryRepository = categoryRepository;
    }

    @Override
    @CacheEvict(value = "userExpenses", key = "#user.id")
    public Expense createExpense(Expense expense, User user) {
        log.info("Creating expense for userId={}: amount={}, date={}, categoryId={}",
                user.getId(), expense.getAmount(), expense.getExpenseDate(),
                expense.getCategory() != null ? expense.getCategory().getId() : null);

        resolveAndValidateCategory(expense, user);
        expense.setUser(user);

        Expense saved = expenseRepository.save(expense);
        log.info("Saved expense id={} for userId={}", saved.getId(), user.getId());
        return saved;
    }

    @Override
    @Cacheable(value = "userExpenses", key = "#user.id")
    public List<Expense> getUserExpenses(User user) {
        log.debug("Loading expenses from DB/Cache for userId={}", user.getId());
        List<Expense> expenses = expenseRepository.findByUser(user);
        log.debug("Loaded {} expense records for userId={}", expenses.size(), user.getId());
        return expenses;
    }

    @Override
    @CacheEvict(value = "userExpenses", key = "#user.id")
    public void deleteExpense(Long expenseId, User user) {
        log.info("Deleting expense id={} for userId={}", expenseId, user.getId());
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new IllegalArgumentException("Expense not found"));

        validateExpenseOwnership(expense, user);
        expenseRepository.delete(expense);
        log.info("Deleted expense id={} for userId={}", expenseId, user.getId());
    }

    @Override
    @CacheEvict(value = "userExpenses", key = "#user.id")
    public Expense updateExpense(Long expenseId, Expense expenseUpdates, User user) {
        log.info("Updating expense id={} for userId={}", expenseId, user.getId());
        Expense existing = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new IllegalArgumentException("Expense not found"));

        validateExpenseOwnership(existing, user);

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
            // Never attach a caller-supplied Category entity directly. Resolve it
            // from the database so the same global/user-ownership rule used by
            // createExpense also applies to updates.
            resolveAndValidateCategory(expenseUpdates, user);
            existing.setCategory(expenseUpdates.getCategory());
        }

        Expense saved = expenseRepository.save(existing);
        log.info("Updated expense id={} successfully for userId={}", saved.getId(), user.getId());
        return saved;
    }

    /**
     * Resolves a category reference to the managed database entity and verifies
     * that it is either global or owned by the same user making the request.
     */
    private void resolveAndValidateCategory(Expense expense, User user) {
        Category requestedCategory = expense.getCategory();
        if (requestedCategory == null || requestedCategory.getId() == null) {
            return;
        }

        Category category = categoryRepository.findById(requestedCategory.getId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        if (category.getUser() != null
                && !category.getUser().getId().equals(user.getId())) {
            log.warn("Category ownership violation: categoryId={} does not belong to userId={}",
                    category.getId(), user.getId());
            throw new IllegalArgumentException("Category does not belong to this user");
        }

        expense.setCategory(category);
    }

    private void validateExpenseOwnership(Expense expense, User user) {
        if (expense.getUser() == null
                || expense.getUser().getId() == null
                || !expense.getUser().getId().equals(user.getId())) {
            log.warn("Ownership mismatch: expense id={} does not belong to userId={}",
                    expense.getId(), user.getId());
            throw new IllegalArgumentException("Expense does not belong to this user");
        }
    }
}
