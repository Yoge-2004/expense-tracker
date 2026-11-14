package com.example.expensetracker.domain.report.service;

import com.example.expensetracker.domain.expense.service.ExpenseExportService;
import com.example.expensetracker.domain.income.service.IncomeExportService;

/**
 * Composite service contract defining file export operations across multiple formats (CSV, JSON, PDF, Excel).
 * <p>
 * Aggregates segregated sub-contracts ({@link ExpenseExportService}, {@link IncomeExportService},
 * and {@link FinancialStatementExportService}) to satisfy the Interface Segregation Principle (ISP)
 * while preserving 100% backward compatibility for all existing clients and mocks.
 * </p>
 *
 * @author Yogeshwaran
 */
public interface ExportService extends ExpenseExportService, IncomeExportService, FinancialStatementExportService {
}
