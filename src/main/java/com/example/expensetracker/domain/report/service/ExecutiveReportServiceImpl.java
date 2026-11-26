package com.example.expensetracker.domain.report.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.model.RecurringExpense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.income.mapper.IncomeRules;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.User;

/**
 * Concrete implementation of {@link ExecutiveReportService}.
 * Encapsulates the multi-repository data retrieval and range filtering for executive reporting.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExecutiveReportServiceImpl implements ExecutiveReportService {

    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final RecurringExpenseRepository recurringExpenseRepository;
    private final BudgetRepository budgetRepository;

    @Override
    public ExecutiveReportData loadReportData(User user, ExecutiveReportDateRange range) {
        if (user == null) {
            throw new IllegalArgumentException("User cannot be null");
        }
        ExecutiveReportDateRange effectiveRange = (range != null) ? range : ExecutiveReportDateRange.of(null, null);

        List<Expense> expenses;
        if (effectiveRange.from() != null && effectiveRange.to() != null) {
            expenses = expenseRepository.findByUserAndExpenseDateBetween(user, effectiveRange.from(), effectiveRange.to());
        } else if (effectiveRange.from() != null) {
            expenses = expenseRepository.findByUserAndExpenseDateGreaterThanEqual(user, effectiveRange.from());
        } else if (effectiveRange.to() != null) {
            expenses = expenseRepository.findByUserAndExpenseDateLessThanEqual(user, effectiveRange.to());
        } else {
            expenses = expenseRepository.findByUser(user);
        }

        List<Income> incomes = loadIncomes(user, effectiveRange);

        List<SavingsGoal> goals = savingsGoalRepository.findByUser(user);
        List<RecurringExpense> recurring = recurringExpenseRepository.findByUser(user);
        List<Budget> budgets = budgetRepository.findByUser(user);

        return new ExecutiveReportData(expenses, incomes, goals, recurring, budgets);
    }

    /**
     * Incomes whose effective date falls inside the range.
     *
     * <p>A salary credited in one month can be assigned to another ({@code countsTowardMonth}), so selecting by the
     * credit date alone dropped an early-credited salary from the month it belongs to, and the range report disagreed
     * with the monthly report and the cash-flow summary. The query is widened by the largest allowed shift and the
     * rows are then placed by {@link IncomeRules#effectiveDate(Income)}.</p>
     */
    private List<Income> loadIncomes(User user, ExecutiveReportDateRange range) {
        LocalDate from = range.from();
        LocalDate to = range.to();
        if (from == null && to == null) {
            return incomeRepository.findByUser(user);
        }
        LocalDate queryFrom = from != null ? from.minusMonths(IncomeRules.MAX_MONTH_SHIFT) : null;
        LocalDate queryTo = to != null ? to.plusMonths(IncomeRules.MAX_MONTH_SHIFT) : null;

        List<Income> candidates;
        if (queryFrom != null && queryTo != null) {
            candidates = incomeRepository.findByUserAndIncomeDateBetween(user, queryFrom, queryTo);
        } else if (queryFrom != null) {
            candidates = incomeRepository.findByUserAndIncomeDateGreaterThanEqual(user, queryFrom);
        } else {
            candidates = incomeRepository.findByUserAndIncomeDateLessThanEqual(user, queryTo);
        }
        return candidates.stream()
                .filter(income -> {
                    LocalDate counted = IncomeRules.effectiveDate(income);
                    return counted != null
                            && (from == null || !counted.isBefore(from))
                            && (to == null || !counted.isAfter(to));
                })
                .toList();
    }
}
