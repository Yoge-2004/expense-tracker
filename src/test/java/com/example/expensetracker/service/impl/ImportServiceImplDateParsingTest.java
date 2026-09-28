package com.example.expensetracker.service.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link ImportServiceImpl#parseDateString(String)} — the string
 * fallback used for Excel date cells that aren't natively date-formatted.
 *
 * <p>Two real defects motivated this suite:</p>
 * <ol>
 *   <li><b>Silent day/month swap.</b> "dd/MM/yyyy" was tried before
 *   "MM/dd/yyyy" and the first match won, so "03/04/2026" always became
 *   3 April even when the sheet meant 4 March.</li>
 *   <li><b>Silent day clamping.</b> DateTimeFormatter.ofPattern defaults to the
 *   SMART resolver, which clamps an out-of-range day-of-month to the last
 *   valid day, so "31/04/2026" imported as 30 April.</li>
 * </ol>
 */
class ImportServiceImplDateParsingTest {

    private static LocalDate parse(String s) {
        return ImportServiceImpl.parseDateString(s);
    }

    @Nested
    @DisplayName("ISO-8601 (always unambiguous)")
    class IsoTests {

        @Test
        @DisplayName("2026-04-03 parses as 3 April 2026")
        void isoParses() {
            assertEquals(LocalDate.of(2026, 4, 3), parse("2026-04-03"));
        }

        @Test
        @DisplayName("surrounding spaces, tabs and newlines are trimmed")
        void surroundingWhitespaceTrimmed() {
            assertEquals(LocalDate.of(2026, 4, 3), parse("  2026-04-03  "));
            assertEquals(LocalDate.of(2026, 4, 3), parse("\t2026-04-03\n"));
        }

