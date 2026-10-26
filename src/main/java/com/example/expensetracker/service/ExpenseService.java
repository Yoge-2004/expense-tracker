package com.example.expensetracker.service;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Service interface defining the business operations for managing expense records.
 * <p>
 * This interface abstracts the expense management layer, providing methods
 * to create, read, update, delete, and query expense entries scoped to individual users.
 * The concrete implementation is provided by
 * {@link com.example.expensetracker.service.impl.ExpenseServiceImpl}.
 * </p>
 * <p>
 * Ownership validation and domain invariants are enforced at this layer — users may only read,
 * update, or delete their own expense records.
 * </p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see com.example.expensetracker.service.impl.ExpenseServiceImpl
 */
public interface ExpenseService {

    /**
     * Creates and persists a new expense record associated with the specified user.
     *
     * <p>Before persisting, validates that the referenced category (if any)
     * belongs to the user or is a global category. The user is linked to the
     * expense before saving.</p>
     *
     * @param expense the {@link Expense} entity populated with amount, description,
     *                date, and optional category; must not be {@code null}
     * @param user    the {@link User} who owns this expense; must not be {@code null}
     * @return the persisted {@link Expense} entity with a generated ID and audit timestamps
     * @throws IllegalArgumentException if the referenced category does not exist or
     *                                  does not belong to the user
     */
    Expense createExpense(Expense expense, User user);

    /**
     * Persists a collection of expense records in a single transactional batch.
     *
     * <p>Optimized for batch operations (CSV/JSON/Excel import). Pre-validates
     * inputs, links ownership, persists via batch insert, and executes a single
     * cache eviction.</p>
     *
     * @param expenses the list of expenses to save
     * @param user     the user context
     * @return list of saved expenses
     */
    List<Expense> createExpenses(List<Expense> expenses, User user);

    /**
     * Retrieves all expense records belonging to the specified user.
     *
     * @param user the {@link User} whose expenses are to be retrieved
     * @return a list of {@link Expense} entities owned by the user;
     *         empty list if the user has recorded no expenses
     */
    List<Expense> getUserExpenses(User user);

    /**
     * Retrieves a paginated slice of expense records belonging to the specified user.
     *
     * @param user     the owning user
     * @param pageable pagination parameters (page number, page size, sort order)
     * @return a paginated page of expenses with initialized categories
     */
    Page<Expense> getUserExpenses(User user, Pageable pageable);

    /**
     * Retrieves all expenses recorded by the user within an inclusive date interval.
     * Uses indexed database-level range query with category fetch join.
     *
     * @param user      the owning user
     * @param startDate interval start date (inclusive)
     * @param endDate   interval end date (inclusive)
     * @return list of expenses in the specified range
     */
    List<Expense> getUserExpensesByDateRange(User user, LocalDate startDate, LocalDate endDate);

    /**
     * Finds a single expense by ID scoped to the authenticated user.
     *
     * @param expenseId the expense ID
     * @param user      the owning user
     * @return an optional containing the expense if found and owned by user
     */
    Optional<Expense> getExpenseById(Long expenseId, User user);

    /**
     * Computes the total cumulative sum of all expenses recorded by the given user.
     *
     * @param user the owning user
     * @return total expense sum, or zero if none exist
     */
    BigDecimal getTotalExpensesByUser(User user);

    /**
     * Counts the total number of expense entries recorded by the given user.
     *
     * @param user the owning user
     * @return total count of expense records
     */
    long getExpenseCountByUser(User user);

    /**
     * Deletes an expense record by its ID, enforcing user ownership.
     *
     * <p>Verifies that the expense identified by {@code expenseId} belongs to
     * the specified user before deletion. Throws an exception if the expense
     * does not exist or is owned by a different user.</p>
     *
     * @param expenseId the ID of the expense to delete
     * @param user      the {@link User} requesting the deletion (must own the expense)
     * @throws IllegalArgumentException if the expense does not exist or does not
     *                                  belong to the given user
     */
    void deleteExpense(Long expenseId, User user);

    /**
     * Updates an existing expense record with new values, enforcing user ownership.
     *
     * <p>Only the fields present in {@code expenseUpdates} are applied; the
     * expense must already exist and be owned by the specified user.</p>
     *
     * @param expenseId      the ID of the expense to update
     * @param expenseUpdates an {@link Expense} object whose non-null fields
     *                       will overwrite the corresponding fields of the existing record
     * @param user           the {@link User} requesting the update (must own the expense)
     * @return the updated and re-persisted {@link Expense} entity
     * @throws RuntimeException if the expense does not exist or does not belong
     *                          to the given user
     */
    Expense updateExpense(Long expenseId, Expense expenseUpdates, User user);
}
