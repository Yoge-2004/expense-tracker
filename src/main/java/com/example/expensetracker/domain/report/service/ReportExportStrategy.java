package com.example.expensetracker.domain.report.service;

import org.springframework.http.MediaType;

/**
 * Strategy contract for generating range-based executive financial reports.
 * <p>
 * Enforces the Open/Closed Principle (OCP): new export formats (e.g. CSV, JSON, Markdown, HTML)
 * can be plugged in by creating a new spring-managed {@link ReportExportStrategy} component
 * without modifying the report controller or orchestration services.
 * </p>
 */
public interface ReportExportStrategy {

    /**
     * The unique identifier for this export format (e.g. "excel", "xlsx", "pdf", "csv").
     */
    String format();

    /**
     * HTTP response media type for the generated document.
     */
    MediaType mediaType();

    /**
     * Standard attachment filename for the generated document.
     */
    String filename(ExecutiveReportDateRange range);

    /**
     * Renders report data into byte array payload.
     *
     * @param data     aggregated executive financial dataset
     * @param range    date range filter
     * @param currency 3-letter ISO currency code
     * @param userName display name of the user requesting the report
     * @return rendered document bytes
     */
    byte[] generate(ExecutiveReportData data, ExecutiveReportDateRange range, String currency, String userName);
}
