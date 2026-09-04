package com.example.expensetracker.service;

import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.dto.SavingsGoalRequest;
import com.example.expensetracker.model.User;

import java.math.BigDecimal;
import java.util.List;

/**
 * Service interface for managing savings targets, milestones, and deposit contributions.
 *
 * <p>Enforces multi-tenant ownership for all goal operations and automatically updates goal
 * status (e.g. transitioning to {@code COMPLETED}) when cumulative deposits reach or exceed
 * the target objective.</p>
 *
 * @author Yogeshwaran
 */
public interface SavingsGoalService {

    /**
     * Creates a new savings goal for the specified user.
     *
     * @param request goal creation request data
     * @param user the owning user
     * @return created savings goal as {@link SavingsGoalDto}
     */
    SavingsGoalDto createGoal(SavingsGoalRequest request, User user);

    /**
     * Retrieves all savings goals configured by the specified user.
     *
     * @param user the owning user
     * @return list of {@link SavingsGoalDto} instances
     */
    List<SavingsGoalDto> getUserGoals(User user);

    /**
     * Updates an existing savings goal.
     *
     * @param goalId ID of the goal to update
     * @param request updated goal parameters
     * @param user the owning user
     * @return updated savings goal as {@link SavingsGoalDto}
     * @throws IllegalArgumentException if the goal is not found or does not belong to the user
     */
    SavingsGoalDto updateGoal(Long goalId, SavingsGoalRequest request, User user);

    /**
     * Deposits a monetary contribution towards the specified savings goal.
     * Automatically transitions the goal's status to {@code COMPLETED} if the new accumulated
     * amount meets or exceeds the target amount.
     *
     * @param goalId ID of the goal
     * @param amount positive deposit amount
     * @param user the owning user
     * @return updated savings goal with recalculated progress percentage
     * @throws IllegalArgumentException if amount is non-positive, goal not found, or ownership fails
     */
    SavingsGoalDto depositToGoal(Long goalId, BigDecimal amount, User user);

    /**
     * Permanently deletes a savings goal.
     *
     * @param goalId ID of the goal to delete
     * @param user the owning user
     * @throws IllegalArgumentException if the goal is not found or does not belong to the user
     */
    void deleteGoal(Long goalId, User user);

    /**
     * Retrieves all recurring savings goals (chits, recurring deposits, SIPs) for the specified user.
     *
     * @param user the owning user
     * @return list of recurring {@link SavingsGoalDto} instances
     */
    List<SavingsGoalDto> getRecurringGoals(User user);
}
