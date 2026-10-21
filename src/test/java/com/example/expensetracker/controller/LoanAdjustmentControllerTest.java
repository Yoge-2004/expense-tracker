package com.example.expensetracker.controller;

import com.example.expensetracker.dto.LoanAdjustmentDto;
import com.example.expensetracker.dto.LoanAdjustmentRequest;
import com.example.expensetracker.dto.LoanMetricsDto;
import com.example.expensetracker.model.LoanType;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.LoanAdjustmentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
        controllers = LoanAdjustmentController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class LoanAdjustmentControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean LoanAdjustmentService loanAdjustmentService;
    @MockitoBean UserSecurity userSecurity;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    @Test
    @DisplayName("getLoansForUser returns list of loans and adjustments")
    void getLoansForUser_returnsList() throws Exception {
        LoanAdjustmentDto dto = new LoanAdjustmentDto(
                1L, "Rahul", LoanType.LENT, new BigDecimal("1200.00"),
                LocalDate.of(2026, 10, 15), null, "Dinner", false, null, null
        );

        when(loanAdjustmentService.getLoansForUser(7L)).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/loans/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].counterparty").value("Rahul"))
                .andExpect(jsonPath("$[0].type").value("LENT"))
                .andExpect(jsonPath("$[0].amount").value(1200.00));

        verify(userSecurity).validateUserAccess(7L);
    }

    @Test
    @DisplayName("getLoanMetrics returns aggregated calculation metrics")
    void getLoanMetrics_returnsMetrics() throws Exception {
        LoanMetricsDto metrics = new LoanMetricsDto(
                new BigDecimal("5000.00"), new BigDecimal("2000.00"),
                new BigDecimal("3000.00"), new BigDecimal("1200.00"),
                new BigDecimal("1800.00"), 4, 2, 2
        );

        when(loanAdjustmentService.getLoanMetrics(7L)).thenReturn(metrics);

        mockMvc.perform(get("/api/loans/metrics/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalLent").value(5000.00))
                .andExpect(jsonPath("$.totalBorrowed").value(2000.00))
                .andExpect(jsonPath("$.lentPending").value(3000.00))
                .andExpect(jsonPath("$.borrowedPending").value(1200.00))
                .andExpect(jsonPath("$.netBalance").value(1800.00))
                .andExpect(jsonPath("$.pendingCount").value(2))
                .andExpect(jsonPath("$.settledCount").value(2));

        verify(userSecurity).validateUserAccess(7L);
    }

    @Test
    @DisplayName("createLoan validates payload and returns 201 Created")
    void createLoan_returnsCreated() throws Exception {
        LoanAdjustmentDto created = new LoanAdjustmentDto(
                10L, "Priya", LoanType.BORROWED, new BigDecimal("500.00"),
                LocalDate.of(2026, 10, 20), null, null, false, null, null
        );

        when(loanAdjustmentService.createLoan(any(LoanAdjustmentRequest.class), eq(7L))).thenReturn(created);

        mockMvc.perform(post("/api/loans/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "counterparty": "Priya",
                                  "type": "BORROWED",
                                  "amount": 500.00,
                                  "adjustmentDate": "2026-10-20"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.counterparty").value("Priya"))
                .andExpect(jsonPath("$.type").value("BORROWED"));

        verify(userSecurity).validateUserAccess(7L);
    }

    @Test
    @DisplayName("toggleSettleLoan calls service and returns updated record")
    void toggleSettleLoan_togglesStatus() throws Exception {
        LoanAdjustmentDto toggled = new LoanAdjustmentDto(
                10L, "Priya", LoanType.BORROWED, new BigDecimal("500.00"),
                LocalDate.of(2026, 10, 20), null, null, true, LocalDate.of(2026, 10, 21), null
        );

        when(loanAdjustmentService.toggleSettleLoan(10L, 7L)).thenReturn(toggled);

        mockMvc.perform(put("/api/loans/10/settle/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isSettled").value(true));

        verify(userSecurity).validateUserAccess(7L);
    }

    @Test
    @DisplayName("deleteLoan returns 204 No Content")
    void deleteLoan_returnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/loans/10/user/7"))
                .andExpect(status().isNoContent());

        verify(userSecurity).validateUserAccess(7L);
        verify(loanAdjustmentService).deleteLoan(10L, 7L);
    }
}
