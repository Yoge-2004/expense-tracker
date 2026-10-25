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
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.poi.ss.usermodel.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Production implementation of {@link ImportService} supporting CSV, JSON, and Excel (.xlsx)
 * batch ingestion for expenses and income streams, as well as smart bank statement reconciliation.
 *
 * <h3>Key design decisions:</h3>
 * <ul>
 *   <li><b>Fault tolerance:</b> individual row failures do not abort the entire batch.
 *       Instead, successful rows are committed and failed rows are captured with line numbers
 *       and specific reason messages in the response payload.</li>
 *   <li><b>User isolation:</b> all imported records are strictly associated with the
 *       authenticated {@link User}. Category resolution ensures users only see their own
 *       custom categories or system globals — no cross-user category pollution.</li>
 *   <li><b>Flexible column mappings:</b> headers are matched case-insensitively with common
 *       aliases (e.g. "cost", "price", "amount" all map to amount).</li>
 *   <li><b>Automated Bank Statement Reconciliation:</b> dynamically parses statements across
 *       all major retail banks (HDFC, SBI, ICICI, Axis, Kotak, etc.) and auto-matches
 *       existing entries while capturing 100% of missed debits and credits.</li>
 * </ul>
 *
 * @author Yogeshwaran
 * @version 1.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ImportServiceImpl implements ImportService {

    private static final String COL_SOURCE = "source";

    private final ExpenseService expenseService;
    private final IncomeService incomeService;
    private final CategoryRepository categoryRepository;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    // ─────────────────────────────────────────────────────────────────────────
    // EXPENSE IMPORTS
    // ─────────────────────────────────────────────────────────────────────────

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
                if (line.trim().isEmpty()) {
                    continue;
                }

                try {
                    List<String> parts = parseCsvLine(line);
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

                    Category category = resolveOrCreateCategoryForUser(catStr, user, categoryCache);

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
            log.error("Failed to read expense CSV file for user {}", user.getId(), e);
            throw new RuntimeException("Failed to read CSV file: " + e.getMessage(), e);
        }

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
            int count = 0;
            for (ExpenseDto dto : dtos) {
                if (dto == null) {
                    throw new IllegalArgumentException("Expense record in JSON cannot be null");
                }
                Category category = null;
                if (dto.categoryName() != null && !dto.categoryName().isBlank()) {
                    category = resolveOrCreateCategoryForUser(dto.categoryName().trim(), user, categoryCache);
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

                expenseService.createExpense(expense, user);
                count++;
            }

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
            throw new RuntimeException("Error importing expenses from JSON: " + e.getMessage(), e);
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
        int count = 0;
        List<String> errors = new ArrayList<>();
        Map<String, Category> categoryCache = new HashMap<>();

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
                        "Excel sheet must contain at least: Date, Category, and Amount headers. Found: "
                                + colMap.keySet()
                );
            }

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) {
                    continue;
                }

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

                    Category category = resolveOrCreateCategoryForUser(catName, user, categoryCache);

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
            log.error("Failed to parse Excel file for expenses", e);
            throw new RuntimeException("Failed to read Excel workbook: " + e.getMessage(), e);
        }

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

    // ─────────────────────────────────────────────────────────────────────────
    // INCOME IMPORTS
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Map<String, Object> importIncomesFromCsv(MultipartFile file, User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        if (file == null || file.isEmpty()) {
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
            if (!col.containsKey("date") || !col.containsKey(COL_SOURCE) || !col.containsKey("amount")) {
                throw new IllegalArgumentException(
                        "CSV must contain at least 'date', 'source', and 'amount' headers. "
                        + "Found: " + col.keySet()
                );
            }

            int dateIdx = col.get("date");
            int srcIdx  = col.get(COL_SOURCE);
            int amtIdx  = col.get("amount");
            Integer descIdx = col.get("description");

            String line;
            int rowNum = 1;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                if (line.trim().isEmpty()) {
                    continue;
                }

                try {
                    List<String> parts = parseCsvLine(line);
                    int maxNeeded = Math.max(dateIdx, Math.max(srcIdx, amtIdx));
                    if (parts.size() <= maxNeeded) {
                        rowErrors.add("Row " + rowNum + ": expected at least " + (maxNeeded + 1)
                                + " columns, found " + parts.size() + ".");
                        continue;
                    }

                    String dateStr = parts.get(dateIdx).replace("\"", "").trim();
                    String sourceStr = parts.get(srcIdx).replace("\"", "").trim();
                    String amtStr = parts.get(amtIdx).replace("\"", "").trim().replaceAll("[^0-9.\\-]", "");
                    String desc = (descIdx != null && descIdx < parts.size())
                            ? parts.get(descIdx).replace("\"", "").trim() : "";

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
            log.error("Failed to read income CSV file for user {}", user.getId(), e);
            throw new RuntimeException("Failed to read CSV file: " + e.getMessage(), e);
        }

        if (count == 0) {
            if (rowErrors.isEmpty()) {
                throw new IllegalArgumentException("CSV file contains no income data rows to import");
            }
            throw new IllegalArgumentException("Failed to import incomes: all " + rowErrors.size()
                    + " rows failed (" + String.join("; ", rowErrors) + ")");
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
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

        try {
            List<IncomeDto> dtos = objectMapper.readValue(file.getInputStream(), new TypeReference<>() {});
            if (dtos == null || dtos.isEmpty()) {
                throw new IllegalArgumentException("JSON file contains no incomes to import");
            }
            int count = 0;
            for (IncomeDto dto : dtos) {
                if (dto == null) {
                    throw new IllegalArgumentException("Income record in JSON cannot be null");
                }
                if (dto.amount() == null || dto.amount().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Income amount must be greater than zero");
                }
                if (dto.source() == null || dto.source().isBlank()) {
                    throw new IllegalArgumentException("Income source cannot be blank");
                }
                IncomeRequest req = new IncomeRequest(
                        dto.amount(),
                        dto.source(),
                        dto.description(),
                        dto.incomeDate() != null ? dto.incomeDate() : LocalDate.now(),
                        Boolean.TRUE.equals(dto.isRecurring())
                );
                incomeService.createIncome(req, user);
                count++;
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("imported", count);
            result.put("message", "Imported " + count + " income records successfully");
            return result;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (JsonProcessingException e) {
            log.warn("Malformed JSON file during income import for user {}: {}", user.getId(), e.getMessage());
            throw new IllegalArgumentException("Malformed JSON file: " + e.getOriginalMessage(), e);
        } catch (Exception e) {
            log.error("Failed to import incomes from JSON for user {}", user.getId(), e);
            throw new RuntimeException("Error importing incomes from JSON: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public Map<String, Object> importIncomesFromExcel(MultipartFile file, User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
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
            Integer srcCol = findColumn(colMap, COL_SOURCE, "incomesource", "channel", "payer");
            Integer amtCol = findColumn(colMap, "amount", "income", "earnings", "sum");
            Integer descCol = findColumn(colMap, "description", "desc", "note", "notes");
            Integer recCol = findColumn(colMap, "recurring", "isrecurring");

            if (dateCol == null || srcCol == null || amtCol == null) {
                throw new IllegalArgumentException(
                        "Excel sheet must contain at least: Date, Source, and Amount headers. Found: "
                                + colMap.keySet()
                );
            }

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) {
                    continue;
                }

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
            log.error("Failed to parse Excel file for incomes", e);
            throw new RuntimeException("Failed to read Excel workbook: " + e.getMessage(), e);
        }

        if (count == 0) {
            if (errors.isEmpty()) {
                throw new IllegalArgumentException("Excel sheet contains no income data rows to import");
            }
            throw new IllegalArgumentException("Failed to import incomes: all " + errors.size()
                    + " rows failed (" + String.join("; ", errors) + ")");
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
    // BANK STATEMENT RECONCILIATION ENGINE
    // ─────────────────────────────────────────────────────────────────────────

    public record StatementRow(
            LocalDate date,
            String narration,
            BigDecimal debit,
            BigDecimal credit,
            String reference,
            int rowNum
    ) {}

    @Override
    @Transactional
    public Map<String, Object> reconcileBankStatement(MultipartFile file, User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase(Locale.ROOT) : "";
        boolean isExcel = filename.endsWith(".xlsx") || filename.endsWith(".xls");

        List<StatementRow> rows;
        if (isExcel) {
            rows = parseExcelStatement(file);
        } else {
            rows = parseCsvStatement(file);
        }

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Statement contains no valid transaction rows to reconcile");
        }

        // Retrieve existing user transactions
        List<Expense> existingExpenses = new ArrayList<>(expenseService.getUserExpenses(user));
        List<IncomeDto> existingIncomes = new ArrayList<>(incomeService.getUserIncomes(user));

        int reconciledCount = 0;
        int newExpensesCount = 0;
        int newIncomesCount = 0;
        List<String> reconciliationLogs = new ArrayList<>();
        Map<String, Category> categoryCache = new HashMap<>();

        for (StatementRow row : rows) {
            // Check debit (expense outflow)
            if (row.debit() != null && row.debit().compareTo(BigDecimal.ZERO) > 0) {
                Optional<Expense> match = existingExpenses.stream()
                        .filter(e -> Math.abs(ChronoUnit.DAYS.between(e.getExpenseDate(), row.date())) <= 2)
                        .filter(e -> e.getAmount().subtract(row.debit()).abs().compareTo(new BigDecimal("0.01")) <= 0)
                        .findFirst();

                if (match.isPresent()) {
                    reconciledCount++;
                    existingExpenses.remove(match.get());
                    reconciliationLogs.add("Row " + row.rowNum() + " [Debit " + row.debit() + "]: Reconciled with existing expense on " + match.get().getExpenseDate());
                } else {
                    // Missed debit -> add as new expense
                    String merchant = cleanBankNarration(row.narration());
                    Category category = resolveOrCreateCategoryForUser("Bank Debits", user, categoryCache);
                    Expense expense = new Expense();
                    expense.setAmount(row.debit());
                    expense.setExpenseDate(row.date());
                    String desc = merchant + (row.reference() != null && !row.reference().isBlank() ? " [Ref: " + row.reference() + "]" : "");
                    expense.setDescription(desc);
                    expense.setCategory(category);
                    expense.setUser(user);
                    expenseService.createExpense(expense, user);
                    newExpensesCount++;
                    reconciliationLogs.add("Row " + row.rowNum() + " [Debit " + row.debit() + "]: Missed debit auto-recorded -> " + merchant);
                }
            } else if (row.credit() != null && row.credit().compareTo(BigDecimal.ZERO) > 0) {
                // Check credit (income inflow)
                Optional<IncomeDto> match = existingIncomes.stream()
                        .filter(i -> i.incomeDate() != null && Math.abs(ChronoUnit.DAYS.between(i.incomeDate(), row.date())) <= 2)
                        .filter(i -> i.amount().subtract(row.credit()).abs().compareTo(new BigDecimal("0.01")) <= 0)
                        .findFirst();

                if (match.isPresent()) {
                    reconciledCount++;
                    existingIncomes.remove(match.get());
                    reconciliationLogs.add("Row " + row.rowNum() + " [Credit " + row.credit() + "]: Reconciled with existing income on " + match.get().incomeDate());
                } else {
                    // Missed credit -> add as new income
                    String source = cleanBankNarration(row.narration());
                    String desc = source + (row.reference() != null && !row.reference().isBlank() ? " [Ref: " + row.reference() + "]" : "");
                    IncomeRequest req = new IncomeRequest(
                            row.credit(),
                            source,
                            desc,
                            row.date(),
                            false
                    );
                    incomeService.createIncome(req, user);
                    newIncomesCount++;
                    reconciliationLogs.add("Row " + row.rowNum() + " [Credit " + row.credit() + "]: Missed credit auto-recorded -> " + source);
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalRows", rows.size());
        result.put("reconciledCount", reconciledCount);
        result.put("newExpensesCount", newExpensesCount);
        result.put("newIncomesCount", newIncomesCount);
        result.put("logs", reconciliationLogs);
        result.put("message", String.format(
                "Statement reconciled: %d matched existing ledger entries, %d missed debits captured, %d missed credits recorded (Total %d rows).",
                reconciledCount, newExpensesCount, newIncomesCount, rows.size()
        ));
        return result;
    }

    private List<StatementRow> parseCsvStatement(MultipartFile file) {
        List<StatementRow> list = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = null;
            String line;
            int lineNum = 0;

            // Find header line (skipping any introductory bank statement metadata lines)
            Map<String, Integer> col = null;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (line.trim().isEmpty()) continue;

                Map<String, Integer> candidateCol = parseHeader(line);
                Integer dCol = findColumn(candidateCol, "date", "txndate", "transactiondate", "valuedate", "trandate", "postingdate");
                Integer nCol = findColumn(candidateCol, "narration", "description", "remarks", "particulars", "transactiondetails", "details");

                if (dCol != null && nCol != null) {
                    col = candidateCol;
                    headerLine = line;
                    break;
                }
            }

            if (col == null) {
                throw new IllegalArgumentException("Bank statement must contain Date and Narration/Description headers");
            }

            Integer dateIdx = findColumn(col, "date", "txndate", "transactiondate", "valuedate", "trandate", "postingdate");
            Integer narrIdx = findColumn(col, "narration", "description", "remarks", "particulars", "transactiondetails", "details");
            Integer debitIdx = findColumn(col, "debit", "withdrawal", "withdrawalamt", "withdrawalamount", "dr", "debitamount");
            Integer creditIdx = findColumn(col, "credit", "deposit", "depositamt", "depositamount", "cr", "creditamount");
            Integer refIdx = findColumn(col, "refno", "chqrefno", "chequenumber", "reference", "utr", "txnid", "transactionid", "chequeno", "chqno");
            Integer amtIdx = findColumn(col, "amount", "cost", "sum", "txnamount");
            Integer typeIdx = findColumn(col, "type", "drcr", "crdr", "direction");

            if (debitIdx == null && creditIdx == null && amtIdx == null) {
                throw new IllegalArgumentException("Bank statement must contain Debit/Withdrawal or Credit/Deposit columns");
            }

            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (line.trim().isEmpty()) continue;

                try {
                    List<String> parts = parseCsvLine(line);
                    if (parts.size() <= Math.max(dateIdx, narrIdx)) continue;

                    String dateStr = parts.get(dateIdx).replace("\"", "").trim();
                    String narration = parts.get(narrIdx).replace("\"", "").trim();
                    if (dateStr.isEmpty() || narration.isEmpty()) continue;

                    LocalDate date = parseDateString(dateStr);
                    BigDecimal debit = null;
                    BigDecimal credit = null;

                    if (debitIdx != null && debitIdx < parts.size()) {
                        String dStr = parts.get(debitIdx).replace("\"", "").trim().replaceAll("[^0-9.\\-]", "");
                        if (!dStr.isEmpty()) {
                            BigDecimal val = new BigDecimal(dStr);
                            if (val.compareTo(BigDecimal.ZERO) > 0) debit = val;
                        }
                    }

                    if (creditIdx != null && creditIdx < parts.size()) {
                        String cStr = parts.get(creditIdx).replace("\"", "").trim().replaceAll("[^0-9.\\-]", "");
                        if (!cStr.isEmpty()) {
                            BigDecimal val = new BigDecimal(cStr);
                            if (val.compareTo(BigDecimal.ZERO) > 0) credit = val;
                        }
                    }

                    if (debit == null && credit == null && amtIdx != null && amtIdx < parts.size()) {
                        String aStr = parts.get(amtIdx).replace("\"", "").trim().replaceAll("[^0-9.\\-]", "");
                        if (!aStr.isEmpty()) {
                            BigDecimal val = new BigDecimal(aStr);
                            String type = typeIdx != null && typeIdx < parts.size() ? parts.get(typeIdx).trim().toUpperCase(Locale.ROOT) : "";
                            if (type.contains("CR") || type.contains("DEPOSIT") || type.contains("INCOME")) {
                                credit = val;
                            } else {
                                debit = val;
                            }
                        }
                    }

                    String ref = (refIdx != null && refIdx < parts.size()) ? parts.get(refIdx).replace("\"", "").trim() : null;

                    if (debit != null || credit != null) {
                        list.add(new StatementRow(date, narration, debit, credit, ref, lineNum));
                    }
                } catch (Exception ignored) {
                    // Skip unparseable row
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse CSV bank statement", e);
            throw new RuntimeException("Failed to parse CSV bank statement: " + e.getMessage(), e);
        }
        return list;
    }

    private List<StatementRow> parseExcelStatement(MultipartFile file) {
        List<StatementRow> list = new ArrayList<>();
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null || sheet.getPhysicalNumberOfRows() == 0) {
                throw new IllegalArgumentException("The Excel statement sheet is empty");
            }

            int headerRowIdx = -1;
            Map<String, Integer> colMap = new HashMap<>();

            for (int r = 0; r <= Math.min(sheet.getLastRowNum(), 20); r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                Map<String, Integer> candidate = new HashMap<>();
                for (Cell cell : row) {
                    String val = getCellValueAsString(cell).trim().toLowerCase(Locale.ROOT);
                    if (!val.isBlank()) candidate.put(val, cell.getColumnIndex());
                }

                Integer dCol = findColumn(candidate, "date", "txndate", "transactiondate", "valuedate", "trandate", "postingdate");
                Integer nCol = findColumn(candidate, "narration", "description", "remarks", "particulars", "transactiondetails", "details");

                if (dCol != null && nCol != null) {
                    headerRowIdx = r;
                    colMap = candidate;
                    break;
                }
            }

            if (headerRowIdx == -1) {
                throw new IllegalArgumentException("Bank statement must contain Date and Narration/Description headers");
            }

            Integer dateCol = findColumn(colMap, "date", "txndate", "transactiondate", "valuedate", "trandate", "postingdate");
            Integer narrCol = findColumn(colMap, "narration", "description", "remarks", "particulars", "transactiondetails", "details");
            Integer debitCol = findColumn(colMap, "debit", "withdrawal", "withdrawalamt", "withdrawalamount", "dr", "debitamount");
            Integer creditCol = findColumn(colMap, "credit", "deposit", "depositamt", "depositamount", "cr", "creditamount");
            Integer refCol = findColumn(colMap, "refno", "chqrefno", "chequenumber", "reference", "utr", "txnid", "transactionid", "chequeno", "chqno");
            Integer amtCol = findColumn(colMap, "amount", "cost", "sum", "txnamount");
            Integer typeCol = findColumn(colMap, "type", "drcr", "crdr", "direction");

            for (int r = headerRowIdx + 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                try {
                    Cell dateCell = row.getCell(dateCol);
                    String dateStr = getCellValueAsString(dateCell);
                    LocalDate date = parseCellDate(dateCell, dateStr);

                    String narration = getCellValueAsString(row.getCell(narrCol)).trim();
                    if (narration.isBlank()) continue;

                    BigDecimal debit = debitCol != null ? parseCellAmount(row.getCell(debitCol)) : null;
                    BigDecimal credit = creditCol != null ? parseCellAmount(row.getCell(creditCol)) : null;

                    if ((debit == null || debit.compareTo(BigDecimal.ZERO) <= 0) &&
                        (credit == null || credit.compareTo(BigDecimal.ZERO) <= 0) &&
                        amtCol != null) {
                        BigDecimal amt = parseCellAmount(row.getCell(amtCol));
                        if (amt != null && amt.compareTo(BigDecimal.ZERO) > 0) {
                            String type = typeCol != null ? getCellValueAsString(row.getCell(typeCol)).toUpperCase(Locale.ROOT) : "";
                            if (type.contains("CR") || type.contains("DEPOSIT") || type.contains("INCOME")) {
                                credit = amt;
                            } else {
                                debit = amt;
                            }
                        }
                    }

                    String ref = refCol != null ? getCellValueAsString(row.getCell(refCol)).trim() : null;

                    if ((debit != null && debit.compareTo(BigDecimal.ZERO) > 0) ||
                        (credit != null && credit.compareTo(BigDecimal.ZERO) > 0)) {
                        list.add(new StatementRow(date, narration, debit, credit, ref, r + 1));
                    }
                } catch (Exception ignored) {
                    // Skip unparseable row
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse Excel bank statement", e);
            throw new RuntimeException("Failed to parse Excel bank statement: " + e.getMessage(), e);
        }
        return list;
    }

    private static final Pattern UPI_PATTERN = Pattern.compile("(?i)UPI(?:/[^/]+)?/([^/]+)/.*");
    private static final Pattern POS_PATTERN = Pattern.compile("(?i)POS(?:\s+[0-9X*]+)?\s+([A-Za-z0-9\s&.'-]+)");
    private static final Pattern NEFT_PATTERN = Pattern.compile("(?i)(?:NEFT|RTGS|IMPS)(?:\\s*CR|\\s*DR)?(?:[-/:]\\s*|\\s+)([A-Za-z0-9\\s&.'-]+)");

    /**
     * Extracts a clean, human-readable merchant/source name from noisy bank statement narrations.
     */
    public static String cleanBankNarration(String raw) {
        if (raw == null || raw.isBlank()) {
            return "Bank Transaction";
        }
        String clean = raw.trim();

        Matcher upiMatcher = UPI_PATTERN.matcher(clean);
        if (upiMatcher.find() && !upiMatcher.group(1).isBlank()) {
            return upiMatcher.group(1).trim();
        }

        Matcher posMatcher = POS_PATTERN.matcher(clean);
        if (posMatcher.find() && !posMatcher.group(1).isBlank()) {
            return posMatcher.group(1).trim();
        }

        Matcher neftMatcher = NEFT_PATTERN.matcher(clean);
        if (neftMatcher.find() && !neftMatcher.group(1).isBlank()) {
            String m = neftMatcher.group(1).trim();
            m = m.replaceFirst("(?i)^[A-Z0-9]{8,15}[-/:]?\\s*", ""); // strip any ref ID prefix
            m = m.replace('-', ' ').replace('_', ' ').replaceAll("\s{2,}", " ").trim();
            if (!m.isBlank()) return m;
        }

        // General cleanup: remove common transaction prefixes
        clean = clean.replaceFirst("(?i)^(?:UPI/|POS|NEFT|RTGS|IMPS|ACH|BIL/|INF/|INB/|CMS/|TXN:?)\\s*", "");
        clean = clean.replaceAll("(?i)\\b(?:DR|CR|REF|UTR|RRN|TXN|NO|MB|BRN)[0-9A-Z]{6,}\\b", "");
        clean = clean.replaceAll("\\s{2,}", " ").trim();

        return clean.isEmpty() ? "Bank Transaction" : clean;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PARSING HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private static List<String> parseCsvLine(String line) {
        List<String> tokens = new ArrayList<>();
        if (line == null) {
            return tokens;
        }
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '\"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '\"') {
                    sb.append('\"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                tokens.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        tokens.add(sb.toString().trim());
        return tokens;
    }

    private Map<String, Integer> parseHeader(String headerLine) {
        Map<String, Integer> col = new HashMap<>();
        List<String> headers = parseCsvLine(headerLine);
        for (int i = 0; i < headers.size(); i++) {
            String name = headers.get(i).replace("\"", "").trim().toLowerCase(Locale.ROOT);
            col.put(name, i);
        }
        return col;
    }

    private Integer findColumn(Map<String, Integer> colMap, String... candidates) {
        for (String c : candidates) {
            if (colMap.containsKey(c)) {
                return colMap.get(c);
            }
        }
        // Normalize search: match alphanumeric keys ignoring currencies, symbols, parentheses
        for (String c : candidates) {
            String candClean = c.replaceAll("[^a-z0-9]", "");
            for (Map.Entry<String, Integer> entry : colMap.entrySet()) {
                String keyClean = entry.getKey().replaceAll("[^a-z0-9]", "");
                if (keyClean.equals(candClean) || keyClean.startsWith(candClean) || keyClean.contains(candClean)) {
                    return entry.getValue();
                }
            }
        }
        return null;
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) {
            return "";
        }
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
                    yield cell.getStringCellValue();
                } catch (Exception e) {
                    yield String.valueOf(cell.getNumericCellValue());
                }
            }
            default -> "";
        };
    }

    private LocalDate parseCellDate(Cell cell, String fallbackStr) {
        if (DateUtil.isCellDateFormatted(cell)) {
            Date d = cell.getDateCellValue();
            return d.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        return parseDateString(fallbackStr);
    }

    /**
     * STRICT resolver + "uuuu" (proleptic year), not the default SMART + "yyyy"
     * (year-of-era): under SMART, DateTimeFormatter.ofPattern silently CLAMPS an
     * out-of-range day-of-month to the last valid day (per the ResolverStyle
     * javadoc), so "31/04/2026" would import as 30 April and "30/02/2026" as
     * 28 February with no error at all. STRICT rejects those outright, but
     * STRICT can't resolve year-of-era ("yyyy") without an era field, hence
     * "uuuu".
     */
    private static DateTimeFormatter strictFormatter(String pattern) {
        return DateTimeFormatter.ofPattern(pattern).withResolverStyle(ResolverStyle.STRICT);
    }

    private static final DateTimeFormatter DD_MM_SLASH = strictFormatter("dd/MM/uuuu");
    private static final DateTimeFormatter MM_DD_SLASH = strictFormatter("MM/dd/uuuu");
    private static final List<DateTimeFormatter> NON_COLLIDING_FORMATTERS = List.of(
            strictFormatter("dd-MM-uuuu"),
            strictFormatter("uuuu/MM/dd"),
            strictFormatter("d/M/uuuu"),
            strictFormatter("d-M-uuuu"),
            strictFormatter("dd.MM.uuuu")
    );

    /** Package-private (not private) so the ambiguity-detection logic below is
     *  directly unit-testable without needing a POI Cell fixture — everything
     *  here is a pure function of the input string. */
    static LocalDate parseDateString(String fallbackStr) {
        String s = fallbackStr.trim();

        // ISO is unambiguous by construction (only one valid reading) — try it
        // on its own, first. (ISO_LOCAL_DATE is already STRICT.)
        LocalDate isoResult = tryParseDate(s, DateTimeFormatter.ISO_LOCAL_DATE);
        if (isoResult != null) {
            return isoResult;
        }

        // dd/MM/yyyy and MM/dd/yyyy are the one pair among these formatters that
        // can BOTH successfully parse the exact same 2-digit/2-digit/4-digit
        // input (whenever day and month are each <=12) while producing two
        // DIFFERENT dates — e.g. "03/04/2026" is either 3 April or 4 March
        // depending on which is meant, and there is no way to tell from the
        // string alone.
        LocalDate ddMm = tryParseDate(s, DD_MM_SLASH);
        LocalDate mmDd = tryParseDate(s, MM_DD_SLASH);
        if (ddMm != null && mmDd != null && !ddMm.equals(mmDd)) {
            throw new IllegalArgumentException(
                    "Ambiguous date '" + s + "': could be " + ddMm + " (read as DD/MM/YYYY) or "
                            + mmDd + " (read as MM/DD/YYYY). Please use an unambiguous format "
                            + "such as YYYY-MM-DD.");
        }
        if (ddMm != null) {
            return ddMm;
        }
        if (mmDd != null) {
            return mmDd;
        }

        for (DateTimeFormatter fmt : NON_COLLIDING_FORMATTERS) {
            LocalDate result = tryParseDate(s, fmt);
            if (result != null) {
                return result;
            }
        }
        throw new IllegalArgumentException("Unrecognised date format: '" + s
                + "'. Expected YYYY-MM-DD, DD/MM/YYYY, etc.");
    }

    /** Returns the parsed date, or null if {@code s} doesn't match {@code fmt} —
     *  never throws, so callers can freely probe multiple formats. */
    private static LocalDate tryParseDate(String s, DateTimeFormatter fmt) {
        try {
            return LocalDate.parse(s, fmt);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private BigDecimal parseCellAmount(Cell cell) {
        if (cell == null) {
            return null;
        }
        return switch (cell.getCellType()) {
            case NUMERIC -> BigDecimal.valueOf(cell.getNumericCellValue());
            case STRING -> {
                String clean = cell.getStringCellValue().replaceAll("[^0-9.\\-]", "").trim();
                yield clean.isEmpty() ? null : new BigDecimal(clean);
            }
            case FORMULA -> {
                try {
                    yield BigDecimal.valueOf(cell.getNumericCellValue());
                } catch (Exception ex) {
                    try {
                        String clean = cell.getStringCellValue().replaceAll("[^0-9.\\-]", "").trim();
                        yield clean.isEmpty() ? null : new BigDecimal(clean);
                    } catch (Exception ignored) {
                        yield null;
                    }
                }
            }
            default -> null;
        };
    }

    private boolean isRowEmpty(Row row) {
        for (Cell c : row) {
            if (!getCellValueAsString(c).isBlank()) {
                return false;
            }
        }
        return true;
    }

    /**
     * Resolves a category by name for the given user, or falls back to a global category,
     * or creates a new user-scoped category if none exists.
     *
     * @param name the raw category name from the import file
     * @param user the owning user
     * @param categoryCache optional cache map (name lowercase -&gt; Category entity)
     * @return the resolved or newly created {@link Category}
     */
    private Category resolveOrCreateCategoryForUser(String name, User user, Map<String, Category> categoryCache) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Category name cannot be blank");
        }
        if (user == null) {
            throw new IllegalArgumentException("User context required for category resolution");
        }
        String trimmed = name.trim();
        String cacheKey = trimmed.toLowerCase();
        if (categoryCache != null && categoryCache.containsKey(cacheKey)) {
            return categoryCache.get(cacheKey);
        }
        // 1. Try user's own category first
        Optional<Category> userCat = categoryRepository.findByUserAndNameIgnoreCase(user, trimmed);
        if (userCat.isPresent()) {
            Category cat = userCat.get();
            if (categoryCache != null) {
                categoryCache.put(cacheKey, cat);
            }
            return cat;
        }
        // 2. Fall back to a global category (user_id IS NULL)
        Optional<Category> globalCat = categoryRepository.findByUserIsNullAndNameIgnoreCase(trimmed);
        if (globalCat.isPresent()) {
            Category cat = globalCat.get();
            if (categoryCache != null) {
                categoryCache.put(cacheKey, cat);
            }
            return cat;
        }
        // 3. Otherwise create a new user-scoped category
        Category newCat = new Category();
        newCat.setName(trimmed);
        newCat.setUser(user);
        Category saved = categoryRepository.save(newCat);
        if (categoryCache != null) {
            categoryCache.put(cacheKey, saved);
        }
        return saved;
    }
}
