package com.example.expensetracker.domain.report.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.User;

/** Loads cross-domain ledger data and delegates complete statements to renderers. */
@Service
@Transactional(readOnly = true)
public class FinancialStatementExportServiceImpl implements FinancialStatementExportService {

    private final ExpenseRepository expenses;
    private final IncomeRepository incomes;
    private final SavingsGoalRepository savingsGoals;
    private final BudgetRepository budgets;
    private final FinancialStatementExcelGenerator excelGenerator;
    private final FinancialStatementPdfGenerator pdfGenerator;

    public FinancialStatementExportServiceImpl(ExpenseRepository expenses,
                                               IncomeRepository incomes,
                                               SavingsGoalRepository savingsGoals,
                                               BudgetRepository budgets,
                                               FinancialStatementExcelGenerator excelGenerator,
                                               FinancialStatementPdfGenerator pdfGenerator) {
        this.expenses = expenses;
        this.incomes = incomes;
        this.savingsGoals = savingsGoals;
        this.budgets = budgets;
        this.excelGenerator = excelGenerator;
        this.pdfGenerator = pdfGenerator;
    }

    @Override
    public byte[] exportFinancialStatementExcel(User user) {
        return exportFinancialStatementExcel(user, null);
    }

    @Override
    public byte[] exportFinancialStatementExcel(User user, String preferredCurrency) {
        User validUser = requireUser(user);
        return excelGenerator.generate(validUser, preferredCurrency,
                expenses.findByUser(validUser), incomes.findByUser(validUser),
                savingsGoals.findByUser(validUser), budgetRows(validUser));
    }

    @Override
    public byte[] exportFinancialStatementPdf(User user) {
        return exportFinancialStatementPdf(user, null);
    }

    @Override
    public byte[] exportFinancialStatementPdf(User user, String preferredCurrency) {
        User validUser = requireUser(user);
        List<Expense> expenseRows = expenses.findByUser(validUser);
        List<Income> incomeRows = incomes.findByUser(validUser);
        List<SavingsGoal> goalRows = savingsGoals.findByUser(validUser);
        return pdfGenerator.generate(validUser, preferredCurrency, expenseRows, incomeRows, goalRows);
    }

    private List<Budget> budgetRows(User user) {
        return budgets == null ? List.of() : budgets.findByUser(user);
    }

    private User requireUser(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return user;
    }
}
