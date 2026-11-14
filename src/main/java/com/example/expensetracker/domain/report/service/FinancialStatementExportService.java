package com.example.expensetracker.domain.report.service;

import com.example.expensetracker.domain.user.model.User;


/**
 * Segregated service contract dedicated exclusively to exporting comprehensive financial statements.
 *
 * <p>Enforces the Interface Segregation Principle (ISP) by isolating multi-sheet Excel
 * and executive summary PDF statement logic from single-domain transaction exports.</p>
 *
 * @author Yogeshwaran
 */
public interface FinancialStatementExportService {

    /**
     * Exports a comprehensive financial workbook in Microsoft Excel (.xlsx) format.
     *
     * @param user the authenticated user whose complete financial workbook is generated
     * @return the raw bytes of the generated multi-sheet Excel workbook
     */
    byte[] exportFinancialStatementExcel(User user);

    /**
     * Exports a comprehensive financial workbook in Microsoft Excel (.xlsx) format with preferred currency.
     *
     * @param user              the authenticated user whose complete financial workbook is generated
     * @param preferredCurrency optional ISO currency code (e.g. INR, USD, EUR, GBP)
     * @return the raw bytes of the generated multi-sheet Excel workbook
     */
    default byte[] exportFinancialStatementExcel(User user, String preferredCurrency) {
        return exportFinancialStatementExcel(user);
    }

    /**
     * Exports a comprehensive executive financial statement in PDF format.
     *
     * @param user the authenticated user whose financial report is generated
     * @return the raw bytes of the generated PDF document
     */
    byte[] exportFinancialStatementPdf(User user);

    /**
     * Exports a comprehensive executive financial statement in PDF format with preferred currency.
     *
     * @param user              the authenticated user whose financial report is generated
     * @param preferredCurrency optional ISO currency code
     * @return the raw bytes of the generated PDF document
     */
    default byte[] exportFinancialStatementPdf(User user, String preferredCurrency) {
        return exportFinancialStatementPdf(user);
    }
}
