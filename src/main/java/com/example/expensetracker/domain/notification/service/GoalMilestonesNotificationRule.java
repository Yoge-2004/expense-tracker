package com.example.expensetracker.domain.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.*;

import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.notification.model.NotificationType;
import com.example.expensetracker.domain.user.model.User;

/**
 * Detects milestone achievements (25%, 50%, 75%, 100%) for active savings goals.
 *
 * @author Yogeshwaran
 */
@Component
@RequiredArgsConstructor
public class GoalMilestonesNotificationRule implements NotificationRule {

    private final SavingsGoalRepository savingsGoalRepository;

    @Override
    public List<PendingNotification> detect(User user, LocalDate today) {
        List<PendingNotification> result = new ArrayList<>();
        for (SavingsGoal goal : savingsGoalRepository.findByUser(user)) {
            int milestone = NotificationRules.goalMilestone(goal.getCurrentAmount(), goal.getTargetAmount());
            if (milestone == 0) {
                continue;
            }
            String title = milestone == 100 ? "Goal reached: " + goal.getName()
                    : goal.getName() + " is " + milestone + "% funded";
            String body = milestone == 100
                    ? "You saved the full " + NotificationRules.money(user.getCurrency(), goal.getTargetAmount()) + "."
                    : NotificationRules.money(user.getCurrency(), goal.getCurrentAmount()) + " of "
                    + NotificationRules.money(user.getCurrency(), goal.getTargetAmount()) + " saved.";
            result.add(new PendingNotification(NotificationType.GOAL_MILESTONE, title, body,
                    "goals", "goal:" + goal.getId() + ":" + milestone));
        }
        return result;
    }
}
