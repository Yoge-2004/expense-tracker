package com.example.expensetracker.service;

import com.example.expensetracker.model.User;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Service contract defining data import operations across multiple formats (CSV, JSON, Microsoft Excel).
 * <p>
 * Handles parsing, field normalisation, dynamic column index resolution, validation,
 * on-the-fly category/entity creation, and structured per-row error tracking.
 * </p>
 *
 * @author Yogeshwaran
 */
public interface ImportService {

    /**
     * Imports expense records from an uploaded CSV file for the given user.
     * <p>
     * Headers are matched dynamically in case-insensitive fashion. Required columns: {@code date}, {@code category}, {@code amount}.
     * Optional column: {@code description}.
     * </p>
     *
     * @param file the uploaded CSV file
     * @param user the target authenticated user
     * @return a structured map containing {@code imported} count, {@code failedRows} count, {@code errors} list, and summary {@code message}
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
     * <p>
     * Headers are matched dynamically from the first sheet or "Expenses" sheet in case-insensitive fashion.
     * Required columns: {@code date}, {@code category}, {@code amount}. Optional column: {@code description}.
     * Supports both typed date/numeric cells and text formatted representations with row-level error resiliency.
     * </p>
     *
     * @param file the uploaded Excel file
     * @param user the target authenticated user
     * @return a structured map containing {@code imported} count, {@code failedRows} count, {@code errors} list, and summary {@code message}
     */
    Map<String, Object> importExpensesFromExcel(MultipartFile file, User user);

    /**
     * Imports income records from an uploaded CSV file for the given user.
     * <p>
     * Headers are matched dynamically in case-insensitive fashion. Required columns: {@code date}, {@code source}, {@code amount}.
     * Optional column: {@code description}.
     * </p>
     *
     * @param file the uploaded CSV file
     * @param user the target authenticated user
     * @return a structured map containing {@code imported} count, {@code failedRows} count, {@code errors} list, and summary {@code message}
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
     * <p>
     * Headers are matched dynamically from the first sheet or "Incomes" sheet in case-insensitive fashion.
     * Required columns: {@code date}, {@code source}, {@code amount}. Optional columns: {@code description}, {@code recurring}.
     * Supports both typed date/numeric cells and text formatted representations with row-level error resiliency.
     * </p>
     *
     * @param file the uploaded Excel file
     * @param user the target authenticated user
     * @return a structured map containing {@code imported} count, {@code failedRows} count, {@code errors} list, and summary {@code message}
     */
    Map<String, Object> importIncomesFromExcel(MultipartFile file, User user);
}
