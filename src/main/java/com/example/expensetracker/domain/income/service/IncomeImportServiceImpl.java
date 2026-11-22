package com.example.expensetracker.domain.income.service;

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

import com.example.expensetracker.domain.income.dto.IncomeDto;
import com.example.expensetracker.domain.income.dto.IncomeRequest;
import com.example.expensetracker.domain.report.service.ImportParsingSupport;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ImportException;

/**
 * Dedicated implementation of {@link IncomeImportService} handling CSV, JSON, and Excel ingestion for incomes.
 * Adheres to the Single Responsibility Principle (SRP) by decoupling income parsing and ingestion from
 * expense and bank statement reconciliation logic.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service("incomeImportService")
@Transactional(readOnly = true)
public class IncomeImportServiceImpl implements IncomeImportService {

    private static final String COL_SOURCE = "source";

    private final IncomeService incomeService;
    private final ObjectMapper objectMapper;

    @Autowired
    public IncomeImportServiceImpl(IncomeService incomeService,
                                   @Autowired(required = false) ObjectMapper objectMapper) {
        this.incomeService = incomeService;
        this.objectMapper = (objectMapper != null) ? objectMapper : new ObjectMapper().registerModule(new JavaTimeModule());
    }

    public IncomeImportServiceImpl(IncomeService incomeService) {
        this(incomeService, null);
    }

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
        List<IncomeRequest> requestsToSave = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                throw new IllegalArgumentException("CSV file is empty — no header row found");
            }

            Map<String, Integer> col = ImportParsingSupport.parseHeader(headerLine);
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
                if (line.isBlank()) {
                    continue;
                }

                try {
                    List<String> parts = ImportParsingSupport.parseCsvLine(line);
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
                    requestsToSave.add(req);

                } catch (Exception rowEx) {
                    rowErrors.add("Row " + rowNum + ": " + rowEx.getMessage());
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to read income CSV file for user {}", user.getId(), e);
            throw new ImportException("Failed to read CSV file: " + e.getMessage(), e);
        }

        if (!requestsToSave.isEmpty()) {
            incomeService.createIncomes(requestsToSave, user);
        }
        int count = requestsToSave.size();

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
            List<IncomeRequest> requestsToSave = new ArrayList<>(dtos.size());

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
                requestsToSave.add(req);
            }

            incomeService.createIncomes(requestsToSave, user);
            int count = requestsToSave.size();

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
            throw new ImportException("Error importing incomes from JSON: " + e.getMessage(), e);
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
        List<String> errors = new ArrayList<>();
        List<IncomeRequest> requestsToSave = new ArrayList<>();

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
                String val = ImportParsingSupport.getCellValueAsString(cell).trim().toLowerCase(Locale.ROOT);
                if (!val.isBlank()) {
                    colMap.put(val, cell.getColumnIndex());
                }
            }

            Integer dateCol = ImportParsingSupport.findColumn(colMap, "date", "incomedate", "transactiondate");
            Integer srcCol = ImportParsingSupport.findColumn(colMap, COL_SOURCE, "incomesource", "channel", "payer");
            Integer amtCol = ImportParsingSupport.findColumn(colMap, "amount", "income", "earnings", "sum");
            Integer descCol = ImportParsingSupport.findColumn(colMap, "description", "desc", "note", "notes");
            Integer recCol = ImportParsingSupport.findColumn(colMap, "recurring", "isrecurring");

            if (dateCol == null || srcCol == null || amtCol == null) {
                throw new IllegalArgumentException(
                        "Excel sheet must contain at least: Date, Source, and Amount headers. Found: "
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

                    String sourceStr = ImportParsingSupport.getCellValueAsString(row.getCell(srcCol)).trim();
                    if (sourceStr.isBlank()) {
                        throw new IllegalArgumentException("Source cannot be blank");
                    }

                    BigDecimal amount = ImportParsingSupport.parseCellAmount(row.getCell(amtCol));
                    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new IllegalArgumentException("Amount must be greater than zero");
                    }

                    String description = descCol != null ? ImportParsingSupport.getCellValueAsString(row.getCell(descCol)).trim() : "";
                    boolean isRecurring = false;
                    if (recCol != null) {
                        String recVal = ImportParsingSupport.getCellValueAsString(row.getCell(recCol)).trim().toLowerCase(Locale.ROOT);
                        isRecurring = recVal.equals("true") || recVal.equals("yes") || recVal.equals("1");
                    }

                    IncomeRequest req = new IncomeRequest(
                            amount,
                            sourceStr,
                            description.isBlank() ? sourceStr : description,
                            date,
                            isRecurring
                    );
                    requestsToSave.add(req);
                } catch (Exception ex) {
                    errors.add("Row " + (r + 1) + ": " + ex.getMessage());
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse Excel file for incomes", e);
            throw new ImportException("Failed to read Excel workbook: " + e.getMessage(), e);
        }

        if (!requestsToSave.isEmpty()) {
            incomeService.createIncomes(requestsToSave, user);
        }
        int count = requestsToSave.size();

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
}
