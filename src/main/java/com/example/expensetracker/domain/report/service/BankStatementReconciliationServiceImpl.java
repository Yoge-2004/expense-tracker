package com.example.expensetracker.domain.report.service;

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
import java.time.temporal.ChronoUnit;
import java.util.*;

import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.service.ExpenseService;
import com.example.expensetracker.domain.income.dto.IncomeDto;
import com.example.expensetracker.domain.income.dto.IncomeRequest;
import com.example.expensetracker.domain.income.service.IncomeService;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ImportException;

/**
 * Dedicated implementation of {@link BankStatementReconciliationService} handling multi-bank statement parsing
 * and ledger auto-reconciliation across debits and credits.
 * Adheres to the Single Responsibility Principle (SRP) by decoupling statement reconciliation from
 * standard CSV/JSON/Excel import processing.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service("bankStatementReconciliationService")
@Transactional(readOnly = true)
public class BankStatementReconciliationServiceImpl implements BankStatementReconciliationService {

    private final ExpenseService expenseService;
    private final IncomeService incomeService;
    private final CategoryRepository categoryRepository;
    private final List<BankStatementParser> statementParsers;

    @Autowired
    public BankStatementReconciliationServiceImpl(ExpenseService expenseService,
                                                 IncomeService incomeService,
                                                 CategoryRepository categoryRepository,
                                                 @Autowired(required = false) List<BankStatementParser> statementParsers) {
        this.expenseService = expenseService;
        this.incomeService = incomeService;
        this.categoryRepository = categoryRepository;
        this.statementParsers = (statementParsers != null) ? statementParsers : Collections.emptyList();
    }

    public BankStatementReconciliationServiceImpl(ExpenseService expenseService,
                                                 IncomeService incomeService,
                                                 CategoryRepository categoryRepository) {
        this(expenseService, incomeService, categoryRepository, Collections.emptyList());
    }

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

        List<StatementRow> rows = null;
        if (statementParsers != null) {
            for (BankStatementParser parser : statementParsers) {
                if (parser.canParse(filename, Collections.emptyList())) {
                    rows = parser.parseStatement(file);
                    break;
                }
            }
        }
        if (rows == null) {
            if (isExcel) {
                rows = parseExcelStatement(file);
            } else {
                rows = parseCsvStatement(file);
            }
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

        List<Expense> missedDebits = new ArrayList<>();
        List<IncomeRequest> missedCredits = new ArrayList<>();

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
                    String merchant = ImportParsingSupport.cleanBankNarration(row.narration());
                    Category category = ImportParsingSupport.resolveOrCreateCategoryForUser("Bank Debits", user, categoryRepository, categoryCache);
                    Expense expense = new Expense();
                    expense.setAmount(row.debit());
                    expense.setExpenseDate(row.date());
                    String desc = merchant + (row.reference() != null && !row.reference().isBlank() ? " [Ref: " + row.reference() + "]" : "");
                    expense.setDescription(desc);
                    expense.setCategory(category);
                    expense.setUser(user);
                    missedDebits.add(expense);
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
                    String source = ImportParsingSupport.cleanBankNarration(row.narration());
                    String desc = source + (row.reference() != null && !row.reference().isBlank() ? " [Ref: " + row.reference() + "]" : "");
                    IncomeRequest req = new IncomeRequest(
                            row.credit(),
                            source,
                            desc,
                            row.date(),
                            false
                    );
                    missedCredits.add(req);
                    newIncomesCount++;
                    reconciliationLogs.add("Row " + row.rowNum() + " [Credit " + row.credit() + "]: Missed credit auto-recorded -> " + source);
                }
            }
        }

        if (!missedDebits.isEmpty()) {
            expenseService.createExpenses(missedDebits, user);
        }
        if (!missedCredits.isEmpty()) {
            incomeService.createIncomes(missedCredits, user);
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

            String line;
            int lineNum = 0;

            Map<String, Integer> col = null;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (line.isBlank()) continue;

                Map<String, Integer> candidateCol = ImportParsingSupport.parseHeader(line);
                Integer dCol = ImportParsingSupport.findColumn(candidateCol, "date", "txndate", "transactiondate", "valuedate", "trandate", "postingdate");
                Integer nCol = ImportParsingSupport.findColumn(candidateCol, "narration", "description", "remarks", "particulars", "transactiondetails", "details");

                if (dCol != null && nCol != null) {
                    col = candidateCol;
                    break;
                }
            }

            if (col == null) {
                throw new IllegalArgumentException("Bank statement must contain Date and Narration/Description headers");
            }

            Integer dateIdx = ImportParsingSupport.findColumn(col, "date", "txndate", "transactiondate", "valuedate", "trandate", "postingdate");
            Integer narrIdx = ImportParsingSupport.findColumn(col, "narration", "description", "remarks", "particulars", "transactiondetails", "details");
            if (dateIdx == null || narrIdx == null) {
                throw new IllegalArgumentException("Bank statement must contain Date and Narration/Description headers");
            }
            int dIdx = dateIdx;
            int nIdx = narrIdx;
            Integer debitIdx = ImportParsingSupport.findColumn(col, "debit", "withdrawal", "withdrawalamt", "withdrawalamount", "dr", "debitamount");
            Integer creditIdx = ImportParsingSupport.findColumn(col, "credit", "deposit", "depositamt", "depositamount", "cr", "creditamount");
            Integer refIdx = ImportParsingSupport.findColumn(col, "refno", "chqrefno", "chequenumber", "reference", "utr", "txnid", "transactionid", "chequeno", "chqno");
            Integer amtIdx = ImportParsingSupport.findColumn(col, "amount", "cost", "sum", "txnamount");
            Integer typeIdx = ImportParsingSupport.findColumn(col, "type", "drcr", "crdr", "direction");

            if (debitIdx == null && creditIdx == null && amtIdx == null) {
                throw new IllegalArgumentException("Bank statement must contain Debit/Withdrawal or Credit/Deposit columns");
            }

            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (line.isBlank()) continue;

                try {
                    List<String> parts = ImportParsingSupport.parseCsvLine(line);
                    if (parts.size() <= Math.max(dIdx, nIdx)) continue;

                    String dateStr = parts.get(dIdx).replace("\"", "").trim();
                    String narration = parts.get(nIdx).replace("\"", "").trim();
                    if (dateStr.isEmpty() || narration.isEmpty()) continue;

                    LocalDate date = ImportParsingSupport.parseDateString(dateStr);
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
                } catch (Exception _) {
                    // Skip unparseable row
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse CSV bank statement", e);
            throw new ImportException("Failed to parse CSV bank statement: " + e.getMessage(), e);
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
                if (row == null || ImportParsingSupport.isRowEmpty(row)) continue;

                Map<String, Integer> candidate = new HashMap<>();
                for (Cell cell : row) {
                    String val = ImportParsingSupport.getCellValueAsString(cell).trim().toLowerCase(Locale.ROOT);
                    if (!val.isBlank()) candidate.put(val, cell.getColumnIndex());
                }

                Integer dCol = ImportParsingSupport.findColumn(candidate, "date", "txndate", "transactiondate", "valuedate", "trandate", "postingdate");
                Integer nCol = ImportParsingSupport.findColumn(candidate, "narration", "description", "remarks", "particulars", "transactiondetails", "details");

                if (dCol != null && nCol != null) {
                    headerRowIdx = r;
                    colMap = candidate;
                    break;
                }
            }

            if (headerRowIdx == -1) {
                throw new IllegalArgumentException("Bank statement must contain Date and Narration/Description headers");
            }

            Integer dateCol = ImportParsingSupport.findColumn(colMap, "date", "txndate", "transactiondate", "valuedate", "trandate", "postingdate");
            Integer narrCol = ImportParsingSupport.findColumn(colMap, "narration", "description", "remarks", "particulars", "transactiondetails", "details");
            if (dateCol == null || narrCol == null) {
                throw new IllegalArgumentException("Bank statement must contain Date and Narration/Description headers");
            }
            int dCol = dateCol;
            int nCol = narrCol;
            Integer debitCol = ImportParsingSupport.findColumn(colMap, "debit", "withdrawal", "withdrawalamt", "withdrawalamount", "dr", "debitamount");
            Integer creditCol = ImportParsingSupport.findColumn(colMap, "credit", "deposit", "depositamt", "depositamount", "cr", "creditamount");
            Integer refCol = ImportParsingSupport.findColumn(colMap, "refno", "chqrefno", "chequenumber", "reference", "utr", "txnid", "transactionid", "chequeno", "chqno");
            Integer amtCol = ImportParsingSupport.findColumn(colMap, "amount", "cost", "sum", "txnamount");
            Integer typeCol = ImportParsingSupport.findColumn(colMap, "type", "drcr", "crdr", "direction");

            for (int r = headerRowIdx + 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || ImportParsingSupport.isRowEmpty(row)) continue;

                try {
                    Cell dateCell = row.getCell(dCol);
                    LocalDate date = ImportParsingSupport.parseDateCell(dateCell);

                    String narration = ImportParsingSupport.getCellValueAsString(row.getCell(nCol)).trim();
                    if (narration.isBlank()) continue;

                    BigDecimal debit = debitCol != null ? ImportParsingSupport.parseCellAmount(row.getCell(debitCol)) : null;
                    BigDecimal credit = creditCol != null ? ImportParsingSupport.parseCellAmount(row.getCell(creditCol)) : null;

                    if ((debit == null || debit.compareTo(BigDecimal.ZERO) <= 0) &&
                            (credit == null || credit.compareTo(BigDecimal.ZERO) <= 0) &&
                            amtCol != null) {
                        BigDecimal amt = ImportParsingSupport.parseCellAmount(row.getCell(amtCol));
                        if (amt != null && amt.compareTo(BigDecimal.ZERO) > 0) {
                            String type = typeCol != null ? ImportParsingSupport.getCellValueAsString(row.getCell(typeCol)).toUpperCase(Locale.ROOT) : "";
                            if (type.contains("CR") || type.contains("DEPOSIT") || type.contains("INCOME")) {
                                credit = amt;
                            } else {
                                debit = amt;
                            }
                        }
                    }

                    String ref = refCol != null ? ImportParsingSupport.getCellValueAsString(row.getCell(refCol)).trim() : null;

                    if ((debit != null && debit.compareTo(BigDecimal.ZERO) > 0) ||
                            (credit != null && credit.compareTo(BigDecimal.ZERO) > 0)) {
                        list.add(new StatementRow(date, narration, debit, credit, ref, r + 1));
                    }
                } catch (Exception _) {
                    // Skip unparseable row
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse Excel bank statement", e);
            throw new ImportException("Failed to parse Excel bank statement: " + e.getMessage(), e);
        }
        return list;
    }
}
