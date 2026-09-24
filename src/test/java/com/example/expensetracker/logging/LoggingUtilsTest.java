package com.example.expensetracker.logging;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LoggingUtilsTest {

    @Test
    @DisplayName("maskEmail masks local part preserving first and last letter")
    void maskEmail_standardEmail() {
        assertEquals("j***e@example.com", LoggingUtils.maskEmail("john.doe@example.com"));
    }

    @Test
    @DisplayName("maskEmail handles short email local parts gracefully")
    void maskEmail_shortEmail() {
        assertEquals("a***@example.com", LoggingUtils.maskEmail("ab@example.com"));
        assertEquals("***@example.com", LoggingUtils.maskEmail("a@example.com"));
    }

    @Test
    @DisplayName("maskEmail returns [empty] for null or blank input")
    void maskEmail_emptyEmail() {
        assertEquals("[empty]", LoggingUtils.maskEmail(null));
        assertEquals("[empty]", LoggingUtils.maskEmail("   "));
    }

    @Test
    @DisplayName("sanitize strips carriage returns and line feeds to prevent log injection")
    void sanitize_stripsNewlines() {
        assertEquals("User admin_LOGGED_IN", LoggingUtils.sanitize("User admin\r\nLOGGED_IN"));
        assertEquals("", LoggingUtils.sanitize(null));
    }
}
