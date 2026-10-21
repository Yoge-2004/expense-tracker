package com.example.expensetracker.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("AppVersion")
class AppVersionTest {

    @Test
    @DisplayName("a later version is newer, the same or an earlier one is not")
    void comparesVersions() {
        assertTrue(AppVersion.isNewer("1.0.4", "1.0.5"));
        assertFalse(AppVersion.isNewer("1.0.5", "1.0.5"));
        assertFalse(AppVersion.isNewer("1.0.5", "1.0.4"));
    }

    @Test
    @DisplayName("compares numbers, not text, so 1.10.0 is later than 1.9.9")
    void comparesNumerically() {
        assertTrue(AppVersion.isNewer("1.9.9", "1.10.0"));
        assertTrue(AppVersion.isNewer("1.9.9", "2.0.0"));
        assertFalse(AppVersion.isNewer("2.0.0", "1.99.99"));
    }

    @Test
    @DisplayName("ignores a leading v and a pre-release suffix, and treats missing parts as zero")
    void toleratesCommonFormats() {
        assertTrue(AppVersion.isNewer("1.0.4", "v1.0.5"));
        assertTrue(AppVersion.isNewer("v1.0.4", "1.0.5-beta"));
        assertFalse(AppVersion.isNewer("1.0", "1.0.0"));
        assertTrue(AppVersion.isNewer("1", "1.0.1"));
    }

    @Test
    @DisplayName("text that is not a version never counts as newer")
    void malformedIsNeverNewer() {
        assertFalse(AppVersion.isNewer("1.0.4", "latest"));
        assertFalse(AppVersion.isNewer("1.0.4", null));
        assertFalse(AppVersion.isNewer(null, "1.0.5"));
        assertFalse(AppVersion.isNewer("junk", "1.0.5"));
        assertFalse(AppVersion.isValid(""));
        assertTrue(AppVersion.isValid("v2.1"));
    }
}
