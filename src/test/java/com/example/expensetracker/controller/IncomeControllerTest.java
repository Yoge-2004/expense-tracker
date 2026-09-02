package com.example.expensetracker.controller;

import com.example.expensetracker.dto.CashFlowSummaryDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.ImportService;
import com.example.expensetracker.service.IncomeService;
import com.example.expensetracker.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(IncomeController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("IncomeController Tests")
class IncomeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    @MockitoBean private IncomeService incomeService;
    @MockitoBean private ExportService exportService;
    @MockitoBean private ImportService importService;
    @MockitoBean private UserService userService;
    @MockitoBean private JwtService jwtService;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    private User sampleUser;
    private IncomeDto sampleIncomeDto;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setName("Yogeshwaran");
        sampleUser.setEmail("yoge@example.com");

        sampleIncomeDto = new IncomeDto(
                50L,
                new BigDecimal("65000.00"),
                "Salary",
                "Tech job salary",
                LocalDate.of(2026, 8, 1),
                true,
                LocalDateTime.now()
        );
    }

    @Nested
    @DisplayName("POST /api/incomes/user/{userId}")
    class CreateIncome {

        @Test
        @WithMockUser
        @DisplayName("→ 201 Created on valid income request")
        void validIncome_returns201() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(incomeService.createIncome(any(IncomeRequest.class), eq(sampleUser)))
                    .thenReturn(sampleIncomeDto);

            Map<String, Object> body = Map.of(
                    "amount", 65000.00,
                    "source", "Salary",
                    "description", "Tech job salary",
                    "incomeDate", "2026-08-01",
                    "isRecurring", true
            );

            mockMvc.perform(post("/api/incomes/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").value(50))
                    .andExpect(jsonPath("$.amount").value(65000.00))
                    .andExpect(jsonPath("$.source").value("Salary"))
                    .andExpect(jsonPath("$.isRecurring").value(true));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when amount is missing")
        void missingAmount_returns400() throws Exception {
            Map<String, Object> body = Map.of(
                    "source", "Salary",
                    "incomeDate", "2026-08-01"
            );

            mockMvc.perform(post("/api/incomes/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when source is blank")
        void blankSource_returns400() throws Exception {
            Map<String, Object> body = Map.of(
                    "amount", 1000.00,
                    "source", "   ",
                    "incomeDate", "2026-08-01"
            );

            mockMvc.perform(post("/api/incomes/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when user not found")
        void userNotFound_returns400() throws Exception {
            when(userService.findById(99L)).thenReturn(Optional.empty());

            Map<String, Object> body = Map.of(
                    "amount", 1000.00,
                    "source", "Salary",
                    "incomeDate", "2026-08-01"
            );

            mockMvc.perform(post("/api/incomes/user/99")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("GET /api/incomes/user/{userId}")
    class GetIncomes {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with list of incomes")
        void returnsIncomeList() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(incomeService.getUserIncomes(sampleUser)).thenReturn(List.of(sampleIncomeDto));

            mockMvc.perform(get("/api/incomes/user/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(50))
                    .andExpect(jsonPath("$[0].source").value("Salary"));
        }
    }

    @Nested
    @DisplayName("PUT /api/incomes/{incomeId}/user/{userId}")
    class UpdateIncome {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK on update")
        void update_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(incomeService.updateIncome(eq(50L), any(IncomeRequest.class), eq(sampleUser)))
                    .thenReturn(sampleIncomeDto);

            Map<String, Object> body = Map.of(
                    "amount", 70000.00,
                    "source", "Salary",
                    "incomeDate", "2026-08-01"
            );

            mockMvc.perform(put("/api/incomes/50/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(50));
        }
    }

    @Nested
    @DisplayName("DELETE /api/incomes/{incomeId}/user/{userId}")
    class DeleteIncome {

        @Test
        @WithMockUser
        @DisplayName("→ 204 No Content on successful deletion")
        void delete_returns204() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            doNothing().when(incomeService).deleteIncome(50L, sampleUser);

            mockMvc.perform(delete("/api/incomes/50/user/1"))
                    .andExpect(status().isNoContent());

            verify(incomeService).deleteIncome(50L, sampleUser);
        }
    }

    @Nested
    @DisplayName("GET /api/incomes/summary/user/{userId}")
    class CashFlowSummary {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with cash flow calculation")
        void summary_returns200() throws Exception {
            CashFlowSummaryDto summary = new CashFlowSummaryDto(
                    2026,
                    8,
                    new BigDecimal("60000.00"),
                    new BigDecimal("20000.00"),
                    new BigDecimal("40000.00"),
                    66.7,
                    1,
                    5
            );

            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(incomeService.getCashFlowSummary(eq(sampleUser), anyInt(), anyInt()))
                    .thenReturn(summary);

            mockMvc.perform(get("/api/incomes/summary/user/1?year=2026&month=8"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.year").value(2026))
                    .andExpect(jsonPath("$.month").value(8))
                    .andExpect(jsonPath("$.totalIncome").value(60000.00))
                    .andExpect(jsonPath("$.totalExpense").value(20000.00))
                    .andExpect(jsonPath("$.netSavings").value(40000.00))
                    .andExpect(jsonPath("$.savingsRate").value(66.7));
        }
    }

    @Nested
    @DisplayName("Export & Import Endpoints")
    class ExportImportTests {

        @Test
        @DisplayName("GET /api/incomes/user/{userId}/export/csv → 200 OK")
        void exportCsv_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(exportService.exportIncomesToCsv(sampleUser)).thenReturn("ID,Date,Source\n".getBytes());

            mockMvc.perform(get("/api/incomes/user/1/export/csv"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", "attachment; filename=\"incomes.csv\""));
        }

        @Test
        @DisplayName("GET /api/incomes/user/{userId}/export/json → 200 OK")
        void exportJson_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(exportService.exportIncomesToJson(sampleUser)).thenReturn("[]".getBytes());

            mockMvc.perform(get("/api/incomes/user/1/export/json"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", "attachment; filename=\"incomes.json\""));
        }

        @Test
        @DisplayName("GET /api/incomes/user/{userId}/export/pdf → 200 OK")
        void exportPdf_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(exportService.exportIncomesToPdf(sampleUser)).thenReturn("%PDF-1.4".getBytes());

            mockMvc.perform(get("/api/incomes/user/1/export/pdf"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", "attachment; filename=\"incomes.pdf\""));
        }

        @Test
        @DisplayName("GET /api/incomes/user/{userId}/export/excel → 200 OK")
        void exportExcel_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(exportService.exportIncomesToExcel(sampleUser)).thenReturn("PK".getBytes());

            mockMvc.perform(get("/api/incomes/user/1/export/excel"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", "attachment; filename=\"incomes.xlsx\""));
        }

        @Test
        @DisplayName("POST /api/incomes/user/{userId}/import/csv → 200 OK")
        void importCsv_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(importService.importIncomesFromCsv(any(), eq(sampleUser)))
                    .thenReturn(Map.of("message", "Imported 1 income record successfully."));

            String csvContent = "ID,Date,Source,Amount,Description\n1,2026-08-01,Salary,75000.00,Monthly salary\n";
            org.springframework.mock.web.MockMultipartFile file =
                    new org.springframework.mock.web.MockMultipartFile("file", "incomes.csv", "text/csv", csvContent.getBytes());

            mockMvc.perform(multipart("/api/incomes/user/1/import/csv").file(file))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Imported 1 income record successfully."));
        }

        @Test
        @DisplayName("POST /api/incomes/user/{userId}/import/json → 200 OK")
        void importJson_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(importService.importIncomesFromJson(any(), eq(sampleUser)))
                    .thenReturn(Map.of("message", "Imported 1 income records successfully"));

            String jsonContent = "[{\"amount\": 75000.0, \"source\": \"Salary\"}]";
            org.springframework.mock.web.MockMultipartFile file =
                    new org.springframework.mock.web.MockMultipartFile("file", "incomes.json", "application/json", jsonContent.getBytes());

            mockMvc.perform(multipart("/api/incomes/user/1/import/json").file(file))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Imported 1 income records successfully"));
        }

        @Test
        @DisplayName("POST /api/incomes/user/{userId}/import/excel → 200 OK")
        void importExcel_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(importService.importIncomesFromExcel(any(), eq(sampleUser)))
                    .thenReturn(Map.of("message", "Imported 2 income records successfully."));

            org.springframework.mock.web.MockMultipartFile file =
                    new org.springframework.mock.web.MockMultipartFile("file", "incomes.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "dummy".getBytes());

            mockMvc.perform(multipart("/api/incomes/user/1/import/excel").file(file))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Imported 2 income records successfully."));
        }
    }
}
