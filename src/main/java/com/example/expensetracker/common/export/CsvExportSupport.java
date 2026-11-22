package com.example.expensetracker.common.export;

/** Shared CSV quoting and spreadsheet formula-injection protection. */
public final class CsvExportSupport {

    private CsvExportSupport() {}

    public static String quotedCell(String value) {
        String safeValue = value == null ? "" : value;
        if (!safeValue.isEmpty() && isFormulaPrefix(safeValue.charAt(0))) {
            safeValue = "'" + safeValue;
        }
        return '"' + safeValue.replace("\"", "\"\"") + '"';
    }

    private static boolean isFormulaPrefix(char value) {
        return value == '=' || value == '+' || value == '-' || value == '@'
                || value == '\t' || value == '\r' || value == '\n';
    }
}
