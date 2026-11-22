package com.example.expensetracker.domain.expense.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;

import com.example.expensetracker.domain.expense.dto.ExpenseDto;
import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.report.service.ImportParsingSupport;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ImportException;

/**
 * Dedicated implementation of {@link ExpenseImportService} handling CSV, JSON, and Excel ingestion for expenses.
 * Adheres to the Single Responsibility Principle (SRP) by decoupling expense parsing and ingestion from
 * income and bank statement reconciliation logic.
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
        this.objectMapper = (objectMapper != null) ? objectMapper : new ObjectMapper().registerModule(new JavaTimeModule());
    }

    public ExpenseImportServiceImpl(ExpenseService expenseService, CategoryRepository categoryRepository) {
        this(expenseService, categoryRepository, null);
    }

    @Override
    @Transactional
    public Map<String, Object> importExpensesFromCsv(MultipartFile file, User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

        List<String> rowErrors = new ArrayList<>();
        Map<String, Category> categoryCache = new HashMap<>();
        List<Expense> expensesToSave = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                throw new IllegalArgumentException("CSV file is empty — no header row found");
            }

            Map<String, Integer> col = ImportParsingSupport.parseHeader(headerLine);
            if (!col.containsKey("date") || !col.containsKey("category") || !col.containsKey("amount")) {
                throw new IllegalArgumentException(
                        "CSV must contain at least 'date', 'category', and 'amount' headers. Found: " + col.keySet()
                );
            }

            int dateIdx = col.get("date");
            int catIdx  = col.get("category");
            int amtIdx  = col.get("amount");
            Integer descIdx = col.get("description");

            String line;
            int rowNum = 1;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                if (line.isBlank()) {
                    continue;
                }

                try {
                    List<String> parts = ImportParsingSupport.parseCsvLine(line);
                    int maxNeeded = Math.max(dateIdx, Math.max(catIdx, amtIdx));
                    if (parts.size() <= maxNeeded) {
                        rowErrors.add("Row " + rowNum + ": expected at least " + (maxNeeded + 1)
                                + " columns, found " + parts.size() + ".");
                        continue;
                    }

                    String dateStr = parts.get(dateIdx).replace("\"", "").trim();
                    String catStr  = parts.get(catIdx).replace("\"", "").trim();
                    String amtStr  = parts.get(amtIdx).replace("\"", "").trim().replaceAll("[^0-9.\\-]", "");
                    String desc    = (descIdx != null && descIdx < parts.size())
                            ? parts.get(descIdx).replace("\"", "").trim() : "";

                    if (dateStr.isEmpty() || catStr.isEmpty() || amtStr.isEmpty()) {
                        rowErrors.add("Row " + rowNum + ": date, category, or amount is empty.");
                        continue;
                    }

                    Category category = ImportParsingSupport.resolveOrCreateCategoryForUser(catStr, user, categoryRepository, categoryCache);

                    Expense exp = new Expense();
                    exp.setExpenseDate(LocalDate.parse(dateStr));
                    exp.setCategory(category);
                    exp.setAmount(new BigDecimal(amtStr));
                    exp.setDescription(desc.isEmpty() ? catStr : desc);
                    expensesToSave.add(exp);

                } catch (Exception rowEx) {
                    rowErrors.add("Row " + rowNum + ": " + rowEx.getMessage());
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to read expense CSV file for user {}", user.getId(), e);
            throw new ImportException("Failed to read CSV file: " + e.getMessage(), e);
        }

        if (!expensesToSave.isEmpty()) {
            expenseService.createExpenses(expensesToSave, user);
        }
        int count = expensesToSave.size();

        if (count == 0) {
            if (rowErrors.isEmpty()) {
                throw new IllegalArgumentException("CSV file contains no expense data rows to import");
            }
            throw new IllegalArgumentException("Failed to import expenses: all " + rowErrors.size()
                    + " rows failed (" + String.join("; ", rowErrors) + ")");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", count);
        result.put("failedRows", rowErrors.size());
        result.put("errors", rowErrors);
        result.put("message", "Imported " + count + " expense" + (count == 1 ? "" : "s") + " successfully."
                + (rowErrors.isEmpty() ? "" : " " + rowErrors.size() + " row(s) failed — see 'errors'."));
        return result;
    }

    @Override
    @Transactional
    public Map<String, Object> importExpensesFromJson(MultipartFile file, User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

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
                Category category = null;
                if (dto.categoryName() != null && !dto.categoryName().isBlank()) {
                    category = ImportParsingSupport.resolveOrCreateCategoryForUser(dto.categoryName().trim(), user, categoryRepository, categoryCache);
                }
                Expense expense = new Expense();
                BigDecimal amount = dto.amount();
                if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Amount must be greater than zero");
                }
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
            int count = expensesToSave.size();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("imported", count);
            result.put("message", "Imported " + count + " expenses successfully");
            return result;
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
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        List<String> errors = new ArrayList<>();
        Map<String, Category> categoryCache = new HashMap<>();
        List<Expense> expensesToSave = new ArrayList<>();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheet("Expenses");
            if (sheet == null) {
                sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            }
            if (sheet == null || sheet.getPhysicalNumberOfRows() == 0) {
                throw new IllegalArgumentException("The Excel sheet is empty");
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                throw new IllegalArgumentException("Missing header row in Excel sheet");
            }

            Map<String, Integer> colMap = new HashMap<>();
            for (Cell cell : headerRow) {
                String val = ImportParsingSupport.getCellValueAsString(cell).trim().toLowerCase(Locale.ROOT);
                if (!val.isBlank()) {
                    colMap.put(val, cell.getColumnIndex());
                }
            }

            Integer dateCol = ImportParsingSupport.findColumn(colMap, "date", "expensedate", "transactiondate");
            Integer catCol = ImportParsingSupport.findColumn(colMap, "category", "categoryname", "cat");
            Integer amtCol = ImportParsingSupport.findColumn(colMap, "amount", "cost", "price");
            Integer descCol = ImportParsingSupport.findColumn(colMap, "description", "desc", "note", "notes");

            if (dateCol == null || catCol == null || amtCol == null) {
                throw new IllegalArgumentException(
                        "Excel sheet must contain at least: Date, Category, and Amount headers. Found: "
                                + colMap.keySet()
                );
            }

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || ImportParsingSupport.isRowEmpty(row)) {
                    continue;
                }

                try {
                    Cell dateCell = row.getCell(dateCol);
                    LocalDate date = ImportParsingSupport.parseDateCell(dateCell);

                    String catName = ImportParsingSupport.getCellValueAsString(row.getCell(catCol)).trim();
                    if (catName.isBlank()) {
                        throw new IllegalArgumentException("Category cannot be blank");
                    }

                    BigDecimal amount = ImportParsingSupport.parseCellAmount(row.getCell(amtCol));
                    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new IllegalArgumentException("Amount must be greater than zero");
                    }

                    String description = descCol != null ? ImportParsingSupport.getCellValueAsString(row.getCell(descCol)).trim() : "";

                    Category category = ImportParsingSupport.resolveOrCreateCategoryForUser(catName, user, categoryRepository, categoryCache);

                    Expense expense = new Expense();
                    expense.setAmount(amount);
                    expense.setExpenseDate(date);
                    expense.setDescription(description.isBlank() ? catName : description);
                    expense.setCategory(category);
                    expense.setUser(user);

                    expensesToSave.add(expense);
                } catch (Exception ex) {
                    errors.add("Row " + (r + 1) + ": " + ex.getMessage());
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse Excel file for expenses", e);
            throw new ImportException("Failed to read Excel workbook: " + e.getMessage(), e);
        }

        if (!expensesToSave.isEmpty()) {
            expenseService.createExpenses(expensesToSave, user);
        }
        int count = expensesToSave.size();

        if (count == 0) {
            if (errors.isEmpty()) {
                throw new IllegalArgumentException("Excel sheet contains no expense data rows to import");
            }
            throw new IllegalArgumentException("Failed to import expenses: all " + errors.size()
                    + " rows failed (" + String.join("; ", errors) + ")");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", count);
        result.put("failedRows", errors.size());
        result.put("errors", errors);
        result.put("message", "Imported " + count + " expense" + (count == 1 ? "" : "s") + " successfully."
                + (errors.isEmpty() ? "" : " " + errors.size() + " row(s) failed — see 'errors'."));
        return result;
    }
}
