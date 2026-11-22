package com.example.expensetracker.domain.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.notification.model.NotificationType;
import com.example.expensetracker.domain.user.model.User;

/**
 * Detects unusually large expenditure outliers compared to historical expenditure averages.
 *
 * @author Yogeshwaran
 */
@Component
@RequiredArgsConstructor
public non-sealed class LargeExpenseNotificationRule implements NotificationRule {

    private static final int LARGE_EXPENSE_HISTORY_DAYS = 90;

    private final ExpenseRepository expenseRepository;

    @Override
    public List<PendingNotification> detect(User user, LocalDate today) {
        LocalDate yesterday = today.minusDays(1);
        List<Expense> recent = expenseRepository.findByUserAndExpenseDateBetween(user, yesterday, yesterday);
        if (recent.isEmpty()) {
            return List.of();
        }
        List<BigDecimal> history = expenseRepository
                .findByUserAndExpenseDateBetween(user, yesterday.minusDays(LARGE_EXPENSE_HISTORY_DAYS), yesterday.minusDays(1))
                .stream().map(Expense::getAmount).filter(Objects::nonNull).toList();
        BigDecimal average = NotificationRules.average(history);

        List<PendingNotification> result = new ArrayList<>();
        for (Expense expense : recent) {
            // Bills the app created on its own are expected, not surprising.
            if (expense.getDescription() != null && expense.getDescription().endsWith("(Auto)")) {
                continue;
            }
            if (!NotificationRules.isLargeExpense(expense.getAmount(), history)) {
                continue;
            }
            long times = expense.getAmount().divide(average, 0, RoundingMode.HALF_UP).longValue();
            String name = expense.getDescription() == null || expense.getDescription().isBlank() ? "An expense" : expense.getDescription();
            result.add(new PendingNotification(NotificationType.LARGE_EXPENSE,
                    "Large expense: " + name,
                    NotificationRules.money(user.getCurrency(), expense.getAmount()) + " is about " + times
                            + "x your usual expense.",
                    "dashboard", "large:" + expense.getId()));
        }
        return result;
    }
}
