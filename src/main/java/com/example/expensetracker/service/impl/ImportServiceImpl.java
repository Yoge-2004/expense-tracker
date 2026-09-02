package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.ImportService;
import com.example.expensetracker.service.IncomeService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.poi.ss.usermodel.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;

/**
 * Production implementation of {@link ImportService} responsible for reading,
 * parsing, validating, and bulk-importing financial data from CSV, JSON, and Microsoft Excel files.
 *
 * <p>Key characteristics:
 * <ul>
 *   <li><b>Dynamic column ordering:</b> Columns are identified by header name (case-insensitive) rather than fixed column index across CSV and Excel formats.</li>
 *   <li><b>Fault-tolerant partial imports:</b> Individual row failures are captured and reported, allowing valid rows to persist without aborting the entire dataset.</li>
 *   <li><b>Dynamic Category resolution:</b> Creates missing personal categories on-the-fly for the user when importing expenses.</li>
 *   <li><b>Multi-format Excel support:</b> Seamlessly parses both legacy {@code .xls} and modern {@code .xlsx} workbooks.</li>
 * </ul>
 * </p>
 *
 * @author Yogeshwaran
 */
@Service
public class ImportServiceImpl implements ImportService {

    private static final Logger logger = LoggerFactory.getLogger(ImportServiceImpl.class);

    private final ExpenseService expenseService;
    private final IncomeService incomeService;
    private final CategoryRepository categoryRepository;
    private final ObjectMapper objectMapper;

    /**
     * Constructs a new {@code ImportServiceImpl} with necessary services and repositories.
     *
     * @param expenseService the expense management service
     * @param incomeService the income management service
     * @param categoryRepository repository for querying and saving expense categories
     */
    public ImportServiceImpl(ExpenseService expenseService,
                             IncomeService incomeService,
                             CategoryRepository categoryRepository) {
        this.expenseService = expenseService;
        this.incomeService = incomeService;
        this.categoryRepository = categoryRepository;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPENSE IMPORTS
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Map<String, Object> importExpensesFromCsv(MultipartFile file, User user) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

        List<String> rowErrors = new ArrayList<>();
        int count = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                throw new IllegalArgumentException("CSV file is empty — no header row found");
            }

