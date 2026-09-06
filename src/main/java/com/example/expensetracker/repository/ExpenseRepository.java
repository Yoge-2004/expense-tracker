package com.example.expensetracker.repository;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /**
     * Checks whether any expense (for any user) currently references the given
     * category. Used to guard category deletion — a category that's in use
     * must not be deleted, since doing so would orphan those expense records.
     *
     * @param categoryId the ID of the category to check
     * @return {@code true} if at least one expense references this category
     */
    boolean existsByCategory_Id(Long categoryId);

    /**
     * Retrieves all expenses with category and user eagerly fetched.
     *
     * @return list of expenses with eagerly fetched relationships
     */
    @Query("SELECT e FROM Expense e LEFT JOIN FETCH e.category LEFT JOIN FETCH e.user")
    List<Expense> findAllWithCategoryAndUser();

    /**
     * Deletes all expenses owned by the specified user.
     *
     * @param userId the ID of the owning user
     */
    @Modifying
    @Query("DELETE FROM Expense e WHERE e.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
