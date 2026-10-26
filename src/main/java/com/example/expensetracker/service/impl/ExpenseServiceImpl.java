package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.validator.ExpenseValidator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Concrete implementation of {@link ExpenseService} providing business logic
 * for creating, retrieving, updating, deleting, and querying expense records.
 * <p>
 * Decouples business validation and IDOR access invariants into {@link ExpenseValidator}
 * to fulfill the Single Responsibility Principle (SRP).
 * </p>
 *
 * @author Yogeshwaran
 * @version 1.1
 * @see ExpenseService
 * @see ExpenseValidator
 * @see ExpenseRepository
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ExpenseValidator expenseValidator;

    /**
     * Primary constructor injecting repositories and dedicated validator.
     */
    @Autowired
    public ExpenseServiceImpl(ExpenseRepository expenseRepository,
                              CategoryRepository categoryRepository,
                              @Autowired(required = false) ExpenseValidator expenseValidator) {
        this.expenseRepository = expenseRepository;
        this.expenseValidator = (expenseValidator != null)
                ? expenseValidator
                : new ExpenseValidator(categoryRepository);
    }

    /**
     * Convenience constructor preserving backward compatibility for test harnesses.
     */
    public ExpenseServiceImpl(ExpenseRepository expenseRepository, CategoryRepository categoryRepository) {
        this(expenseRepository, categoryRepository, null);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userExpenses", key = "#user.id")
    public Expense createExpense(Expense expense, User user) {
        expenseValidator.validateUser(user);
        expenseValidator.validateExpenseBasic(expense, user.getId());

        log.info("Creating expense for userId={}: amount={}, date={}, categoryId={}",
                user.getId(), expense.getAmount(), expense.getExpenseDate(),
                expense.getCategory() != null ? expense.getCategory().getId() : null);

        if (expense.getCategory() != null && expense.getCategory().getId() != null) {
            Category category = expenseValidator.resolveAndValidateCategory(
                    expense.getCategory().getId(), user.getId());
            expense.setCategory(category);
        }

        expense.setUser(user);
        Expense saved = expenseRepository.save(expense);
        log.info("Saved expense id={} for userId={}", saved.getId(), user.getId());
        return saved;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userExpenses", key = "#user.id")
    public List<Expense> createExpenses(List<Expense> expenses, User user) {
        if (expenses == null || expenses.isEmpty()) {
            return Collections.emptyList();
        }
        Map<Long, Category> categoryCache = new HashMap<>();
        expenseValidator.validateBatch(expenses, user, categoryCache);

        List<Expense> saved = expenseRepository.saveAll(expenses);
        log.info("Batch saved {} expenses for userId={}", saved.size(), user.getId());
        return saved;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Cacheable(value = "userExpenses", key = "#user.id")
    public List<Expense> getUserExpenses(User user) {
        expenseValidator.validateUser(user);
        log.debug("Loading expenses from DB/Cache for userId={}", user.getId());
        List<Expense> expenses = expenseRepository.findByUser(user);
        log.debug("Loaded {} expense records for userId={}", expenses.size(), user.getId());
        return expenses;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Page<Expense> getUserExpenses(User user, Pageable pageable) {
        expenseValidator.validateUser(user);
        return expenseRepository.findByUserWithCategory(user, pageable);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public List<Expense> getUserExpensesByDateRange(User user, LocalDate startDate, LocalDate endDate) {
        expenseValidator.validateUser(user);
        if (startDate != null && endDate != null) {
            return expenseRepository.findByUserAndExpenseDateBetween(user, startDate, endDate);
        } else if (startDate != null) {
            return expenseRepository.findByUserAndExpenseDateGreaterThanEqual(user, startDate);
        } else if (endDate != null) {
            return expenseRepository.findByUserAndExpenseDateLessThanEqual(user, endDate);
        }
        return expenseRepository.findByUser(user);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Optional<Expense> getExpenseById(Long expenseId, User user) {
        expenseValidator.validateUser(user);
        if (expenseId == null) {
            return Optional.empty();
        }
        return expenseRepository.findByIdAndUser(expenseId, user);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public BigDecimal getTotalExpensesByUser(User user) {
        expenseValidator.validateUser(user);
        return expenseRepository.sumTotalExpensesAmountByUser(user);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public long getExpenseCountByUser(User user) {
        expenseValidator.validateUser(user);
        return expenseRepository.countByUser(user);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userExpenses", key = "#user.id")
    public void deleteExpense(Long expenseId, User user) {
        if (expenseId == null) {
            throw new IllegalArgumentException("Expense ID cannot be null");
        }
        expenseValidator.validateUser(user);
        log.info("Deleting expense id={} for userId={}", expenseId, user.getId());
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new IllegalArgumentException("Expense not found"));

        if (!expense.getUser().getId().equals(user.getId())) {
            log.warn("Ownership mismatch: expense id={} does not belong to userId={}", expenseId, user.getId());
            throw new IllegalArgumentException("Expense does not belong to this user");
        }

        expenseRepository.delete(expense);
        log.info("Deleted expense id={} for userId={}", expenseId, user.getId());
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userExpenses", key = "#user.id")
    public Expense updateExpense(Long expenseId, Expense expenseUpdates, User user) {
        if (expenseId == null) {
            throw new IllegalArgumentException("Expense ID cannot be null");
        }
        expenseValidator.validateUser(user);
        if (expenseUpdates == null) {
            throw new IllegalArgumentException("Expense updates cannot be null");
        }
        if (expenseUpdates.getAmount() != null && expenseUpdates.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Expense amount must be greater than zero");
        }
        log.info("Updating expense id={} for userId={}", expenseId, user.getId());
        Expense existing = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new IllegalArgumentException("Expense not found"));

        expenseValidator.validateOwnership(existing, user.getId());

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
            if (expenseUpdates.getCategory().getId() != null) {
                Category category = expenseValidator.resolveAndValidateCategory(
                        expenseUpdates.getCategory().getId(), user.getId());
                existing.setCategory(category);
            } else {
                existing.setCategory(null);
            }
        }

        Expense updated = expenseRepository.save(existing);
        log.info("Expense id={} updated successfully for userId={}", updated.getId(), user.getId());
        return updated;
    }
}
