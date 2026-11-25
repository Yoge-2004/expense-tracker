package com.example.expensetracker.domain.report.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.expensetracker.domain.report.dto.MonthlyReportDto;
import java.math.BigDecimal;
import java.util.Collections;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("MonthlyHtmlReportGenerator output escaping")
class MonthlyHtmlReportGeneratorEscapingTest {

    private static MonthlyReportDto report(String period, String currency) {
        return new MonthlyReportDto(
                period, 2026, 11,
                new BigDecimal("2000.00"), new BigDecimal("5000.00"), new BigDecimal("3000.00"),
                60.0, currency, 12,
                new BigDecimal("66.67"), new BigDecimal("500.00"), "Groceries", new BigDecimal("100.00"),
                Collections.singletonList("Great savings rate!"), 90,
                Collections.emptyList(), Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList());
    }

    @Test
    @DisplayName("a display name containing markup is rendered as text, never as HTML")
    void userNameIsEscaped() {
        String payload = "<img src=x onerror=alert(1)>";

        String html = new MonthlyHtmlReportGenerator()
                .buildMonthlyReportHtml(payload, report("November 2026", "INR"));

        assertFalse(html.contains(payload), "the raw payload must not appear in the document");
        assertTrue(html.contains("&lt;img src=x onerror=alert(1)&gt;"), "it should appear HTML-escaped");
    }

    @Test
    @DisplayName("period and currency values are escaped as well")
    void periodAndCurrencyAreEscaped() {
        String html = new MonthlyHtmlReportGenerator()
                .buildMonthlyReportHtml("Asha", report("<script>1</script>", "<b>X</b>"));

        assertFalse(html.contains("<script>1</script>"));
        assertFalse(html.contains("<b>X</b>"));
    }

    @Test
    @DisplayName("a missing name falls back to a neutral label")
    void blankNameFallsBack() {
        String html = new MonthlyHtmlReportGenerator()
                .buildMonthlyReportHtml("  ", report("November 2026", "INR"));

        assertTrue(html.contains("User"));
    }
}
