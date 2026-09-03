package com.example.expensetracker.service;

import com.example.expensetracker.model.User;

/**
 * Service contract defining file export operations across multiple formats (CSV, JSON, PDF, Excel).
 * <p>
 * Supports both domain-specific exports (Expenses, Incomes) and unified multi-sheet
 * or composite financial statements (combining Expenses, Incomes, Savings Goals, and Cash Flow metrics).
 * All exports support dynamic ISO-4217 multi-currency symbol and accounting format resolution.
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
     * Exports all expenses of the specified user to a printable PDF document with preferred currency.
     *
     * @param user the authenticated user whose expenses are exported
     * @param preferredCurrency optional ISO currency code or symbol
     * @return the raw bytes of the generated PDF document
     */
    default byte[] exportExpensesToPdf(User user, String preferredCurrency) {
        return exportExpensesToPdf(user);
    }

    /**
     * Exports all expenses of the specified user to a styled Microsoft Excel (.xlsx) workbook.
     *
     * @param user the authenticated user whose expenses are exported
     * @return the raw bytes of the generated Excel workbook
     */
    byte[] exportExpensesToExcel(User user);

    /**
     * Exports all expenses of the specified user to a styled Microsoft Excel (.xlsx) workbook with preferred currency.
     *
     * @param user the authenticated user whose expenses are exported
     * @param preferredCurrency optional ISO currency code or symbol
     * @return the raw bytes of the generated Excel workbook
     */
    default byte[] exportExpensesToExcel(User user, String preferredCurrency) {
        return exportExpensesToExcel(user);
    }

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
     * Exports all income entries of the specified user to a printable PDF document with preferred currency.
     *
     * @param user the authenticated user whose incomes are exported
     * @param preferredCurrency optional ISO currency code or symbol
     * @return the raw bytes of the generated PDF document
     */
    default byte[] exportIncomesToPdf(User user, String preferredCurrency) {
        return exportIncomesToPdf(user);
    }

    /**
     * Exports all income entries of the specified user to a styled Microsoft Excel (.xlsx) workbook.
     *
     * @param user the authenticated user whose incomes are exported
     * @return the raw bytes of the generated Excel workbook
     */
    byte[] exportIncomesToExcel(User user);

    /**
     * Exports all income entries of the specified user to a styled Microsoft Excel (.xlsx) workbook with preferred currency.
     *
     * @param user the authenticated user whose incomes are exported
     * @param preferredCurrency optional ISO currency code or symbol
     * @return the raw bytes of the generated Excel workbook
     */
    default byte[] exportIncomesToExcel(User user, String preferredCurrency) {
        return exportIncomesToExcel(user);
    }

    /**
     * Exports a comprehensive financial workbook in Microsoft Excel (.xlsx) format containing:
     * <ul>
     *   <li>PowerBI Executive Financial Intelligence Dashboard</li>
     *   <li>Incomes data ledger</li>
     *   <li>Expenses data ledger</li>
     *   <li>Savings Goals & Milestones ledger</li>
     * </ul>
     *
     * @param user the authenticated user whose complete financial workbook is generated
     * @return the raw bytes of the generated multi-sheet Excel workbook
     */
    byte[] exportFinancialStatementExcel(User user);

    /**
     * Exports a comprehensive financial workbook in Microsoft Excel (.xlsx) format with preferred currency.
     *
     * @param user the authenticated user whose complete financial workbook is generated
     * @param preferredCurrency optional ISO currency code (e.g. INR, USD, EUR, GBP)
     * @return the raw bytes of the generated multi-sheet Excel workbook
     */
    default byte[] exportFinancialStatementExcel(User user, String preferredCurrency) {
        return exportFinancialStatementExcel(user);
    }

    /**
     * Exports a comprehensive executive financial statement in PDF format summarizing cash flows,
     * income sources, expense breakdowns, and savings progress.
     *
     * @param user the authenticated user whose financial report is generated
     * @return the raw bytes of the generated PDF document
     */
    byte[] exportFinancialStatementPdf(User user);

    /**
     * Exports a comprehensive executive financial statement in PDF format with preferred currency.
     *
     * @param user the authenticated user whose financial report is generated
     * @param preferredCurrency optional ISO currency code
     * @return the raw bytes of the generated PDF document
     */
    default byte[] exportFinancialStatementPdf(User user, String preferredCurrency) {
        return exportFinancialStatementPdf(user);
    }
}
