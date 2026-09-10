package com.example.expensetracker.controller;

import com.example.expensetracker.dto.CashFlowSummaryDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.ImportService;
import com.example.expensetracker.service.IncomeService;
import com.example.expensetracker.service.UserService;
import org.junit.jupiter.api.BeforeEach;
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
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
        controllers = IncomeController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class IncomeControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean IncomeService incomeService;
    @MockitoBean UserService userService;
    @MockitoBean ExportService exportService;
    @MockitoBean ImportService importService;
    @MockitoBean UserSecurity userSecurity;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(7L);
        user.setName("Jane Doe");
        user.setEmail("jane@example.com");
    }

    @Test
    void createIncomeReturnsCreatedDtoAndDelegatesRequestVerbatim() throws Exception {
        IncomeDto created = income(41L, "75000.00", "Tech Corp", "Salary", "2026-09-01", true);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(incomeService.createIncome(any(), same(user))).thenReturn(created);

        mockMvc.perform(post("/api/incomes/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":75000,"source":"Tech Corp","description":"Salary","incomeDate":"2026-09-01","isRecurring":true,"frequency":"MONTHLY"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(41))
                .andExpect(jsonPath("$.amount").value(75000))
                .andExpect(jsonPath("$.source").value("Tech Corp"))
                .andExpect(jsonPath("$.incomeDate").value("2026-09-01"))
                .andExpect(jsonPath("$.isRecurring").value(true));

        verify(userSecurity).validateUserAccess(7L);
        verify(incomeService).createIncome(any(), same(user));
    }

    @Test
    void createIncomeRejectsMissingRequiredFieldsBeforeUserLookup() throws Exception {
        mockMvc.perform(post("/api/incomes/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":0,"source":"","incomeDate":null}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(userSecurity, userService, incomeService);
    }

    @Test
    void createIncomeReturnsBadRequestForMissingUser() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/incomes/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":1000,"source":"Freelance","incomeDate":"2026-09-01"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));

        verify(incomeService, never()).createIncome(any(), any(User.class));
    }

    @Test
    void getUserIncomesReturnsServiceResults() throws Exception {
        IncomeDto first = income(1L, "1000", "Freelance", "Project A", "2026-09-02", false);
        IncomeDto second = income(2L, "75000", "Salary", null, "2026-09-01", true);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(incomeService.getUserIncomes(user)).thenReturn(List.of(first, second));

        mockMvc.perform(get("/api/incomes/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].source").value("Freelance"))
                .andExpect(jsonPath("$[1].isRecurring").value(true));

        verify(userSecurity).validateUserAccess(7L);
        verify(incomeService).getUserIncomes(user);
    }

    @Test
    void updateIncomeValidatesOwnerAndReturnsUpdatedRecord() throws Exception {
        IncomeDto updated = income(41L, "78000", "Tech Corp", "Raise", "2026-09-01", true);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(incomeService.updateIncome(eq(41L), any(), same(user))).thenReturn(updated);

        mockMvc.perform(put("/api/incomes/41/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":78000,"source":"Tech Corp","description":"Raise","incomeDate":"2026-09-01","isRecurring":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(41))
                .andExpect(jsonPath("$.amount").value(78000))
                .andExpect(jsonPath("$.description").value("Raise"));

        verify(userSecurity).validateUserAccess(7L);
        verify(incomeService).updateIncome(eq(41L), any(), same(user));
    }

    @Test
    void deleteIncomeReturnsNoContentAndDelegates() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));

        mockMvc.perform(delete("/api/incomes/41/user/7"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(userSecurity).validateUserAccess(7L);
        verify(incomeService).deleteIncome(41L, user);
    }

    @Test
    void cashFlowSummaryUsesExplicitYearAndMonth() throws Exception {
        CashFlowSummaryDto summary = new CashFlowSummaryDto(
                2026, 8, new BigDecimal("80000"), new BigDecimal("45000"),
                new BigDecimal("35000"), 43.75, 2, 18);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(incomeService.getCashFlowSummary(user, 2026, 8)).thenReturn(summary);

        mockMvc.perform(get("/api/incomes/summary/user/7")
                        .queryParam("year", "2026")
                        .queryParam("month", "8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.year").value(2026))
                .andExpect(jsonPath("$.month").value(8))
                .andExpect(jsonPath("$.totalIncome").value(80000))
                .andExpect(jsonPath("$.totalExpense").value(45000))
                .andExpect(jsonPath("$.netSavings").value(35000))
                .andExpect(jsonPath("$.savingsRate").value(43.75))
                .andExpect(jsonPath("$.incomeCount").value(2))
                .andExpect(jsonPath("$.expenseCount").value(18));

        verify(incomeService).getCashFlowSummary(user, 2026, 8);
    }

    @Test
    void cashFlowSummaryDefaultsToCurrentPeriodWhenParametersOmitted() throws Exception {
        LocalDate today = LocalDate.now();
        CashFlowSummaryDto summary = new CashFlowSummaryDto(
                today.getYear(), today.getMonthValue(), new BigDecimal("10"),
                new BigDecimal("3"), new BigDecimal("7"), 70.0, 1, 1);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(incomeService.getCashFlowSummary(user, today.getYear(), today.getMonthValue())).thenReturn(summary);

        mockMvc.perform(get("/api/incomes/summary/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.year").value(today.getYear()))
                .andExpect(jsonPath("$.month").value(today.getMonthValue()));

        verify(incomeService).getCashFlowSummary(user, today.getYear(), today.getMonthValue());
    }

    @Test
    void exportCsvReturnsAttachmentAndBytesUnchanged() throws Exception {
        byte[] bytes = "date,source,amount\n2026-09-01,Salary,75000\n".getBytes();
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(exportService.exportIncomesToCsv(user)).thenReturn(bytes);

        mockMvc.perform(get("/api/incomes/user/7/export/csv"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"incomes.csv\""))
                // FIXED: use contentTypeCompatibleWith so the assertion is charset-agnostic.
                // The controller now correctly sends "text/csv;charset=UTF-8" (per RFC 4180,
                // without charset the default is ISO-8859-1 which corrupts non-ASCII text).
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(content().bytes(bytes));

        verify(exportService).exportIncomesToCsv(user);
    }

    @Test
    void exportJsonReturnsAttachmentAndJsonContentType() throws Exception {
        byte[] bytes = "[{\"source\":\"Salary\",\"amount\":75000}]".getBytes();
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(exportService.exportIncomesToJson(user)).thenReturn(bytes);

        mockMvc.perform(get("/api/incomes/user/7/export/json"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"incomes.json\""))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().bytes(bytes));

        verify(exportService).exportIncomesToJson(user);
    }

    @Test
    void exportPdfUsesQueryCurrencyBeforeHeaderCurrency() throws Exception {
        byte[] bytes = new byte[]{1, 2};
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(exportService.exportIncomesToPdf(user, "USD")).thenReturn(bytes);

        mockMvc.perform(get("/api/incomes/user/7/export/pdf")
                        .queryParam("currency", "USD")
                        .header("X-Currency", "EUR"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"incomes.pdf\""))
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(content().bytes(bytes));

        verify(exportService).exportIncomesToPdf(user, "USD");
    }

    @Test
    void exportExcelFallsBackToHeaderCurrencyWhenParameterAbsent() throws Exception {
        byte[] bytes = new byte[]{3, 4};
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(exportService.exportIncomesToExcel(user, "EUR")).thenReturn(bytes);

        mockMvc.perform(get("/api/incomes/user/7/export/excel")
                        .header("X-Currency", "EUR"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"incomes.xlsx\""))
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(content().bytes(bytes));

        verify(exportService).exportIncomesToExcel(user, "EUR");
    }

    @Test
    void exportXlsxAliasUsesSameServiceContract() throws Exception {
        byte[] bytes = new byte[]{5, 6};
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(exportService.exportIncomesToExcel(user, null)).thenReturn(bytes);

        mockMvc.perform(get("/api/incomes/user/7/export/xlsx"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"incomes.xlsx\""))
                .andExpect(content().bytes(bytes));

        verify(exportService).exportIncomesToExcel(user, null);
    }

    private static IncomeDto income(Long id, String amount, String source, String description,
                                    String date, boolean recurring) {
        IncomeDto dto = new IncomeDto();
        dto.setId(id);
        dto.setAmount(new BigDecimal(amount));
        dto.setSource(source);
        dto.setDescription(description);
        dto.setIncomeDate(LocalDate.parse(date));
        dto.setIsRecurring(recurring);
        return dto;
    }
}
