package com.example.expensetracker.domain.income.service;

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
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.example.expensetracker.common.importing.ImportParsingSupport;
import com.example.expensetracker.common.importing.TabularImportSupport;
import com.example.expensetracker.domain.income.dto.IncomeDto;
import com.example.expensetracker.domain.income.dto.IncomeRequest;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ImportException;

/**
 * Dedicated implementation of {@link IncomeImportService} handling CSV, JSON, and Excel ingestion for incomes.
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
        this.objectMapper = (objectMapper != null)
                ? objectMapper
                : new ObjectMapper().registerModule(new JavaTimeModule());
    }

    public IncomeImportServiceImpl(IncomeService incomeService) {
        this(incomeService, null);
    }

    @Override
    @Transactional
    public Map<String, Object> importIncomesFromCsv(MultipartFile file, User user) {
        TabularImportSupport.validateUpload(file, user);

        List<String> rowErrors = new ArrayList<>();
        List<IncomeRequest> requestsToSave = new ArrayList<>();
        int[] cols = new int[4]; // dateIdx, srcIdx, amtIdx, descIdx (-1 when absent)

        try {
            TabularImportSupport.readCsvRows(file, col -> {
                if (!col.containsKey("date") || !col.containsKey(COL_SOURCE) || !col.containsKey("amount")) {
                    throw new IllegalArgumentException(
                            "CSV must contain at least 'date', 'source', and 'amount' headers. Found: " + col.keySet());
                }
                cols[0] = col.get("date");
                cols[1] = col.get(COL_SOURCE);
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
                String sourceStr = TabularImportSupport.cleanCsvToken(parts, cols[1]);
                String amtStr = TabularImportSupport.cleanCsvToken(parts, cols[2]).replaceAll("[^0-9.\\-]", "");
                String desc = cols[3] >= 0 ? TabularImportSupport.cleanCsvToken(parts, cols[3]) : "";

                if (dateStr.isEmpty() || sourceStr.isEmpty() || amtStr.isEmpty()) {
                    rowErrors.add("Row " + rowNum + ": date, source, or amount is empty.");
                    return;
                }

                requestsToSave.add(new IncomeRequest(
                        new BigDecimal(amtStr),
                        sourceStr,
                        desc.isEmpty() ? sourceStr : desc,
                        ImportParsingSupport.parseDateString(dateStr),
                        false));
            }, rowErrors);
        } catch (Exception e) {
            if (e instanceof IllegalArgumentException iae) {
                throw iae;
            }
            log.error("Failed to read income CSV file for user {}", user.getId(), e);
            throw new ImportException("Failed to read CSV file: " + e.getMessage(), e);
        }

        if (!requestsToSave.isEmpty()) {
            incomeService.createIncomes(requestsToSave, user);
        }
        return TabularImportSupport.finalizeTabularResult(
                requestsToSave.size(), rowErrors,
                "CSV file contains no income data rows to import",
                "Failed to import incomes:",
                "income record", "income records");
    }

    @Override
    @Transactional
    public Map<String, Object> importIncomesFromJson(MultipartFile file, User user) {
        TabularImportSupport.validateUpload(file, user);

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
                requestsToSave.add(new IncomeRequest(
                        dto.amount(),
                        dto.source(),
                        dto.description(),
                        dto.incomeDate() != null ? dto.incomeDate() : LocalDate.now(),
                        Boolean.TRUE.equals(dto.isRecurring())));
            }

            incomeService.createIncomes(requestsToSave, user);
            return TabularImportSupport.jsonResult(requestsToSave.size(), "income records");
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
        TabularImportSupport.validateUpload(file, user);

        List<String> errors = new ArrayList<>();
        List<IncomeRequest> requestsToSave = new ArrayList<>();
        Integer[] cols = new Integer[5]; // dateCol, srcCol, amtCol, descCol, recCol

        try {
            TabularImportSupport.readExcelRows(file, "Incomes", colMap -> {
                cols[0] = ImportParsingSupport.findColumn(colMap, "date", "incomedate", "transactiondate");
                cols[1] = ImportParsingSupport.findColumn(colMap, COL_SOURCE, "incomesource", "channel", "payer");
                cols[2] = ImportParsingSupport.findColumn(colMap, "amount", "income", "earnings", "sum");
                cols[3] = ImportParsingSupport.findColumn(colMap, "description", "desc", "note", "notes");
                cols[4] = ImportParsingSupport.findColumn(colMap, "recurring", "isrecurring");
                if (cols[0] == null || cols[1] == null || cols[2] == null) {
                    throw new IllegalArgumentException(
                            "Excel sheet must contain at least: Date, Source, and Amount headers. Found: "
                                    + colMap.keySet());
                }
            }, (rowNum, row) -> {
                LocalDate date = ImportParsingSupport.parseDateCell(row.getCell(cols[0]));
                String sourceStr = ImportParsingSupport.getCellValueAsString(row.getCell(cols[1])).trim();
                if (sourceStr.isBlank()) {
                    throw new IllegalArgumentException("Source cannot be blank");
                }
                BigDecimal amount = ImportParsingSupport.parseCellAmount(row.getCell(cols[2]));
                if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Amount must be greater than zero");
                }
                String description = cols[3] != null
                        ? ImportParsingSupport.getCellValueAsString(row.getCell(cols[3])).trim()
                        : "";
                boolean isRecurring = false;
                if (cols[4] != null) {
                    String recVal = ImportParsingSupport.getCellValueAsString(row.getCell(cols[4]))
                            .trim().toLowerCase(Locale.ROOT);
                    isRecurring = recVal.equals("true") || recVal.equals("yes") || recVal.equals("1");
                }

                requestsToSave.add(new IncomeRequest(
                        amount,
                        sourceStr,
                        description.isBlank() ? sourceStr : description,
                        date,
                        isRecurring));
            }, errors);
        } catch (Exception e) {
            if (e instanceof IllegalArgumentException iae) {
                throw iae;
            }
            log.error("Failed to parse Excel file for incomes", e);
            throw new ImportException("Failed to read Excel workbook: " + e.getMessage(), e);
        }

        if (!requestsToSave.isEmpty()) {
            incomeService.createIncomes(requestsToSave, user);
        }
        return TabularImportSupport.finalizeTabularResult(
                requestsToSave.size(), errors,
                "Excel sheet contains no income data rows to import",
                "Failed to import incomes:",
                "income record", "income records");
    }
}
