package com.example.expensetracker.controller;

import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.ReceiptOcrService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = ReceiptOcrController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class ReceiptOcrControllerTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean ReceiptOcrService receiptOcrService;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    @Test
    @DisplayName("POST /api/expenses/ocr processes uploaded file")
    void scanReceipt_processesFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "receipt.png", "image/png", "fake-img".getBytes());
        when(receiptOcrService.processReceipt(any())).thenReturn(Map.of(
                "success", true,
                "amount", 45.50,
                "merchant", "Shell Oil",
                "category", "Transportation"
        ));

        mockMvc.perform(multipart("/api/expenses/ocr").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.amount").value(45.50))
                .andExpect(jsonPath("$.merchant").value("Shell Oil"));
    }

    @Test
    @DisplayName("POST /api/receipts/parse-text parses raw text")
    void parseText_parsesDirectText() throws Exception {
        when(receiptOcrService.parseReceiptText("Sample text")).thenReturn(Map.of(
                "amount", 12.00,
                "merchant", "Coffee Shop"
        ));

        mockMvc.perform(post("/api/receipts/parse-text")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Sample text\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(12.00))
                .andExpect(jsonPath("$.merchant").value("Coffee Shop"));
    }
}
