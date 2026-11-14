package com.example.expensetracker.domain.report.service;

import com.example.expensetracker.domain.expense.service.ExpenseImportService;
import com.example.expensetracker.domain.income.service.IncomeImportService;

/**
 * Composite service contract defining data import operations across multiple formats (CSV, JSON, Microsoft Excel)
 * and comprehensive bank statement auto-reconciliation.
 * <p>
 * Aggregates segregated sub-contracts ({@link ExpenseImportService}, {@link IncomeImportService},
 * and {@link BankStatementReconciliationService}) to satisfy the Interface Segregation Principle (ISP)
 * while preserving 100% backward compatibility for all existing clients and mocks.
 * </p>
 *
 * @author Yogeshwaran
 */
public interface ImportService extends ExpenseImportService, IncomeImportService, BankStatementReconciliationService {
}
