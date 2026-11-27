package com.example.expensetracker.common;

/**
 * Extension of {@link DocumentExporter} for renderers that support caller-specified
 * currency formatting overrides.
 *
 * <p>Allows export services to depend on an abstraction rather than concrete PDF or Excel
 * generator classes (Dependency Inversion Principle).</p>
 *
 * @param <U> the owner/subject context type
 * @param <T> the payload type being exported
 */
public interface CurrencyAwareDocumentExporter<U, T> extends DocumentExporter<U, T> {

    /**
     * Exports the given payload using an optional currency display override.
     *
     * @param owner             the owner context of the exported records
     * @param preferredCurrency optional ISO 4217 currency code override (may be {@code null})
     * @param data              the collection or payload of records
     * @return rendered document byte array
     */
    byte[] export(U owner, String preferredCurrency, T data);

    @Override
    default byte[] export(U owner, T data) {
        return export(owner, null, data);
    }
}
