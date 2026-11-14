package com.example.expensetracker.repository;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SearchPatternsTest {

    @Test
    void emptyInputNeverProducesANullPattern() {
        for (String empty : new String[] {null, "", "   ", "\t"}) {
            assertFalse(SearchPatterns.hasText(empty));
            assertNotNull(SearchPatterns.contains(empty), "a null pattern is what reached PostgreSQL as bytea");
            assertEquals("%", SearchPatterns.contains(empty));
        }
    }

    @Test
    void textBecomesATrimmedLowerCaseContainsPattern() {
        assertTrue(SearchPatterns.hasText("  Jane "));
        assertEquals("%jane%", SearchPatterns.contains("  Jane "));
        assertEquals("%a@b.com%", SearchPatterns.contains("A@B.com"));
    }
}
