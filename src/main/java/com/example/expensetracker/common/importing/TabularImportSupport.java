package com.example.expensetracker.common.importing;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * Shared tabular import orchestration helpers for CSV and Excel batch ingestion.
 * Eliminates duplicated upload validation, header mapping, multiline CSV streaming,
 * Excel sheet scanning, and import summary construction across domain importers.
 */
public final class TabularImportSupport {

    private TabularImportSupport() {}

    /**
     * Validates that both user context and uploaded multipart file are present and non-empty.
     *
     * @param file uploaded file
     * @param user caller user context
     */
    public static void validateUpload(MultipartFile file, Object user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
    }

    /**
     * Streams logical CSV records (preserving quoted multiline fields), validates headers via {@code headerResolver},
     * and dispatches each non-blank row to {@code rowConsumer} while collecting per-row error messages.
     *
     * @param file           uploaded CSV file
     * @param headerResolver resolves column index mapping and throws {@link IllegalArgumentException} on missing headers
     * @param rowConsumer    parses a logical CSV row into the domain buffer
     * @param errors         accumulator for row-level parse/validation errors
     * @throws IOException if the underlying stream fails to open or read
     */
    public static void readCsvRows(MultipartFile file,
                                   Consumer<Map<String, Integer>> headerResolver,
                                   CsvRowConsumer rowConsumer,
                                   List<String> errors) throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String headerLine = ImportParsingSupport.readCsvRecord(reader);
            if (headerLine == null || headerLine.isBlank()) {
                throw new IllegalArgumentException("CSV file is empty — no header row found");
            }
            Map<String, Integer> columns = ImportParsingSupport.parseHeader(headerLine);
            headerResolver.accept(columns);

            String record;
            int rowNum = 1;
            while ((record = ImportParsingSupport.readCsvRecord(reader)) != null) {
                rowNum++;
                if (record.isBlank()) {
                    continue;
                }
                try {
                    List<String> parts = ImportParsingSupport.parseCsvLine(record);
                    rowConsumer.accept(rowNum, parts);
                } catch (Exception rowEx) {
                    errors.add("Row " + rowNum + ": " + rowEx.getMessage());
                }
            }
        }
    }

    /**
     * Opens the preferred Excel worksheet, extracts normalized header column indices, and dispatches
     * each non-empty data row to {@code rowConsumer} while collecting per-row error messages.
     *
     * @param file               uploaded Excel workbook
     * @param preferredSheetName preferred sheet name before falling back to index 0
     * @param headerResolver     resolves required column indices from header name map
     * @param rowConsumer        parses one Excel {@link Row}
     * @param errors             accumulator for row-level parse/validation errors
     * @throws IOException if opening or reading the workbook fails
     */
    public static void readExcelRows(MultipartFile file,
                                     String preferredSheetName,
                                     Consumer<Map<String, Integer>> headerResolver,
                                     ExcelRowConsumer rowConsumer,
                                     List<String> errors) throws IOException {
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = preferredSheetName != null ? workbook.getSheet(preferredSheetName) : null;
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
            headerResolver.accept(colMap);

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || ImportParsingSupport.isRowEmpty(row)) {
                    continue;
                }
                try {
                    rowConsumer.accept(r + 1, row);
                } catch (Exception ex) {
                    errors.add("Row " + (r + 1) + ": " + ex.getMessage());
                }
            }
        }
    }

    /**
     * Builds the standard CSV/Excel import response payload or throws when zero rows succeeded.
     *
     * @param count          number of persisted rows
     * @param errors         row-level failure messages
     * @param emptyMessage   exception message when both {@code count} and {@code errors} are empty
     * @param allFailedTitle prefix when {@code count == 0} and {@code errors} is non-empty
     * @param singularLabel  entity label for count == 1 (e.g. "expense", "income record")
     * @param pluralLabel    entity label for count != 1 (e.g. "expenses", "income records")
     * @return structured result map with {@code imported}, {@code failedRows}, {@code errors}, and {@code message}
     */
    public static Map<String, Object> finalizeTabularResult(int count,
                                                            List<String> errors,
                                                            String emptyMessage,
                                                            String allFailedTitle,
                                                            String singularLabel,
                                                            String pluralLabel) {
        if (count == 0) {
            if (errors.isEmpty()) {
                throw new IllegalArgumentException(emptyMessage);
            }
            throw new IllegalArgumentException(allFailedTitle + " all " + errors.size()
                    + " rows failed (" + String.join("; ", errors) + ")");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", count);
        result.put("failedRows", errors.size());
        result.put("errors", errors);
        result.put("message", "Imported " + count + " " + (count == 1 ? singularLabel : pluralLabel) + " successfully."
                + (errors.isEmpty() ? "" : " " + errors.size() + " row(s) failed — see 'errors'."));
        return result;
    }

    /**
     * Builds the standard JSON import summary map.
     *
     * @param count       number of persisted rows
     * @param pluralLabel plural entity label (e.g. "expenses", "income records")
     * @return map containing {@code imported} and {@code message}
     */
    public static Map<String, Object> jsonResult(int count, String pluralLabel) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", count);
        result.put("message", "Imported " + count + " " + pluralLabel + " successfully");
        return result;
    }

    /**
     * Extracts and trims a CSV cell token while rejecting missing/insufficient column counts cleanly.
     */
    public static String cleanCsvToken(List<String> parts, Integer idx) {
        if (idx == null || idx >= parts.size()) {
            return "";
        }
        return parts.get(idx).trim();
    }

    /**
     * Converts any non-{@link IllegalArgumentException} checked exception into a domain wrapper.
     */
    public static RuntimeException wrapUnexpected(Exception ex, Function<Exception, RuntimeException> wrapper) {
        if (ex instanceof IllegalArgumentException iae) {
            return iae;
        }
        return wrapper.apply(ex);
    }

    @FunctionalInterface
    public interface CsvRowConsumer {
        void accept(int rowNum, List<String> parts);
    }

    @FunctionalInterface
    public interface ExcelRowConsumer {
        void accept(int rowNum, Row row);
    }
}
