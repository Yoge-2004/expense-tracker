package com.example.expensetracker.domain.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.notification.model.NotificationType;
import com.example.expensetracker.domain.user.model.User;

/**
 * Evaluates budget consumption thresholds and detects budget warning / exceeded alerts.
 *
 * @author Yogeshwaran
 */
@Component
@RequiredArgsConstructor
public class BudgetNotificationRule implements NotificationRule {

    private final BudgetRepository budgetRepository;
    private final ExpenseRepository expenseRepository;

    @Override
    public List<PendingNotification> detect(User user, LocalDate today) {
        List<PendingNotification> result = new ArrayList<>();
        for (Budget budget : budgetRepository.findByUser(user)) {
            LocalDate[] window = budgetWindow(budget, today);
            if (window == null) {
                continue;
            }
            List<Expense> inWindow = expenseRepository.findByUserAndExpenseDateBetween(user, window[0], window[1]);
            Long categoryId = budget.getCategory() != null ? budget.getCategory().getId() : null;
            BigDecimal spent = inWindow.stream()
                    .filter(e -> categoryId == null
                            || (e.getCategory() != null && categoryId.equals(e.getCategory().getId())))
                    .map(Expense::getAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            int level = NotificationRules.budgetLevel(spent, budget.getLimitAmount());
            if (level == 0) {
                continue;
            }
            String label = budget.getCategory() != null ? budget.getCategory().getName() : "Overall";
            String limit = NotificationRules.money(user.getCurrency(), budget.getLimitAmount());
            String used = NotificationRules.money(user.getCurrency(), spent);
            String key = "budget:" + budget.getId() + ":" + window[0] + ":" + level;
            if (level == 100) {
                result.add(new PendingNotification(NotificationType.BUDGET_EXCEEDED,
                        "Budget limit reached: " + label,
                        "You have spent " + used + " against your " + limit + " budget.", "budgets", key));
            } else {
                long percent = spent.multiply(BigDecimal.valueOf(100))
                        .divide(budget.getLimitAmount(), 0, RoundingMode.DOWN).longValue();
                result.add(new PendingNotification(NotificationType.BUDGET_WARNING,
                        "Budget almost used: " + label,
                        "You have used " + percent + "% of your " + limit + " budget (" + used + " spent).",
                        "budgets", key));
            }
        }
        return result;
    }

    /** The period a budget applies to right now, or null when it cannot be worked out. */
    public static LocalDate[] budgetWindow(Budget budget, LocalDate today) {
        String period = budget.getPeriod() == null ? "MONTHLY" : budget.getPeriod().toUpperCase(Locale.ROOT);
        if ("CUSTOM".equalsIgnoreCase(period)) {
            if (budget.getStartDate() == null || budget.getEndDate() == null
                    || today.isBefore(budget.getStartDate()) || today.isAfter(budget.getEndDate())) {
                return null;
            }
        }
        return com.example.expensetracker.domain.budget.model.BudgetPeriod
                .fromString(budget.getPeriod())
                .calculateWindow(budget, today);
    }
}
