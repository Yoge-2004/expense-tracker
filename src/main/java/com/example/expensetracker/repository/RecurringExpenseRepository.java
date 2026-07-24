package com.example.expensetracker.repository;

import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

/**
 * Spring Data JPA repository for {@link RecurringExpense} entities.
 *
 * <p>Provides standard CRUD operations via {@link JpaRepository}, along with
 * custom query methods used by the scheduler to identify due subscriptions
 * and by the controller to list a user's active subscriptions.</p>
 *
 * <p>Used by:</p>
 * <ul>
 *   <li>{@link com.example.expensetracker.service.RecurringExpenseScheduler} —
 *       to find and process all due recurring expenses each day.</li>
 *   <li>{@link com.example.expensetracker.controller.ExpenseController} —
 *       to list, add, update, and cancel user subscriptions.</li>
 * </ul>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see RecurringExpense
 */
public interface RecurringExpenseRepository extends JpaRepository<RecurringExpense, Long> {

    /**
     * Retrieves all recurring expenses whose {@code nextDueDate} is on or before
     * the specified date.
     *
     * <p>Called daily by the {@link com.example.expensetracker.service.RecurringExpenseScheduler}
     * with today's date to find any subscriptions that are due to generate a new
     * {@link com.example.expensetracker.model.Expense} record.</p>
     *
     * @param date the cutoff date; all recurring expenses with a due date on or before
     *             this date are returned
     * @return a list of {@link RecurringExpense} records due for processing;
     *         empty list if none are due
     */
    List<RecurringExpense> findByNextDueDateLessThanEqual(LocalDate date);

    /**
     * Retrieves all recurring expense subscriptions belonging to a specific user.
     *
     * <p>Used by the {@code GET /api/expenses/recurring/user/{userId}} endpoint
     * to display all active subscriptions in the user's dashboard.</p>
     *
     * @param user the {@link User} whose recurring expenses are to be retrieved
     * @return a list of {@link RecurringExpense} records owned by the user;
     *         empty list if the user has no active subscriptions
     */
    List<RecurringExpense> findByUser(User user);
}
