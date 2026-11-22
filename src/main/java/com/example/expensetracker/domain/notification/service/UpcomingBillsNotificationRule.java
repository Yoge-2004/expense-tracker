package com.example.expensetracker.domain.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

import com.example.expensetracker.domain.expense.model.RecurringExpense;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;
import com.example.expensetracker.domain.notification.model.NotificationType;
import com.example.expensetracker.domain.user.model.User;

/**
 * Detects upcoming recurring bill disbursements and due subscription reminders.
 *
 * @author Yogeshwaran
 */
@Component
@RequiredArgsConstructor
public non-sealed class UpcomingBillsNotificationRule implements NotificationRule {

    private static final int[] DUE_REMINDER_DAYS = {3, 1, 0};

    private final RecurringExpenseRepository recurringExpenseRepository;

    @Override
    public List<PendingNotification> detect(User user, LocalDate today) {
        List<PendingNotification> result = new ArrayList<>();
        for (RecurringExpense bill : recurringExpenseRepository.findByUser(user)) {
            if (bill.getNextDueDate() == null) {
                continue;
            }
            long days = ChronoUnit.DAYS.between(today, bill.getNextDueDate());
            if (Arrays.stream(DUE_REMINDER_DAYS).noneMatch(d -> d == days)) {
                continue;
            }
            String when = days == 0 ? "today" : days == 1 ? "tomorrow" : "in " + days + " days";
            String name = bill.getDescription() == null || bill.getDescription().isBlank() ? "A bill" : bill.getDescription();
            result.add(new PendingNotification(NotificationType.SUBSCRIPTION_DUE,
                    name + " is due " + when,
                    NotificationRules.money(user.getCurrency(), bill.getAmount()) + " is due on " + bill.getNextDueDate() + ".",
                    "subscriptions", "bill:" + bill.getId() + ":" + bill.getNextDueDate() + ":" + days));
        }
        return result;
    }
}
