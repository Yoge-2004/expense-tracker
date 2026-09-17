package com.example.expensetracker.controller;

import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.MonthlyReportService;
import com.example.expensetracker.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
        controllers = ReportController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class ReportControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private MonthlyReportService monthlyReportService;
    @MockitoBean private ExportService exportService;
    @MockitoBean private UserService userService;
    @MockitoBean private UserSecurity userSecurity;
    @MockitoBean private RangeReportController rangeReportController;
    @MockitoBean private JwtService jwtService;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    private MonthlyReportDto createSampleReportDto(int year, int month) {
        return new MonthlyReportDto(
                year + "-" + month,
                year,
                month,
                new BigDecimal("2000.00"),
                new BigDecimal("5000.00"),
                new BigDecimal("3000.00"),
                60.0,
                "INR",
                12,
                new BigDecimal("66.67"),
                new BigDecimal("500.00"),
                "Groceries",
                new BigDecimal("100.00"),
                Collections.singletonList("Great savings rate!"),
                90,
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList()
        );
    }

    @Test
    @DisplayName("GET /api/reports/monthly/user/{userId} returns monthly report JSON")
    void testGetMonthlyReportJson() throws Exception {
        MonthlyReportDto dto = createSampleReportDto(2026, 9);

        when(monthlyReportService.generateMonthlyReport(eq(1L), eq(2026), eq(9)))
                .thenReturn(dto);

        mockMvc.perform(get("/api/reports/monthly/user/1")
                        .param("year", "2026")
                        .param("month", "9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.year").value(2026))
                .andExpect(jsonPath("$.month").value(9))
                .andExpect(jsonPath("$.totalIncome").value(5000.00))
                .andExpect(jsonPath("$.totalOutflow").value(2000.00))
                .andExpect(jsonPath("$.netCashFlow").value(3000.00))
                .andExpect(jsonPath("$.savingsRate").value(60.0));

        verify(userSecurity).validateUserAccess(1L);
        verify(monthlyReportService).generateMonthlyReport(1L, 2026, 9);
    }

    @Test
    @DisplayName("GET /api/reports/monthly/user/{userId} defaults to current year and month when omitted")
    void testGetMonthlyReportJson_DefaultsCurrentDate() throws Exception {
        LocalDate now = LocalDate.now();
        MonthlyReportDto dto = createSampleReportDto(now.getYear(), now.getMonthValue());

        when(monthlyReportService.generateMonthlyReport(eq(1L), eq(now.getYear()), eq(now.getMonthValue())))
                .thenReturn(dto);

        mockMvc.perform(get("/api/reports/monthly/user/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.year").value(now.getYear()))
                .andExpect(jsonPath("$.month").value(now.getMonthValue()));

        verify(userSecurity).validateUserAccess(1L);
    }

    @Test
    @DisplayName("GET /api/reports/monthly/user/{userId}/html returns rendered HTML report")
    void testGetMonthlyReportHtml() throws Exception {
        String htmlContent = "<!DOCTYPE html><html><body>Report for User 1</body></html>";
        when(monthlyReportService.generateMonthlyReportHtml(eq(1L), eq(2026), eq(9)))
                .thenReturn(htmlContent);

        mockMvc.perform(get("/api/reports/monthly/user/1/html")
                        .param("year", "2026")
                        .param("month", "9"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"financial-report-2026-9.html\""))
                .andExpect(content().string(htmlContent));

        verify(userSecurity).validateUserAccess(1L);
    }

    @Test
    @DisplayName("POST /api/reports/monthly/user/{userId}/send-email triggers monthly report delivery")
    void testSendMonthlyReportEmail() throws Exception {
        mockMvc.perform(post("/api/reports/monthly/user/1/send-email")
                        .param("year", "2026")
                        .param("month", "9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Monthly report email successfully sent."));

        verify(userSecurity).validateUserAccess(1L);
        verify(monthlyReportService).sendMonthlyReportEmail(1L, 2026, 9);
    }

    @Test
    @DisplayName("GET /api/reports/user/{userId}/export/excel delegates to range report controller")
    void testExportExcel() throws Exception {
        byte[] dummyBytes = "DummyExcelData".getBytes();
        ResponseEntity<byte[]> mockResponse = ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"ExpenseTracker_Executive_Dashboard.xlsx\"")
                .body(dummyBytes);

        when(rangeReportController.excel(eq(1L), isNull(), isNull(), eq("INR")))
                .thenReturn(mockResponse);

        mockMvc.perform(get("/api/reports/user/1/export/excel"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"financial-summary.xlsx\""))
                .andExpect(content().bytes(dummyBytes));

        verify(rangeReportController).excel(1L, null, null, "INR");
    }

    @Test
    @DisplayName("GET /api/reports/user/{userId}/export/pdf delegates to range report controller with currency param")
    void testExportPdf() throws Exception {
        byte[] dummyPdfBytes = "%PDF-1.4 DummyPdf".getBytes();
        ResponseEntity<byte[]> mockResponse = ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"ExpenseTracker_Executive_Report.pdf\"")
                .body(dummyPdfBytes);

        when(rangeReportController.pdf(eq(1L), isNull(), isNull(), eq("USD")))
                .thenReturn(mockResponse);

        mockMvc.perform(get("/api/reports/user/1/export/pdf")
                        .param("currency", "USD"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"financial-statement.pdf\""))
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(content().bytes(dummyPdfBytes));

        verify(rangeReportController).pdf(1L, null, null, "USD");
    }
}
