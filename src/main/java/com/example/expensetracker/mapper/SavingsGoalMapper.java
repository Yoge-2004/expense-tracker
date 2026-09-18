package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.dto.SavingsGoalRequest;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Mapping utility converting between {@link SavingsGoal} entities and their corresponding DTOs.
 *
 * @author Yogeshwaran
 */
public final class SavingsGoalMapper {

    private SavingsGoalMapper() {}

    /**
     * Maps a {@link SavingsGoal} entity to its response {@link SavingsGoalDto},
     * calculating the dynamic progress percentage.
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

        return new SavingsGoalDto(
                goal.getId(),
                goal.getName(),
                goal.getTargetAmount(),
                goal.getCurrentAmount(),
                goal.getTargetDate(),
                goal.getStatus(),
                progress,
                goal.getIsRecurring(),
                goal.getRecurringAmount(),
                goal.getFrequency(),
                goal.getIntervalDays(),
                goal.getNextDueDate(),
                goal.getEndDate()
        );
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
        goal.setName(request.name());
        goal.setTargetAmount(request.targetAmount());
        goal.setCurrentAmount(request.currentAmount() != null ? request.currentAmount() : BigDecimal.ZERO);
        goal.setTargetDate(request.targetDate());
        goal.setStatus(request.status() != null ? request.status() : "IN_PROGRESS");
        goal.setIsRecurring(Boolean.TRUE.equals(request.isRecurring()));
        goal.setRecurringAmount(request.recurringAmount());
        goal.setFrequency(request.frequency());
        goal.setIntervalDays(request.intervalDays());
        goal.setNextDueDate(request.nextDueDate());
        goal.setEndDate(request.endDate());
        goal.setUser(user);
        return goal;
    }
}
