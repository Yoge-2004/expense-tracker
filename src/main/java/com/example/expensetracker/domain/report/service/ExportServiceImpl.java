package com.example.expensetracker.domain.report.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.service.ExpenseExportService;
import com.example.expensetracker.domain.expense.service.ExpenseExportServiceImpl;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.income.service.IncomeExportService;
import com.example.expensetracker.domain.income.service.IncomeExportServiceImpl;
import com.example.expensetracker.domain.user.model.User;

/** Compatibility facade for callers that still require the composite export contract. */
@Deprecated(forRemoval = false)
public class ExportServiceImpl implements ExportService {

    private final ExpenseExportService expenseExports;
    private final IncomeExportService incomeExports;
    private final FinancialStatementExportService statementExports;

    public ExportServiceImpl(ExpenseExportService expenseExports,
                             IncomeExportService incomeExports,
                             FinancialStatementExportService statementExports) {
        this.expenseExports = expenseExports;
        this.incomeExports = incomeExports;
        this.statementExports = statementExports;
    }

    /** Compatibility constructor for older direct-instantiation callers. */
    @Deprecated(forRemoval = false)
    public ExportServiceImpl(ExpenseRepository expenses,
                             IncomeRepository incomes,
                             SavingsGoalRepository savingsGoals,
                             BudgetRepository budgets) {
        this(legacyExpenseExports(expenses), legacyIncomeExports(incomes),
                new FinancialStatementExportServiceImpl(expenses, incomes, savingsGoals, budgets,
                        new FinancialStatementExcelGenerator(), new FinancialStatementPdfGenerator()));
    }

    /** Compatibility constructor retained for older callers without budget storage. */
    @Deprecated(forRemoval = false)
    public ExportServiceImpl(ExpenseRepository expenses,
                             IncomeRepository incomes,
                             SavingsGoalRepository savingsGoals) {
        this(expenses, incomes, savingsGoals, null);
    }

    private static ExpenseExportService legacyExpenseExports(ExpenseRepository expenses) {
        return new ExpenseExportServiceImpl(expenses, legacyObjectMapper(),
                new ExpensePdfReportGenerator(), new ExpenseExcelReportGenerator());
    }

    private static IncomeExportService legacyIncomeExports(IncomeRepository incomes) {
        return new IncomeExportServiceImpl(incomes, legacyObjectMapper(),
                new IncomePdfReportGenerator(), new IncomeExcelReportGenerator());
    }

    private static ObjectMapper legacyObjectMapper() {
        return new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @Override public byte[] exportExpensesToCsv(User user) { return expenseExports.exportExpensesToCsv(user); }
    @Override public byte[] exportExpensesToJson(User user) { return expenseExports.exportExpensesToJson(user); }
    @Override public byte[] exportExpensesToPdf(User user) { return expenseExports.exportExpensesToPdf(user); }
    @Override public byte[] exportExpensesToPdf(User user, String currency) {
        return expenseExports.exportExpensesToPdf(user, currency);
    }
    @Override public byte[] exportExpensesToExcel(User user) { return expenseExports.exportExpensesToExcel(user); }
    @Override public byte[] exportExpensesToExcel(User user, String currency) {
        return expenseExports.exportExpensesToExcel(user, currency);
    }
    @Override public byte[] exportIncomesToCsv(User user) { return incomeExports.exportIncomesToCsv(user); }
    @Override public byte[] exportIncomesToJson(User user) { return incomeExports.exportIncomesToJson(user); }
    @Override public byte[] exportIncomesToPdf(User user) { return incomeExports.exportIncomesToPdf(user); }
    @Override public byte[] exportIncomesToPdf(User user, String currency) {
        return incomeExports.exportIncomesToPdf(user, currency);
    }
    @Override public byte[] exportIncomesToExcel(User user) { return incomeExports.exportIncomesToExcel(user); }
    @Override public byte[] exportIncomesToExcel(User user, String currency) {
        return incomeExports.exportIncomesToExcel(user, currency);
    }
    @Override public byte[] exportFinancialStatementExcel(User user) {
        return statementExports.exportFinancialStatementExcel(user);
    }
    @Override public byte[] exportFinancialStatementExcel(User user, String currency) {
        return statementExports.exportFinancialStatementExcel(user, currency);
    }
    @Override public byte[] exportFinancialStatementPdf(User user) {
        return statementExports.exportFinancialStatementPdf(user);
    }
    @Override public byte[] exportFinancialStatementPdf(User user, String currency) {
        return statementExports.exportFinancialStatementPdf(user, currency);
    }
}
