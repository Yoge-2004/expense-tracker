package com.example.expensetracker.common;

/**
 * Strategy interface for document and dataset exporters.
 *
 * <p>Enforces the Open/Closed Principle (OCP) by allowing new document formats
 * (e.g. Parquet, XML, TSV) to be added without modifying existing core service classes.</p>
 *
 * @param <U> the type representing the owner/subject context
 * @param <T> the type of data or entity being exported
 * @author Yogeshwaran
 */
public interface DocumentExporter<U, T> {

    /**
     * Identifies the format supported by this exporter strategy.
     *
     * @return the string identifier (e.g. "CSV", "JSON", "PDF", "EXCEL")
     */
    String getFormat();

    /**
     * Determines whether this strategy can export data for the given domain type and target format.
     *
     * @param targetFormat the requested format
     * @return true if supported
     */
    default boolean supports(String targetFormat) {
        return getFormat() != null && getFormat().equalsIgnoreCase(targetFormat);
    }

    /**
     * Exports the data payload into raw binary or textual bytes.
     *
     * @param owner the owner context of the exported records
     * @param data  the collection or payload of records
     * @return generated document byte array
     */
    byte[] export(U owner, T data);
}
