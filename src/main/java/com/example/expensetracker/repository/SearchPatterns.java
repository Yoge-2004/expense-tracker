package com.example.expensetracker.repository;

import java.util.Locale;

/**
 * Builds the LIKE pattern for the admin search queries.
 *
 * The queries used to say {@code (:query IS NULL OR LOWER(x) LIKE LOWER(CONCAT('%', :query, '%')))} and were
 * called with a null when the search box was empty. When Hibernate cannot ask the database which type a null
 * parameter has (behind a connection wrapper or Neon's pooler, for example) it sends the null as {@code bytea},
 * and PostgreSQL then fails with "function lower(bytea) does not exist". So these queries now take a pattern that
 * is NEVER null, plus a boolean saying whether a filter applies at all.
 */
final class SearchPatterns {

    private SearchPatterns() {}

    /** True when there is some text to search for. */
    static boolean hasText(String query) {
        return query != null && !query.isBlank();
    }

    /** {@code %text%}, lower-cased, or just {@code %} when there is nothing to search for. Never null. */
    static String contains(String query) {
        return hasText(query) ? "%" + query.trim().toLowerCase(Locale.ROOT) + "%" : "%";
    }
}
