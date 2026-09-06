package com.example.expensetracker.repository;

import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * Spring Data JPA repository for {@link Income} entities.
 *
 * @author Yogeshwaran
 */
public interface IncomeRepository extends JpaRepository<Income, Long> {

    /**
     * Retrieves all income records belonging to a user.
     *
     * @param user the user entity
     * @return list of income entities
     */
    List<Income> findByUser(User user);

    /**
     * Retrieves all income records belonging to a user within an inclusive date range.
     *
     * @param user the user entity
     * @param startDate range start date (inclusive)
     * @param endDate range end date (inclusive)
     * @return list of matching income entities
     */
    List<Income> findByUserAndIncomeDateBetween(User user, LocalDate startDate, LocalDate endDate);

    /**
     * Retrieves recurring income entries whose next due date is on or before a given date.
     *
     * @param date threshold date
     * @return list of due recurring incomes
     */
    List<Income> findByIsRecurringTrueAndNextDueDateLessThanEqual(LocalDate date);

    /**
     * Deletes all income records owned by the specified user.
     *
     * @param userId the ID of the owning user
     */
    @Modifying
    @Query("DELETE FROM Income i WHERE i.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
