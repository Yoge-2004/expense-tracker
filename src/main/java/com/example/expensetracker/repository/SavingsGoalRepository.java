package com.example.expensetracker.repository;

import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for {@link SavingsGoal} entities.
 *
 * @author Yogeshwaran
 */
public interface SavingsGoalRepository extends JpaRepository<SavingsGoal, Long> {

    /**
     * Retrieves all savings goals configured for a specific user.
     *
     * @param user the user entity
     * @return list of savings goals
     */
    List<SavingsGoal> findByUser(User user);

    /**
     * Finds a savings goal by ID enforcing user tenancy / ownership.
     *
     * @param id the savings goal ID
     * @param user the user entity
     * @return optional containing the matching savings goal if found and owned by user
     */
    Optional<SavingsGoal> findByIdAndUser(Long id, User user);

    /**
     * Retrieves all recurring savings goals whose next due date is on or before the given threshold date.
     *
     * @param date threshold date
     * @return list of due recurring savings goals
     */
    List<SavingsGoal> findByIsRecurringTrueAndNextDueDateLessThanEqual(LocalDate date);

    /**
     * Retrieves all recurring savings goals configured for a specific user.
     *
     * @param user the user entity
     * @return list of recurring savings goals
     */
    List<SavingsGoal> findByUserAndIsRecurringTrue(User user);

    /**
     * Deletes all savings goals owned by the specified user.
     *
     * @param userId the ID of the owning user
     */
    @Modifying
    @Query("DELETE FROM SavingsGoal s WHERE s.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
