package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.dto.SavingsGoalRequest;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Utility mapper for converting between {@link SavingsGoal} entities and corresponding DTOs,
 * including dynamic computation of savings percentage progress.
 *
 * @author Yogeshwaran
 */
public final class SavingsGoalMapper {

    private SavingsGoalMapper() {}

    /**
     * Maps a {@link SavingsGoal} entity to its response {@link SavingsGoalDto},
     * calculating progress percentage based on current and target amounts.
     *
     * @param goal the savings goal entity
     * @return populated {@link SavingsGoalDto}, or null if input was null
     */
    public static SavingsGoalDto toDto(SavingsGoal goal) {
        if (goal == null) {
            return null;
        }

        double progress = 0.0;
        if (goal.getTargetAmount() != null && goal.getTargetAmount().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal current = goal.getCurrentAmount() != null ? goal.getCurrentAmount() : BigDecimal.ZERO;
            progress = current.divide(goal.getTargetAmount(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .doubleValue();
            progress = Math.round(progress * 10.0) / 10.0;
        }

        SavingsGoalDto dto = new SavingsGoalDto(
                goal.getId(),
                goal.getName(),
                goal.getTargetAmount(),
                goal.getCurrentAmount(),
                goal.getTargetDate(),
                goal.getStatus(),
                progress
        );
        dto.setIsRecurring(goal.getIsRecurring());
        dto.setRecurringAmount(goal.getRecurringAmount());
        dto.setFrequency(goal.getFrequency());
        dto.setIntervalDays(goal.getIntervalDays());
        dto.setNextDueDate(goal.getNextDueDate());
        dto.setEndDate(goal.getEndDate());
        return dto;
    }

    /**
     * Maps a {@link SavingsGoalRequest} DTO into a {@link SavingsGoal} entity for creation.
     *
     * @param request the request DTO
     * @param user the owning user
     * @return populated {@link SavingsGoal} entity, or null if request was null
     */
    public static SavingsGoal toEntity(SavingsGoalRequest request, User user) {
        if (request == null) {
            return null;
        }

        SavingsGoal goal = new SavingsGoal();
        goal.setName(request.getName());
        goal.setTargetAmount(request.getTargetAmount());
        goal.setCurrentAmount(request.getCurrentAmount() != null ? request.getCurrentAmount() : BigDecimal.ZERO);
        goal.setTargetDate(request.getTargetDate());
        goal.setStatus(request.getStatus() != null ? request.getStatus() : "IN_PROGRESS");
        goal.setIsRecurring(request.getIsRecurring() != null ? request.getIsRecurring() : false);
        goal.setRecurringAmount(request.getRecurringAmount());
        goal.setFrequency(request.getFrequency());
        goal.setIntervalDays(request.getIntervalDays());
        goal.setNextDueDate(request.getNextDueDate());
        goal.setEndDate(request.getEndDate());
        goal.setUser(user);
        return goal;
    }
}
