package com.example.expensetracker.service.report;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * Encapsulates a reporting date window with parse validation and containment logic.
 */
public record ExecutiveReportDateRange(LocalDate from, LocalDate to) {

    public static ExecutiveReportDateRange of(String from, String to) {
        LocalDate start;
        LocalDate end;
        try {
            start = from == null || from.isBlank() ? null : LocalDate.parse(from);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(
                    "Invalid 'from' date format: '" + from + "'. Expected format: yyyy-MM-dd", e);
        }
        try {
            end = to == null || to.isBlank() ? null : LocalDate.parse(to);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(
                    "Invalid 'to' date format: '" + to + "'. Expected format: yyyy-MM-dd", e);
        }
        if (start != null && end != null && end.isBefore(start)) {
            throw new IllegalArgumentException("End date must be on or after start date.");
        }
        return new ExecutiveReportDateRange(start, end);
    }

    public boolean contains(LocalDate date) {
        return date != null
                && (from == null || !date.isBefore(from))
                && (to == null || !date.isAfter(to));
    }

    public String label() {
        if (from == null && to == null) return "All time";
        if (from == null) return "Through " + to;
        if (to == null) return "From " + from;
        return from + " to " + to;
    }
}
