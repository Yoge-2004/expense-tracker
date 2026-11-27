package com.example.expensetracker.domain.expense.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.example.expensetracker.common.importing.ImportParsingSupport;
import com.example.expensetracker.common.importing.TabularImportSupport;
import com.example.expensetracker.domain.expense.dto.ExpenseDto;
import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ImportException;

/**
 * Dedicated implementation of {@link ExpenseImportService} handling CSV, JSON, and Excel ingestion for expenses.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service("expenseImportService")
@Transactional(readOnly = true)
public class ExpenseImportServiceImpl implements ExpenseImportService {

    private final ExpenseService expenseService;
    private final CategoryRepository categoryRepository;
    private final ObjectMapper objectMapper;

    @Autowired
    public ExpenseImportServiceImpl(ExpenseService expenseService,
                                    CategoryRepository categoryRepository,
                                    @Autowired(required = false) ObjectMapper objectMapper) {
        this.expenseService = expenseService;
        this.categoryRepository = categoryRepository;
        this.objectMapper = (objectMapper != null)
                ? objectMapper
                : new ObjectMapper().registerModule(new JavaTimeModule());
    }

    public ExpenseImportServiceImpl(ExpenseService expenseService, CategoryRepository categoryRepository) {
        this(expenseService, categoryRepository, null);
    }

    @Override
    @Transactional
    public Map<String, Object> importExpensesFromCsv(MultipartFile file, User user) {
        TabularImportSupport.validateUpload(file, user);

        List<String> rowErrors = new ArrayList<>();
        Map<String, Category> categoryCache = new HashMap<>();
        List<Expense> expensesToSave = new ArrayList<>();
        int[] cols = new int[4]; // dateIdx, catIdx, amtIdx, descIdx (-1 when absent)

        try {
            TabularImportSupport.readCsvRows(file, col -> {
                if (!col.containsKey("date") || !col.containsKey("category") || !col.containsKey("amount")) {
                    throw new IllegalArgumentException(
                            "CSV must contain at least 'date', 'category', and 'amount' headers. Found: " + col.keySet());
                }
                cols[0] = col.get("date");
                cols[1] = col.get("category");
                cols[2] = col.get("amount");
                cols[3] = col.getOrDefault("description", -1);
            }, (rowNum, parts) -> {
                int maxNeeded = Math.max(cols[0], Math.max(cols[1], cols[2]));
                if (parts.size() <= maxNeeded) {
                    rowErrors.add("Row " + rowNum + ": expected at least " + (maxNeeded + 1)
                            + " columns, found " + parts.size() + ".");
                    return;
                }
                String dateStr = TabularImportSupport.cleanCsvToken(parts, cols[0]);
                String catStr = TabularImportSupport.cleanCsvToken(parts, cols[1]);
                String amtStr = TabularImportSupport.cleanCsvToken(parts, cols[2]).replaceAll("[^0-9.\\-]", "");
                String desc = cols[3] >= 0 ? TabularImportSupport.cleanCsvToken(parts, cols[3]) : "";

                if (dateStr.isEmpty() || catStr.isEmpty() || amtStr.isEmpty()) {
                    rowErrors.add("Row " + rowNum + ": date, category, or amount is empty.");
                    return;
                }

                Category category = CategoryResolutionSupport.resolveOrCreateCategoryForUser(
                        catStr, user, categoryRepository, categoryCache);
                Expense exp = new Expense();
                exp.setExpenseDate(ImportParsingSupport.parseDateString(dateStr));
                exp.setCategory(category);
                exp.setAmount(new BigDecimal(amtStr));
                exp.setDescription(desc.isEmpty() ? catStr : desc);
                expensesToSave.add(exp);
            }, rowErrors);
        } catch (Exception e) {
            if (e instanceof IllegalArgumentException iae) {
                throw iae;
            }
            log.error("Failed to read expense CSV file for user {}", user.getId(), e);
            throw new ImportException("Failed to read CSV file: " + e.getMessage(), e);
        }

        if (!expensesToSave.isEmpty()) {
            expenseService.createExpenses(expensesToSave, user);
        }
        return TabularImportSupport.finalizeTabularResult(
                expensesToSave.size(), rowErrors,
                "CSV file contains no expense data rows to import",
                "Failed to import expenses:",
                "expense", "expenses");
    }

    @Override
    @Transactional
    public Map<String, Object> importExpensesFromJson(MultipartFile file, User user) {
        TabularImportSupport.validateUpload(file, user);

        try {
            List<ExpenseDto> dtos = objectMapper.readValue(file.getInputStream(), new TypeReference<>() {});
            if (dtos == null || dtos.isEmpty()) {
                throw new IllegalArgumentException("JSON file contains no expenses to import");
            }
            Map<String, Category> categoryCache = new HashMap<>();
            List<Expense> expensesToSave = new ArrayList<>(dtos.size());

            for (ExpenseDto dto : dtos) {
                if (dto == null) {
                    throw new IllegalArgumentException("Expense record in JSON cannot be null");
                }
                BigDecimal amount = dto.amount();
                if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Amount must be greater than zero");
                }
                Category category = null;
                if (dto.categoryName() != null && !dto.categoryName().isBlank()) {
                    category = CategoryResolutionSupport.resolveOrCreateCategoryForUser(
                            dto.categoryName().trim(), user, categoryRepository, categoryCache);
                }
                Expense expense = new Expense();
                expense.setAmount(amount);
                expense.setExpenseDate(dto.expenseDate() != null ? dto.expenseDate() : LocalDate.now());
                String desc = dto.description();
                if (desc == null || desc.isBlank()) {
                    desc = dto.categoryName() != null ? dto.categoryName() : "Expense";
                }
                expense.setDescription(desc);
                expense.setCategory(category);
                expense.setUser(user);
                expensesToSave.add(expense);
            }

            expenseService.createExpenses(expensesToSave, user);
            return TabularImportSupport.jsonResult(expensesToSave.size(), "expenses");
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (JsonProcessingException e) {
            log.warn("Malformed JSON file during expense import for user {}: {}", user.getId(), e.getMessage());
            throw new IllegalArgumentException("Malformed JSON file: " + e.getOriginalMessage(), e);
        } catch (Exception e) {
            log.error("Failed to import expenses from JSON for user {}", user.getId(), e);
            throw new ImportException("Error importing expenses from JSON: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public Map<String, Object> importExpensesFromExcel(MultipartFile file, User user) {
        TabularImportSupport.validateUpload(file, user);

        List<String> errors = new ArrayList<>();
        Map<String, Category> categoryCache = new HashMap<>();
        List<Expense> expensesToSave = new ArrayList<>();
        Integer[] cols = new Integer[4]; // dateCol, catCol, amtCol, descCol

        try {
            TabularImportSupport.readExcelRows(file, "Expenses", colMap -> {
                cols[0] = ImportParsingSupport.findColumn(colMap, "date", "expensedate", "transactiondate");
                cols[1] = ImportParsingSupport.findColumn(colMap, "category", "categoryname", "cat");
                cols[2] = ImportParsingSupport.findColumn(colMap, "amount", "cost", "price");
                cols[3] = ImportParsingSupport.findColumn(colMap, "description", "desc", "note", "notes");
                if (cols[0] == null || cols[1] == null || cols[2] == null) {
                    throw new IllegalArgumentException(
                            "Excel sheet must contain at least: Date, Category, and Amount headers. Found: "
                                    + colMap.keySet());
                }
            }, (rowNum, row) -> {
                LocalDate date = ImportParsingSupport.parseDateCell(row.getCell(cols[0]));
                String catName = ImportParsingSupport.getCellValueAsString(row.getCell(cols[1])).trim();
                if (catName.isBlank()) {
                    throw new IllegalArgumentException("Category cannot be blank");
                }
                BigDecimal amount = ImportParsingSupport.parseCellAmount(row.getCell(cols[2]));
                if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Amount must be greater than zero");
                }
                String description = cols[3] != null
                        ? ImportParsingSupport.getCellValueAsString(row.getCell(cols[3])).trim()
                        : "";

                Category category = CategoryResolutionSupport.resolveOrCreateCategoryForUser(
                        catName, user, categoryRepository, categoryCache);
                Expense expense = new Expense();
                expense.setAmount(amount);
                expense.setExpenseDate(date);
                expense.setDescription(description.isBlank() ? catName : description);
                expense.setCategory(category);
                expense.setUser(user);
                expensesToSave.add(expense);
            }, errors);
        } catch (Exception e) {
            if (e instanceof IllegalArgumentException iae) {
                throw iae;
            }
            log.error("Failed to parse Excel file for expenses", e);
            throw new ImportException("Failed to read Excel workbook: " + e.getMessage(), e);
        }

        if (!expensesToSave.isEmpty()) {
            expenseService.createExpenses(expensesToSave, user);
        }
        return TabularImportSupport.finalizeTabularResult(
                expensesToSave.size(), errors,
                "Excel sheet contains no expense data rows to import",
                "Failed to import expenses:",
                "expense", "expenses");
    }
}