            Map<String, Integer> col = parseHeader(headerLine);
            if (!col.containsKey("date") || !col.containsKey("category") || !col.containsKey("amount")) {
                throw new IllegalArgumentException(
                        "CSV must contain at least 'date', 'category', and 'amount' headers. "
                        + "Found: " + col.keySet()
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
                if (line.trim().isEmpty()) continue;

                try {
                    String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", -1);
                    int maxNeeded = Math.max(dateIdx, Math.max(catIdx, amtIdx));
                    if (parts.length <= maxNeeded) {
                        rowErrors.add("Row " + rowNum + ": expected at least " + (maxNeeded + 1) + " columns, found " + parts.length + ".");
                        continue;
                    }

                    String dateStr = parts[dateIdx].replace("\"", "").trim();
                    String catStr  = parts[catIdx].replace("\"", "").trim();
                    String amtStr  = parts[amtIdx].replace("\"", "").trim().replaceAll("[^0-9.\\-]", "");
                    String desc    = (descIdx != null && descIdx < parts.length) ? parts[descIdx].replace("\"", "").trim() : "";

                    if (dateStr.isEmpty() || catStr.isEmpty() || amtStr.isEmpty()) {
                        rowErrors.add("Row " + rowNum + ": date, category, or amount is empty.");
                        continue;
                    }

                    final String resolvedCat = catStr;
                    Category category = categoryRepository.findByNameIgnoreCase(resolvedCat)
                            .orElseGet(() -> {
                                Category newCat = new Category();
                                newCat.setName(resolvedCat);
                                newCat.setUser(user);
                                return categoryRepository.save(newCat);
                            });

                    Expense exp = new Expense();
                    exp.setExpenseDate(LocalDate.parse(dateStr));
                    exp.setCategory(category);
                    exp.setAmount(new BigDecimal(amtStr));
                    exp.setDescription(desc.isEmpty() ? catStr : desc);
                    expenseService.createExpense(exp, user);
                    count++;

                } catch (Exception rowEx) {
                    rowErrors.add("Row " + rowNum + ": " + rowEx.getMessage());
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Failed to read expense CSV file for user {}", user.getId(), e);
            throw new RuntimeException("Failed to read CSV file: " + e.getMessage(), e);
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
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

        try {
            List<ExpenseDto> dtos = objectMapper.readValue(file.getInputStream(), new TypeReference<List<ExpenseDto>>() {});
            int count = 0;
            for (ExpenseDto dto : dtos) {
                Category category = null;
                if (dto.getCategoryName() != null && !dto.getCategoryName().isBlank()) {
                    category = categoryRepository.findByNameIgnoreCase(dto.getCategoryName().trim())
                            .orElseGet(() -> {
                                Category c = new Category();
                                c.setName(dto.getCategoryName().trim());
                                c.setUser(user);
                                return categoryRepository.save(c);
                            });
                }
                Expense expense = new Expense();
                expense.setAmount(dto.getAmount() != null ? dto.getAmount() : BigDecimal.ZERO);
                expense.setDescription(dto.getDescription());
                expense.setExpenseDate(dto.getExpenseDate() != null ? dto.getExpenseDate() : LocalDate.now());
                expense.setCategory(category);

                expenseService.createExpense(expense, user);
                count++;
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("imported", count);
            result.put("message", "Imported " + count + " expenses successfully");
            return result;
        } catch (Exception e) {
            logger.error("Failed to import expenses from JSON for user {}", user.getId(), e);
            throw new RuntimeException("Error importing expenses from JSON: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public Map<String, Object> importExpensesFromExcel(MultipartFile file, User user) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        int count = 0;
        List<String> errors = new ArrayList<>();

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
                String val = getCellValueAsString(cell).trim().toLowerCase(Locale.ROOT);
                if (!val.isBlank()) {
                    colMap.put(val, cell.getColumnIndex());
                }
            }

            Integer dateCol = findColumn(colMap, "date", "expensedate", "transactiondate");
            Integer catCol = findColumn(colMap, "category", "categoryname", "cat");
            Integer amtCol = findColumn(colMap, "amount", "cost", "price");
            Integer descCol = findColumn(colMap, "description", "desc", "note", "notes");

            if (dateCol == null || catCol == null || amtCol == null) {
                throw new IllegalArgumentException(
                        "Excel sheet must contain at least: Date, Category, and Amount headers. Found: " + colMap.keySet()
                );
            }

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                try {
                    Cell dateCell = row.getCell(dateCol);
                    String dateStr = getCellValueAsString(dateCell);
                    LocalDate date = parseCellDate(dateCell, dateStr);

                    String catName = getCellValueAsString(row.getCell(catCol)).trim();
                    if (catName.isBlank()) {
                        throw new IllegalArgumentException("Category cannot be blank");
                    }

                    BigDecimal amount = parseCellAmount(row.getCell(amtCol));
                    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new IllegalArgumentException("Amount must be greater than zero");
                    }

                    String description = descCol != null ? getCellValueAsString(row.getCell(descCol)).trim() : "";

                    Category category = categoryRepository.findByNameIgnoreCase(catName)
                            .orElseGet(() -> {
                                Category newCat = new Category();
                                newCat.setName(catName);
                                newCat.setUser(user);
                                return categoryRepository.save(newCat);
                            });

                    Expense expense = new Expense();
                    expense.setAmount(amount);
                    expense.setExpenseDate(date);
                    expense.setDescription(description.isBlank() ? catName : description);
                    expense.setCategory(category);
                    expense.setUser(user);

                    expenseService.createExpense(expense, user);
                    count++;
                } catch (Exception ex) {
                    errors.add("Row " + (r + 1) + ": " + ex.getMessage());
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Failed to parse Excel file for expenses", e);
            throw new RuntimeException("Failed to read Excel workbook: " + e.getMessage(), e);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", count);
        result.put("failedRows", errors.size());
        result.put("errors", errors);
        result.put("message", "Imported " + count + " expense" + (count == 1 ? "" : "s") + " successfully."
                + (errors.isEmpty() ? "" : " " + errors.size() + " row(s) failed — see 'errors'."));
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INCOME IMPORTS
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Map<String, Object> importIncomesFromCsv(MultipartFile file, User user) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

        List<String> rowErrors = new ArrayList<>();
        int count = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                throw new IllegalArgumentException("CSV file is empty — no header row found");
            }

            Map<String, Integer> col = parseHeader(headerLine);
            if (!col.containsKey("date") || !col.containsKey("source") || !col.containsKey("amount")) {
                throw new IllegalArgumentException(
                        "CSV must contain at least 'date', 'source', and 'amount' headers. "
                        + "Found: " + col.keySet()
                );
            }

            int dateIdx = col.get("date");
            int srcIdx  = col.get("source");
            int amtIdx  = col.get("amount");
            Integer descIdx = col.get("description");

            String line;
            int rowNum = 1;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                if (line.trim().isEmpty()) continue;

                try {
                    String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", -1);
                    int maxNeeded = Math.max(dateIdx, Math.max(srcIdx, amtIdx));
                    if (parts.length <= maxNeeded) {
                        rowErrors.add("Row " + rowNum + ": expected at least " + (maxNeeded + 1) + " columns, found " + parts.length + ".");
                        continue;
                    }

                    String dateStr = parts[dateIdx].replace("\"", "").trim();
                    String sourceStr = parts[srcIdx].replace("\"", "").trim();
                    String amtStr = parts[amtIdx].replace("\"", "").trim().replaceAll("[^0-9.\\-]", "");
                    String desc = (descIdx != null && descIdx < parts.length) ? parts[descIdx].replace("\"", "").trim() : "";

                    if (dateStr.isEmpty() || sourceStr.isEmpty() || amtStr.isEmpty()) {
                        rowErrors.add("Row " + rowNum + ": date, source, or amount is empty.");
                        continue;
                    }

                    IncomeRequest req = new IncomeRequest(
                            new BigDecimal(amtStr),
                            sourceStr,
                            desc.isEmpty() ? sourceStr : desc,
                            LocalDate.parse(dateStr),
                            false
                    );
                    incomeService.createIncome(req, user);
                    count++;

                } catch (Exception rowEx) {
                    rowErrors.add("Row " + rowNum + ": " + rowEx.getMessage());
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Failed to read income CSV file for user {}", user.getId(), e);
            throw new RuntimeException("Failed to read CSV file: " + e.getMessage(), e);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", count);
        result.put("failedRows", rowErrors.size());
        result.put("errors", rowErrors);
        result.put("message", "Imported " + count + " income record" + (count == 1 ? "" : "s") + " successfully."
                + (rowErrors.isEmpty() ? "" : " " + rowErrors.size() + " row(s) failed — see 'errors'."));
        return result;
    }

    @Override
    @Transactional
    public Map<String, Object> importIncomesFromJson(MultipartFile file, User user) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

        try {
            List<IncomeDto> dtos = objectMapper.readValue(file.getInputStream(), new TypeReference<List<IncomeDto>>() {});
            int count = 0;
            for (IncomeDto dto : dtos) {
                IncomeRequest req = new IncomeRequest(
                        dto.getAmount() != null ? dto.getAmount() : BigDecimal.ZERO,
                        dto.getSource() != null ? dto.getSource() : "General",
                        dto.getDescription(),
                        dto.getIncomeDate() != null ? dto.getIncomeDate() : LocalDate.now(),
                        dto.getIsRecurring() != null ? dto.getIsRecurring() : false
                );
                incomeService.createIncome(req, user);
                count++;
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("imported", count);
            result.put("message", "Imported " + count + " income records successfully");
            return result;
        } catch (Exception e) {
            logger.error("Failed to import incomes from JSON for user {}", user.getId(), e);
            throw new RuntimeException("Error importing incomes from JSON: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public Map<String, Object> importIncomesFromExcel(MultipartFile file, User user) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        int count = 0;
        List<String> errors = new ArrayList<>();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheet("Incomes");
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
                String val = getCellValueAsString(cell).trim().toLowerCase(Locale.ROOT);
                if (!val.isBlank()) {
                    colMap.put(val, cell.getColumnIndex());
                }
            }

            Integer dateCol = findColumn(colMap, "date", "incomedate", "transactiondate");
            Integer srcCol = findColumn(colMap, "source", "incomesource", "channel", "payer");
            Integer amtCol = findColumn(colMap, "amount", "income", "earnings", "sum");
            Integer descCol = findColumn(colMap, "description", "desc", "note", "notes");
            Integer recCol = findColumn(colMap, "recurring", "isrecurring");

            if (dateCol == null || srcCol == null || amtCol == null) {
                throw new IllegalArgumentException(
                        "Excel sheet must contain at least: Date, Source, and Amount headers. Found: " + colMap.keySet()
                );
            }

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                try {
                    Cell dateCell = row.getCell(dateCol);
                    String dateStr = getCellValueAsString(dateCell);
                    LocalDate date = parseCellDate(dateCell, dateStr);

                    String sourceStr = getCellValueAsString(row.getCell(srcCol)).trim();
                    if (sourceStr.isBlank()) {
                        throw new IllegalArgumentException("Source cannot be blank");
                    }

                    BigDecimal amount = parseCellAmount(row.getCell(amtCol));
                    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new IllegalArgumentException("Amount must be greater than zero");
                    }

                    String description = descCol != null ? getCellValueAsString(row.getCell(descCol)).trim() : "";
                    boolean isRecurring = false;
                    if (recCol != null) {
                        String recVal = getCellValueAsString(row.getCell(recCol)).trim().toLowerCase(Locale.ROOT);
                        isRecurring = recVal.equals("true") || recVal.equals("yes") || recVal.equals("1");
                    }

                    IncomeRequest req = new IncomeRequest(
                            amount,
                            sourceStr,
                            description.isBlank() ? sourceStr : description,
                            date,
                            isRecurring
                    );
                    incomeService.createIncome(req, user);
                    count++;
                } catch (Exception ex) {
                    errors.add("Row " + (r + 1) + ": " + ex.getMessage());
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Failed to parse Excel file for incomes", e);
            throw new RuntimeException("Failed to read Excel workbook: " + e.getMessage(), e);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", count);
        result.put("failedRows", errors.size());
        result.put("errors", errors);
        result.put("message", "Imported " + count + " income record" + (count == 1 ? "" : "s") + " successfully."
                + (errors.isEmpty() ? "" : " " + errors.size() + " row(s) failed — see 'errors'."));
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PARSING HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private Map<String, Integer> parseHeader(String headerLine) {
        Map<String, Integer> col = new HashMap<>();
        String[] headers = headerLine.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
        for (int i = 0; i < headers.length; i++) {
            String name = headers[i].trim().replaceAll("^\"|\"$", "").toLowerCase(Locale.ROOT);
            col.put(name, i);
        }
        return col;
    }

    private Integer findColumn(Map<String, Integer> colMap, String... candidates) {
        for (String c : candidates) {
            if (colMap.containsKey(c)) return colMap.get(c);
        }
        return null;
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    yield cell.getLocalDateTimeCellValue().toLocalDate().toString();
                }
                yield String.valueOf(cell.getNumericCellValue());
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield String.valueOf(cell.getNumericCellValue());
                } catch (Exception e) {
                    yield cell.getStringCellValue();
                }
            }
            default -> "";
        };
    }

    private LocalDate parseCellDate(Cell cell, String fallbackStr) {
        if (cell != null && cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue().toLocalDate();
        }
        if (fallbackStr == null || fallbackStr.isBlank()) {
            throw new IllegalArgumentException("Date cannot be blank");
        }
        return LocalDate.parse(fallbackStr.trim());
    }

    private BigDecimal parseCellAmount(Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) {
            return BigDecimal.valueOf(cell.getNumericCellValue());
        }
        String s = getCellValueAsString(cell).replace("$", "").replace(",", "").trim();
        if (s.isBlank()) return null;
        return new BigDecimal(s);
    }

    private boolean isRowEmpty(Row row) {
        for (Cell c : row) {
            if (c.getCellType() != CellType.BLANK && !getCellValueAsString(c).trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }
}