        @Test
        @DisplayName("an impossible ISO day (2026-02-30) is rejected, never clamped")
        void impossibleIsoDayRejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("2026-02-30"));
        }

        @Test
        @DisplayName("month 13 is rejected")
        void month13Rejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("2026-13-01"));
        }
    }

    @Nested
    @DisplayName("ambiguous dd/MM vs MM/dd — must be refused, not guessed")
    class AmbiguityTests {

        @Test
        @DisplayName("03/04/2026 (3 April or 4 March) throws instead of silently choosing")
        void ambiguousDateThrows() {
            IllegalArgumentException ex =
                    assertThrows(IllegalArgumentException.class, () -> parse("03/04/2026"));
            assertTrue(ex.getMessage().contains("Ambiguous date '03/04/2026'"), ex.getMessage());
        }

        @Test
        @DisplayName("the error names BOTH candidate dates so the user can see what the conflict is")
        void ambiguityMessageNamesBothReadings() {
            IllegalArgumentException ex =
                    assertThrows(IllegalArgumentException.class, () -> parse("03/04/2026"));
            assertTrue(ex.getMessage().contains("2026-04-03"), ex.getMessage());
            assertTrue(ex.getMessage().contains("2026-03-04"), ex.getMessage());
            assertTrue(ex.getMessage().contains("YYYY-MM-DD"), ex.getMessage());
        }

        @Test
        @DisplayName("surrounding whitespace doesn't hide the ambiguity")
        void whitespaceDoesNotHideAmbiguity() {
            assertThrows(IllegalArgumentException.class, () -> parse(" 03/04/2026 "));
        }

        @Test
        @DisplayName("12/01/2026 and 01/12/2026 are both ambiguous (boundary: day and month both <= 12)")
        void boundaryTwelveIsAmbiguous() {
            assertThrows(IllegalArgumentException.class, () -> parse("12/01/2026"));
            assertThrows(IllegalArgumentException.class, () -> parse("01/12/2026"));
        }

        @Test
        @DisplayName("12/12/2026 is NOT ambiguous — both readings give the same date")
        void identicalReadingsAreNotAmbiguous() {
            assertEquals(LocalDate.of(2026, 12, 12), parse("12/12/2026"));
            assertEquals(LocalDate.of(2026, 1, 1), parse("01/01/2026"));
        }
    }

    @Nested
    @DisplayName("slash dates where only one reading is valid")
    class UnambiguousSlashTests {

        @Test
        @DisplayName("13/01/2026 — only day-first is valid (month 13 doesn't exist)")
        void day13IsDayFirst() {
            assertEquals(LocalDate.of(2026, 1, 13), parse("13/01/2026"));
        }

        @Test
        @DisplayName("01/13/2026 — only month-first is valid")
        void secondComponent13IsMonthFirst() {
            assertEquals(LocalDate.of(2026, 1, 13), parse("01/13/2026"));
        }

        @Test
        @DisplayName("25/04/2026 and 04/25/2026 both resolve to 25 April")
        void bothOrdersOfUnambiguousDate() {
            assertEquals(LocalDate.of(2026, 4, 25), parse("25/04/2026"));
            assertEquals(LocalDate.of(2026, 4, 25), parse("04/25/2026"));
        }

        @Test
        @DisplayName("31/01/2026 and 01/31/2026 resolve to 31 January")
        void day31Boundary() {
            assertEquals(LocalDate.of(2026, 1, 31), parse("31/01/2026"));
            assertEquals(LocalDate.of(2026, 1, 31), parse("01/31/2026"));
        }
    }

    @Nested
    @DisplayName("impossible calendar dates — rejected, never clamped (STRICT resolver)")
    class ImpossibleDateTests {

        @Test
        @DisplayName("31/04/2026 — April has 30 days; must not silently become 30 April")
        void april31Rejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("31/04/2026"));
        }

        @Test
        @DisplayName("30/02/2026 — must not silently become 28 February")
        void february30Rejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("30/02/2026"));
        }

        @Test
        @DisplayName("29/02/2025 — 2025 is not a leap year")
        void feb29InNonLeapYearRejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("29/02/2025"));
        }

        @Test
        @DisplayName("29/02/2028 — 2028 IS a leap year, so this is valid")
        void feb29InLeapYearAccepted() {
            assertEquals(LocalDate.of(2028, 2, 29), parse("29/02/2028"));
        }

        @Test
        @DisplayName("32/01/2026 — day 32 is rejected")
        void day32Rejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("32/01/2026"));
        }

        @Test
        @DisplayName("00/01/2026 — day 0 is rejected")
        void day0Rejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("00/01/2026"));
        }

        @Test
        @DisplayName("31-04-2026 (dash form) — also rejected, not clamped")
        void dashApril31Rejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("31-04-2026"));
        }
    }

    @Nested
    @DisplayName("other supported formats")
    class OtherFormatTests {

        @Test
        @DisplayName("single-digit day/month with slashes is day-first: 3/4/2026 = 3 April")
        void singleDigitSlashDayFirst() {
            assertEquals(LocalDate.of(2026, 4, 3), parse("3/4/2026"));
        }

        @Test
        @DisplayName("mixed width 3/04/2026 = 3 April")
        void mixedWidth() {
            assertEquals(LocalDate.of(2026, 4, 3), parse("3/04/2026"));
        }

        @Test
        @DisplayName("dd-MM-yyyy: 25-04-2026")
        void dashDayFirst() {
            assertEquals(LocalDate.of(2026, 4, 25), parse("25-04-2026"));
        }

        @Test
        @DisplayName("d-M-yyyy: 5-4-2026")
        void dashSingleDigit() {
            assertEquals(LocalDate.of(2026, 4, 5), parse("5-4-2026"));
        }

        @Test
        @DisplayName("yyyy/MM/dd: 2026/04/25")
        void yearFirstSlash() {
            assertEquals(LocalDate.of(2026, 4, 25), parse("2026/04/25"));
        }

        @Test
        @DisplayName("dd.MM.yyyy: 25.04.2026")
        void dotSeparated() {
            assertEquals(LocalDate.of(2026, 4, 25), parse("25.04.2026"));
        }
    }

    @Nested
    @DisplayName("garbage input")
    class GarbageTests {

        @Test
        @DisplayName("empty string is rejected with 'Unrecognised date format'")
        void emptyRejected() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> parse(""));
            assertTrue(ex.getMessage().startsWith("Unrecognised date format"), ex.getMessage());
        }

        @Test
        @DisplayName("whitespace-only is rejected")
        void whitespaceOnlyRejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("   "));
        }

        @Test
        @DisplayName("free text is rejected")
        void freeTextRejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("not-a-date"));
        }

        @Test
        @DisplayName("a two-digit year (03/04/26) is rejected — the year needs 4 digits")
        void twoDigitYearRejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("03/04/26"));
        }

        @Test
        @DisplayName("mixed separators (03/04-2026) are rejected")
        void mixedSeparatorsRejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("03/04-2026"));
        }

        @Test
        @DisplayName("full-width digits are rejected — only ASCII 0-9 are recognised")
        void fullWidthDigitsRejected() {
            assertThrows(IllegalArgumentException.class,
                    () -> parse("\uFF10\uFF13/\uFF10\uFF14/\uFF12\uFF10\uFF12\uFF16"));
        }

        @Test
        @DisplayName("a trailing extra character (25/04/2026x) is rejected")
        void trailingGarbageRejected() {
            assertThrows(IllegalArgumentException.class, () -> parse("25/04/2026x"));
        }
    }
}
