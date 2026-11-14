package com.example.expensetracker.domain.income.service;

import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

import com.example.expensetracker.domain.user.model.User;



/**
 * Segregated service contract dedicated exclusively to importing income records.
 *
 * <p>Enforces the Interface Segregation Principle (ISP) by allowing clients that only
 * import incomes to depend on a cohesive contract without expense or statement reconciliation methods.</p>
 *
 * @author Yogeshwaran
 */
public interface IncomeImportService {

    /**
     * Imports income records from an uploaded CSV file for the given user.
     *
     * @param file the uploaded CSV file
     * @param user the target authenticated user
     * @return a structured map containing {@code imported} count, {@code failedRows} count,
     *         {@code errors} list, and summary {@code message}
     */
    Map<String, Object> importIncomesFromCsv(MultipartFile file, User user);

    /**
     * Imports income records from an uploaded JSON file containing an array of income objects.
     *
     * @param file the uploaded JSON file
     * @param user the target authenticated user
     * @return a structured map containing {@code imported} count and summary {@code message}
     */
    Map<String, Object> importIncomesFromJson(MultipartFile file, User user);

    /**
     * Imports income records from an uploaded Microsoft Excel (.xlsx / .xls) workbook for the given user.
     *
     * @param file the uploaded Excel file
     * @param user the target authenticated user
     * @return a structured map containing {@code imported} count, {@code failedRows} count,
     *         {@code errors} list, and summary {@code message}
     */
    Map<String, Object> importIncomesFromExcel(MultipartFile file, User user);
}
