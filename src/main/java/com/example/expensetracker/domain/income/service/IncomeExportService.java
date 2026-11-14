package com.example.expensetracker.domain.income.service;

import com.example.expensetracker.domain.user.model.User;


/**
 * Segregated service contract dedicated exclusively to exporting income transactions.
 *
 * <p>Enforces the Interface Segregation Principle (ISP) by allowing clients that only
 * export incomes to depend on a cohesive contract without expense or statement methods.</p>
 *
 * @author Yogeshwaran
 */
public interface IncomeExportService {

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
}
