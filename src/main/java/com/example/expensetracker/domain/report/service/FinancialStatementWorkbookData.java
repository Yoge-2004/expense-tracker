package com.example.expensetracker.domain.report.service;

import java.util.List;

import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.user.model.User;

/** Input snapshot shared by the ledger and dashboard renderers. */
public record FinancialStatementWorkbookData(
        User user,
        List<Expense> expenses,
        List<Income> incomes,
        List<SavingsGoal> savingsGoals,
        FinancialStatementAnalysis analysis
) {
    public FinancialStatementWorkbookData {
        expenses = List.copyOf(expenses);
        incomes = List.copyOf(incomes);
        savingsGoals = List.copyOf(savingsGoals);
    }
}
