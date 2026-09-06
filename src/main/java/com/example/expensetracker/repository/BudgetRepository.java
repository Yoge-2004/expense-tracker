package com.example.expensetracker.repository;

import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for {@link Budget} entities.
 *
 * <p>Provides CRUD operations inherited from {@link JpaRepository} along with
 * custom query methods for retrieving budgets scoped to a specific user
 * or a user–category combination.</p>
 *
 * <p>Used primarily by
 * {@link com.example.expensetracker.controller.ExpenseController} to set budgets
 * and calculate budget utilisation status for the current calendar month.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see Budget
 */
public interface BudgetRepository extends JpaRepository<Budget, Long> {

    /**
     * Retrieves all budgets configured by the specified user.
     *
     * @param user the {@link User} whose budgets are to be fetched
     * @return a list of {@link Budget} records owned by the user;
     *         empty list if none exist
     */
    List<Budget> findByUser(User user);

    /**
     * Retrieves the budget configured for a specific user and category combination.
     *
     * <p>Used to check whether a budget already exists before deciding to
     * create a new one or update the existing one.</p>
     *
     * @param user       the {@link User} who owns the budget
     * @param categoryId the ID of the {@link com.example.expensetracker.model.Category}
     *                   for which the budget is set
     * @return an {@link Optional} containing the matching {@link Budget},
     *         or {@link Optional#empty()} if no budget exists for that pair
     */
    Optional<Budget> findByUserAndCategoryId(User user, Long categoryId);

    void deleteByUserAndCategoryId(User user, Long categoryId);

    void deleteByIdAndUser(Long id, User user);

    /**
     * Deletes all budgets owned by the specified user.
     *
     * @param userId the ID of the owning user
     */
    @Modifying
    @Query("DELETE FROM Budget b WHERE b.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
