package com.example.expensetracker.service;

import com.example.expensetracker.model.User;

/**
 * Service contract defining file export operations across multiple formats (CSV, JSON, PDF, Excel).
 * <p>
 * Supports both domain-specific exports (Expenses, Incomes) and unified multi-sheet
 * or composite financial statements (combining Expenses, Incomes, Savings Goals, and Cash Flow metrics).
 * </p>
 */
public interface ExportService {

    /**
     * Exports all expenses of the specified user to a CSV file.
     *
     * @param user the authenticated user whose expenses are exported
     * @return the raw bytes of the generated CSV file
     */
    byte[] exportExpensesToCsv(User user);

    /**
     * Exports all expenses of the specified user to a pretty-printed JSON file.
     *
     * @param user the authenticated user whose expenses are exported
     * @return the raw bytes of the generated JSON file
     */
    byte[] exportExpensesToJson(User user);

    /**
     * Exports all expenses of the specified user to a printable PDF document.
     *
     * @param user the authenticated user whose expenses are exported
     * @return the raw bytes of the generated PDF document
     */
    byte[] exportExpensesToPdf(User user);

    /**
     * Exports all expenses of the specified user to a styled Microsoft Excel (.xlsx) workbook.
     *
     * @param user the authenticated user whose expenses are exported
     * @return the raw bytes of the generated Excel workbook
     */
    byte[] exportExpensesToExcel(User user);

    /**
     * Exports all income entries of the specified user to a CSV file.
     *
     * @param user the authenticated user whose incomes are exported
     * @return the raw bytes of the generated CSV file
     */
    byte[] exportIncomesToCsv(User user);

    /**
     * Exports all income entries of the specified user to a pretty-printed JSON file.
     *
     * @param user the authenticated user whose incomes are exported
     * @return the raw bytes of the generated JSON file
     */
    byte[] exportIncomesToJson(User user);

    /**
     * Exports all income entries of the specified user to a printable PDF document.
     *
     * @param user the authenticated user whose incomes are exported
     * @return the raw bytes of the generated PDF document
     */
    byte[] exportIncomesToPdf(User user);

    /**
     * Exports all income entries of the specified user to a styled Microsoft Excel (.xlsx) workbook.
     *
     * @param user the authenticated user whose incomes are exported
     * @return the raw bytes of the generated Excel workbook
     */
    byte[] exportIncomesToExcel(User user);

    /**
     * Exports a comprehensive financial workbook in Microsoft Excel (.xlsx) format containing:
     * <ul>
     *   <li>Overview / Cash Flow KPI sheet</li>
     *   <li>Expenses sheet</li>
     *   <li>Incomes sheet</li>
     *   <li>Savings Goals & Milestones sheet</li>
     * </ul>
     *
     * @param user the authenticated user whose complete financial workbook is generated
     * @return the raw bytes of the generated multi-sheet Excel workbook
     */
    byte[] exportFinancialStatementExcel(User user);

    /**
     * Exports a comprehensive executive financial statement in PDF format summarizing cash flows,
     * income sources, expense breakdowns, and savings progress.
     *
     * @param user the authenticated user whose financial report is generated
     * @return the raw bytes of the generated PDF document
     */
    byte[] exportFinancialStatementPdf(User user);
}
