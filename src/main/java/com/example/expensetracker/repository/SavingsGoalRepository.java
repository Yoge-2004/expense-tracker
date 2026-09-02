package com.example.expensetracker.repository;

import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
