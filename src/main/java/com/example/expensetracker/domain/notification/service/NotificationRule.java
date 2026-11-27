package com.example.expensetracker.domain.notification.service;

import java.time.LocalDate;
import java.util.List;
import com.example.expensetracker.domain.user.model.User;

/**
 * Strategy interface for detecting pending user notifications.
 * Implements the Strategy Pattern and Open-Closed Principle (OCP), allowing
 * new notification detection rules to be added without modifying existing detectors.
 *
 * @author Yogeshwaran
 */
public interface NotificationRule {

    /**
     * Evaluates this rule for the given user on the specified reference date.
     *
     * @param user target user
     * @param today reference date
     * @return list of pending notifications detected by this rule
     */
    List<PendingNotification> detect(User user, LocalDate today);
}
