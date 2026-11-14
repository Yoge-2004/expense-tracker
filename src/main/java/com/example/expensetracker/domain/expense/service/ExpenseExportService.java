package com.example.expensetracker.domain.expense.service;

import com.example.expensetracker.domain.user.model.User;


/**
 * Segregated service contract dedicated exclusively to exporting expense transactions.
 *
 * <p>Enforces the Interface Segregation Principle (ISP) by allowing clients that only
 * export expenses to depend on a cohesive contract without income or executive report methods.</p>
 *
 * @author Yogeshwaran
 */
public interface ExpenseExportService {

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
}
