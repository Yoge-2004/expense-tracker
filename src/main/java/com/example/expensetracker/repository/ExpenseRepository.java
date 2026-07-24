package com.example.expensetracker.repository;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

/**
 * Spring Data JPA repository for {@link Expense} entities.
 *
 * <p>Extends {@link JpaRepository} to provide standard CRUD operations
 * alongside custom query methods for user-scoped expense retrieval and
 * date-range filtering used in budget status calculations.</p>
 *
 * <p>Used by {@link com.example.expensetracker.service.impl.ExpenseServiceImpl}
 * for business-layer queries and by
 * {@link com.example.expensetracker.controller.ExpenseController}
 * for budget utilisation calculations.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see Expense
 */
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    /**
     * Retrieves all expenses belonging to the specified user.
     *
     * @param user the {@link User} whose expenses are to be retrieved
     * @return a list of {@link Expense} records owned by the user;
     *         empty list if the user has no expenses
     */
    List<Expense> findByUser(User user);

    /**
     * Retrieves all expenses for a user that fall within a given date range (inclusive).
     *
     * <p>Used primarily in budget status calculations to sum spending within
     * the current calendar month for each category.</p>
     *
     * @param user      the {@link User} whose expenses are being filtered
     * @param startDate the start of the date range (inclusive), typically the first
     *                  day of the current month
     * @param endDate   the end of the date range (inclusive), typically the last
     *                  day of the current month
     * @return a list of {@link Expense} records within the specified date range;
     *         empty list if no matching expenses exist
     */
    List<Expense> findByUserAndExpenseDateBetween(User user, LocalDate startDate, LocalDate endDate);
}
