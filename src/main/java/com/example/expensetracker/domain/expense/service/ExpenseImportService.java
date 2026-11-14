package com.example.expensetracker.domain.expense.service;

import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

import com.example.expensetracker.domain.user.model.User;



/**
 * Segregated service contract dedicated exclusively to importing expense records.
 *
 * <p>Enforces the Interface Segregation Principle (ISP) by allowing clients that only
 * import expenses to depend on a cohesive contract without income or statement reconciliation methods.</p>
 *
 * @author Yogeshwaran
 */
public interface ExpenseImportService {

    /**
     * Imports expense records from an uploaded CSV file for the given user.
     *
     * @param file the uploaded CSV file
     * @param user the target authenticated user
     * @return a structured map containing {@code imported} count, {@code failedRows} count,
     *         {@code errors} list, and summary {@code message}
     */
    Map<String, Object> importExpensesFromCsv(MultipartFile file, User user);

    /**
     * Imports expense records from an uploaded JSON file containing an array of expense objects.
     *
     * @param file the uploaded JSON file
     * @param user the target authenticated user
     * @return a structured map containing {@code imported} count and summary {@code message}
     */
    Map<String, Object> importExpensesFromJson(MultipartFile file, User user);

    /**
     * Imports expense records from an uploaded Microsoft Excel (.xlsx / .xls) workbook for the given user.
     *
     * @param file the uploaded Excel file
     * @param user the target authenticated user
     * @return a structured map containing {@code imported} count, {@code failedRows} count,
     *         {@code errors} list, and summary {@code message}
     */
    Map<String, Object> importExpensesFromExcel(MultipartFile file, User user);
}
