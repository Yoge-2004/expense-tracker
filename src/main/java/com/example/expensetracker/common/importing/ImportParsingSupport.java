package com.example.expensetracker.common.importing;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import java.io.BufferedReader;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared parsing and data normalization utilities for batch imports (CSV, Excel, JSON).
 * Centralizes low-level tokenization, RFC-4180 multiline CSV record reading, cell extraction,
 * strict date parsing, and bank narration sanitization without domain coupling.
 *
 * @author Yogeshwaran
 */
public final class ImportParsingSupport {

    private ImportParsingSupport() {}

    private static final Pattern UPI_PATTERN = Pattern.compile("(?i)UPI(?:/[^/]+)?/([^/]+)/.*");
    private static final Pattern POS_PATTERN = Pattern.compile("(?i)POS(?:\\s+[0-9X*]+)?\\s+([A-Za-z0-9\\s&.'-]+)");
    private static final Pattern NEFT_PATTERN = Pattern.compile("(?i)(?:NEFT|RTGS|IMPS)(?:\\s*CR|\\s*DR)?(?:[-/:]\\s*|\\s+)([A-Za-z0-9\\s&.'-]+)");

    private static DateTimeFormatter strictFormatter(String pattern) {
        return DateTimeFormatter.ofPattern(pattern).withResolverStyle(ResolverStyle.STRICT);
    }

    private static final DateTimeFormatter DD_MM_SLASH = strictFormatter("dd/MM/uuuu");
    private static final DateTimeFormatter MM_DD_SLASH = strictFormatter("MM/dd/uuuu");

    private static final List<DateTimeFormatter> NON_COLLIDING_FORMATTERS = List.of(
            strictFormatter("dd-MM-uuuu"),
            strictFormatter("uuuu/MM/dd"),
            strictFormatter("dd-MMM-uuuu"),
            strictFormatter("dd-MMM-uu"),
            strictFormatter("d-MMM-uuuu"),
            strictFormatter("d-MMM-uu"),
            strictFormatter("dd/MMM/uuuu"),
            strictFormatter("dd/MMM/uu"),
            strictFormatter("d/M/uuuu"),
            strictFormatter("d-M/uuuu".replace('/', '-')),
            strictFormatter("dd.MM.uuuu")
    );

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
            m = m.replaceFirst("(?i)^[A-Z0-9]{8,15}[-/:]?\\s*", "");
            m = m.replace('-', ' ').replace('_', ' ').replaceAll("\\s{2,}", " ").trim();
            if (!m.isBlank()) {
                return m;
            }
        }

        clean = clean.replaceFirst("(?i)^(?:UPI/|POS|NEFT|RTGS|IMPS|ACH|BIL/|INF/|INB/|CMS/|TXN:?)\\s*", "");
        clean = clean.replaceAll("(?i)\\b(?:DR|CR|REF|UTR|RRN|TXN|NO|MB|BRN)[0-9A-Z]{6,}\\b", "");
        clean = clean.replaceAll("\\s{2,}", " ").trim();

        return clean.isEmpty() ? "Bank Transaction" : clean;
    }

    public static LocalDate parseDateString(String fallbackStr) {
        String s = fallbackStr.trim();

        LocalDate isoResult = tryParseDate(s, DateTimeFormatter.ISO_LOCAL_DATE);
        if (isoResult != null) {
            return isoResult;
        }

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

    private static LocalDate tryParseDate(String s, DateTimeFormatter fmt) {
        try {
            return LocalDate.parse(s, fmt);
        } catch (DateTimeParseException _) {
            return null;
        }
    }

    public static LocalDate parseDateCell(Cell cell) {
        if (cell == null) {
            return null;
        }
        if (DateUtil.isCellDateFormatted(cell)) {
            Date d = cell.getDateCellValue();
            return d == null ? null : d.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        String fallbackStr = getCellValueAsString(cell).trim();
        if (fallbackStr.isEmpty()) {
            return null;
        }
        return parseDateString(fallbackStr);
    }

    /**
     * Reads one logical CSV record from {@code reader}, spanning multiple physical lines when
     * an RFC-4180 quoted field contains embedded line breaks. Strips a leading UTF-8 BOM if present.
     *
     * @param reader buffered CSV character stream
     * @return next complete logical CSV record, or {@code null} on EOF
     * @throws IOException if an I/O error occurs reading from {@code reader}
     */
    public static String readCsvRecord(BufferedReader reader) throws IOException {
        String line = reader.readLine();
        if (line == null) {
            return null;
        }
        if (!line.isEmpty() && line.charAt(0) == '\uFEFF') {
            line = line.substring(1);
        }
        if (!hasUnclosedQuotes(line)) {
            return line;
        }
        StringBuilder record = new StringBuilder(line);
        String continuation;
        while (hasUnclosedQuotes(record) && (continuation = reader.readLine()) != null) {
            record.append('\n').append(continuation);
        }
        return record.toString();
    }

    private static boolean hasUnclosedQuotes(CharSequence text) {
        boolean inQuotes = false;
        int len = text.length();
        for (int i = 0; i < len; i++) {
            if (text.charAt(i) == '"') {
                if (inQuotes && i + 1 < len && text.charAt(i + 1) == '"') {
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            }
        }
        return inQuotes;
    }

    public static List<String> parseCsvLine(String line) {
        List<String> tokens = new ArrayList<>();
        if (line == null) {
            return tokens;
        }
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"');
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

    public static Map<String, Integer> parseHeader(String headerLine) {
        Map<String, Integer> col = new HashMap<>();
        List<String> headers = parseCsvLine(headerLine);
        for (int i = 0; i < headers.size(); i++) {
            String name = headers.get(i).replace("\"", "").trim().toLowerCase(Locale.ROOT);
            col.put(name, i);
        }
        return col;
    }

    public static Integer findColumn(Map<String, Integer> colMap, String... candidates) {
        for (String c : candidates) {
            if (colMap.containsKey(c)) {
                return colMap.get(c);
            }
        }
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

    public static String getCellValueAsString(Cell cell) {
        if (cell == null) {
            return "";
        }
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    yield cell.getLocalDateTimeCellValue().toLocalDate().toString();
                }
                double num = cell.getNumericCellValue();
                if (num == Math.floor(num)) {
                    yield String.valueOf((long) num);
                }
                yield String.valueOf(num);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield cell.getStringCellValue().trim();
                } catch (Exception _) {
                    try {
                        double num = cell.getNumericCellValue();
                        if (num == Math.floor(num)) {
                            yield String.valueOf((long) num);
                        }
                        yield String.valueOf(num);
                    } catch (Exception _) {
                        yield "";
                    }
                }
            }
            default -> "";
        };
    }

    public static BigDecimal parseCellAmount(Cell cell) {
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
                } catch (Exception _) {
                    try {
                        String clean = cell.getStringCellValue().replaceAll("[^0-9.\\-]", "").trim();
                        yield clean.isEmpty() ? null : new BigDecimal(clean);
                    } catch (Exception _) {
                        yield null;
                    }
                }
            }
            default -> null;
        };
    }

    public static boolean isRowEmpty(Row row) {
        for (Cell c : row) {
            if (!getCellValueAsString(c).isBlank()) {
                return false;
            }
        }
        return true;
    }
}
