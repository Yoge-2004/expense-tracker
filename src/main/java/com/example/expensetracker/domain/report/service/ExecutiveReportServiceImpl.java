package com.example.expensetracker.domain.report.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.model.RecurringExpense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
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

        List<Income> incomes;
        if (effectiveRange.from() != null && effectiveRange.to() != null) {
            incomes = incomeRepository.findByUserAndIncomeDateBetween(user, effectiveRange.from(), effectiveRange.to());
        } else if (effectiveRange.from() != null) {
            incomes = incomeRepository.findByUserAndIncomeDateGreaterThanEqual(user, effectiveRange.from());
        } else if (effectiveRange.to() != null) {
            incomes = incomeRepository.findByUserAndIncomeDateLessThanEqual(user, effectiveRange.to());
        } else {
            incomes = incomeRepository.findByUser(user);
        }

        List<SavingsGoal> goals = savingsGoalRepository.findByUser(user);
        List<RecurringExpense> recurring = recurringExpenseRepository.findByUser(user);
        List<Budget> budgets = budgetRepository.findByUser(user);

        return new ExecutiveReportData(expenses, incomes, goals, recurring, budgets);
    }
}
