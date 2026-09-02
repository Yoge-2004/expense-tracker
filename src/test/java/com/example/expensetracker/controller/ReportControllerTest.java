package com.example.expensetracker.controller;

import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.model.User;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.MonthlyReportService;
import com.example.expensetracker.service.UserService;
import java.util.Optional;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ReportController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ReportController Tests")
class ReportControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private MonthlyReportService monthlyReportService;
    @MockitoBean private ExportService exportService;
    @MockitoBean private UserService userService;
    @MockitoBean private JwtService jwtService;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;
    @MockitoBean private JwtAuthenticationFilter jwtAuthenticationFilter;

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            jakarta.servlet.http.HttpServletRequest request = invocation.getArgument(0);
            jakarta.servlet.http.HttpServletResponse response = invocation.getArgument(1);
            jakarta.servlet.FilterChain chain = invocation.getArgument(2);
            chain.doFilter(request, response);
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/reports/monthly/user/{userId} → 200 OK with MonthlyReportDto")
    void getMonthlyReport_returns200() throws Exception {
        MonthlyReportDto report = new MonthlyReportDto();
        report.setPeriod("August 2026");
        report.setTotalOutflow(new BigDecimal("500.00"));
        report.setCurrency("INR");
        report.setTransactionCount(2);
        report.setCategoryBreakdown(Collections.emptyList());
        report.setBudgetStatuses(Collections.emptyList());
        report.setTopExpenses(Collections.emptyList());

        when(monthlyReportService.generateMonthlyReport(eq(1L), any(Integer.class), any(Integer.class)))
                .thenReturn(report);

        mockMvc.perform(get("/api/reports/monthly/user/1?year=2026&month=8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.period").value("August 2026"))
                .andExpect(jsonPath("$.totalOutflow").value(500.00))
                .andExpect(jsonPath("$.currency").value("INR"));
    }

    @Test
    @WithMockUser
    @DisplayName("POST /api/reports/monthly/user/{userId}/send-email → 200 OK on email trigger")
    void sendMonthlyReportEmail_returns200() throws Exception {
        mockMvc.perform(post("/api/reports/monthly/user/1/send-email?year=2026&month=8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Monthly report email successfully sent."));
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/reports/user/{userId}/export/excel → 200 OK")
    void exportFinancialStatementExcel_returns200() throws Exception {
        User user = new User();
        user.setId(1L);
        user.setName("Yogeshwaran");
        when(userService.findById(1L)).thenReturn(Optional.of(user));
        when(exportService.exportFinancialStatementExcel(user)).thenReturn("PK".getBytes());

        mockMvc.perform(get("/api/reports/user/1/export/excel"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"financial-summary.xlsx\""));
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/reports/user/{userId}/export/pdf → 200 OK")
    void exportFinancialStatementPdf_returns200() throws Exception {
        User user = new User();
        user.setId(1L);
        user.setName("Yogeshwaran");
        when(userService.findById(1L)).thenReturn(Optional.of(user));
        when(exportService.exportFinancialStatementPdf(user)).thenReturn("%PDF-1.4".getBytes());

        mockMvc.perform(get("/api/reports/user/1/export/pdf"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"financial-statement.pdf\""));
    }
}
