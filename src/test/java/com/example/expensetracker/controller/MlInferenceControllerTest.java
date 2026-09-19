package com.example.expensetracker.controller;

import com.example.expensetracker.dto.MlClassificationRequest;
import com.example.expensetracker.dto.MlClassificationResponse;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.MlInferenceClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = MlInferenceController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class MlInferenceControllerTest {

    @Autowired private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @MockitoBean private MlInferenceClient client;
    @MockitoBean private JwtService jwtService;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    @Test
    @DisplayName("POST /api/ml/classify: valid payload delegates to client and returns 200 OK")
    void classify_validPayload_returnsOk() throws Exception {
        MlClassificationRequest request = new MlClassificationRequest("Starbucks Latte", 3);
        MlClassificationResponse response = new MlClassificationResponse(
                "food_dining", 0.95, List.of(), "category-tfidf@2.0.0", "tfidf");

        when(client.classify(any(MlClassificationRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/ml/classify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").value("food_dining"))
                .andExpect(jsonPath("$.confidence").value(0.95))
                .andExpect(jsonPath("$.modelRevision").value("category-tfidf@2.0.0"))
                .andExpect(jsonPath("$.modelType").value("tfidf"));

        verify(client).classify(any(MlClassificationRequest.class));
    }

    @Test
    @DisplayName("POST /api/ml/classify: blank description returns 400 Bad Request")
    void classify_blankDescription_returnsBadRequest() throws Exception {
        MlClassificationRequest request = new MlClassificationRequest("   ", 3);

        mockMvc.perform(post("/api/ml/classify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/ml/classify: topN < 1 returns 400 Bad Request")
    void classify_topNTooLow_returnsBadRequest() throws Exception {
        MlClassificationRequest request = new MlClassificationRequest("Coffee", 0);

        mockMvc.perform(post("/api/ml/classify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/ml/classify: topN > 10 returns 400 Bad Request")
    void classify_topNTooHigh_returnsBadRequest() throws Exception {
        MlClassificationRequest request = new MlClassificationRequest("Coffee", 15);

        mockMvc.perform(post("/api/ml/classify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/ml/classify: downstream IllegalStateException returns 409 Conflict")
    void classify_clientThrowsIllegalState_returnsConflict() throws Exception {
        when(client.classify(any(MlClassificationRequest.class)))
                .thenThrow(new IllegalStateException("ML inference service is unavailable"));

        MlClassificationRequest request = new MlClassificationRequest("Uber trip", 3);

        mockMvc.perform(post("/api/ml/classify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("ML inference service is unavailable"));
    }
}
