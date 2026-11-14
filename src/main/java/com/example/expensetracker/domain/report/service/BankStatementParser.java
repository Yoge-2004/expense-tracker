package com.example.expensetracker.domain.report.service;

import java.util.List;


/**
 * Strategy interface for parsing banking institution statement formats.
 *
 * <p>Enforces the Open/Closed Principle (OCP) by allowing support for new financial institutions
 * (e.g. Citi, Wells Fargo, Barclays) to be introduced by adding new parser strategies
 * rather than modifying monolithic reconciliation classes.</p>
 *
 * @author Yogeshwaran
 */
public interface BankStatementParser {

    /**
     * The unique name or institution identifier for this parser (e.g. "HDFC", "SBI", "CHASE").
     *
     * @return institution name
     */
    String getInstitutionName();

    /**
     * Inspects the file name, mime type, or extracted header tokens to determine if this parser handles the file.
     *
     * @param filename     the uploaded file name
     * @param headerTokens tokens or strings found in header rows
     * @return true if this parser can process the statement
     */
    boolean canParse(String filename, List<String> headerTokens);

    /**
     * Parses the bank statement file into normalized {@link StatementRow} records.
     *
     * @param file uploaded statement file
     * @return list of parsed rows
     */
    List<StatementRow> parseStatement(org.springframework.web.multipart.MultipartFile file);
}
