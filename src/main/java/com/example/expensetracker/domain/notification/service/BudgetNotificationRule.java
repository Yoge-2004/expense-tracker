package com.example.expensetracker.domain.notification.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.income.mapper.IncomeRules;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.model.IncomeKind;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.notification.model.NotificationType;
import com.example.expensetracker.domain.user.model.User;

/**
 * Evaluates budget consumption thresholds and detects budget warning / exceeded alerts.
 *
 * @author Yogeshwaran
 */
@Component
public class BudgetNotificationRule implements NotificationRule {

    private final BudgetRepository budgetRepository;
    private final ExpenseRepository expenseRepository;
    /** Optional: without it reimbursements are not netted off (the previous behaviour). */
    private final IncomeRepository incomeRepository;

    /** Convenience for code that assembles the default rule set by hand; reimbursements are not netted off. */
    public BudgetNotificationRule(BudgetRepository budgetRepository, ExpenseRepository expenseRepository) {
        this(budgetRepository, expenseRepository, null);
    }

    @Autowired
    public BudgetNotificationRule(BudgetRepository budgetRepository, ExpenseRepository expenseRepository,
                                  IncomeRepository incomeRepository) {
        this.budgetRepository = budgetRepository;
        this.expenseRepository = expenseRepository;
        this.incomeRepository = incomeRepository;
    }

    @Override
    public List<PendingNotification> detect(User user, LocalDate today) {
        List<PendingNotification> result = new ArrayList<>();
        // Several budgets usually share the same window (every monthly budget), so each distinct window is read once.
        Map<List<LocalDate>, List<Expense>> expensesByWindow = new HashMap<>();
        Map<List<LocalDate>, List<Income>> incomesByWindow = new HashMap<>();
        for (Budget budget : budgetRepository.findByUser(user)) {
            LocalDate[] window = budgetWindow(budget, today);
            if (window == null) {
                continue;
            }
            List<LocalDate> windowKey = List.of(window[0], window[1]);
            List<Expense> inWindow = expensesByWindow.computeIfAbsent(windowKey,
                    k -> expenseRepository.findByUserAndExpenseDateBetween(user, window[0], window[1]));
            Long categoryId = budget.getCategory() != null ? budget.getCategory().getId() : null;
            BigDecimal gross = inWindow.stream()
                    .filter(e -> categoryId == null
                            || (e.getCategory() != null && categoryId.equals(e.getCategory().getId())))
                    .map(Expense::getAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            // Money someone paid back counts against the category it was spent on, exactly as the budget
            // status screen does, so the alert and the screen cannot disagree.
            BigDecimal reimbursed = reimbursedIn(user, window, windowKey, categoryId, incomesByWindow);
            BigDecimal spent = gross.subtract(reimbursed).max(BigDecimal.ZERO);

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

    private BigDecimal reimbursedIn(User user, LocalDate[] window, List<LocalDate> windowKey, Long categoryId,
                                    Map<List<LocalDate>, List<Income>> cache) {
        if (incomeRepository == null) {
            return BigDecimal.ZERO;
        }
        List<Income> incomes = cache.computeIfAbsent(windowKey, k -> incomeRepository.findByUserAndIncomeDateBetween(
                user,
                window[0].minusMonths(IncomeRules.MAX_MONTH_SHIFT),
                window[1].plusMonths(IncomeRules.MAX_MONTH_SHIFT)));
        return incomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) == IncomeKind.REIMBURSEMENT)
                .filter(i -> categoryId == null || categoryId.equals(i.getReimbursedCategoryId()))
                .filter(i -> {
                    LocalDate counted = IncomeRules.effectiveDate(i);
                    return counted != null && !counted.isBefore(window[0]) && !counted.isAfter(window[1]);
                })
                .map(Income::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
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
