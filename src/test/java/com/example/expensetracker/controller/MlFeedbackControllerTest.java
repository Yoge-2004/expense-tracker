package com.example.expensetracker.controller;

import com.example.expensetracker.dto.MlFeedbackConsumeRequest;
import com.example.expensetracker.dto.MlFeedbackPageResponse;
import com.example.expensetracker.dto.MlFeedbackRequest;
import com.example.expensetracker.dto.MlFeedbackResponse;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.CustomUserDetails;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.MlFeedbackService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = MlFeedbackController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@TestPropertySource(properties = "ml.feedback.token=test-ml-training-secret-token")
@Import(MlFeedbackControllerTest.SecurityTestConfig.class)
class MlFeedbackControllerTest {

    private static final String VALID_TOKEN = "test-ml-training-secret-token";
    private static final String INVALID_TOKEN = "wrong-token-value";

    @Autowired private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @MockitoBean private MlFeedbackService service;
    @MockitoBean private JwtService jwtService;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    private CustomUserDetails customUserDetails;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setId(5L);
        user.setName("ML Tester");
        user.setEmail("mltester@example.com");
        customUserDetails = new CustomUserDetails(user);
    }

    @Test
    @DisplayName("POST /api/ml/feedback: authenticated user successfully records feedback")
    void submitFeedback_authenticatedUser_success() throws Exception {
        MlFeedbackRequest request = new MlFeedbackRequest(
                "42", "Whole Foods grocery", "shopping_retail", "food_dining", 0.78, "tfidf@2.0");
        MlFeedbackResponse response = new MlFeedbackResponse("fb12345", "eligible");

        when(service.create(any(User.class), eq(request))).thenReturn(response);

        Authentication auth = new UsernamePasswordAuthenticationToken(
                customUserDetails, null, customUserDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        mockMvc.perform(post("/api/ml/feedback")
                        .principal(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.feedbackId").value("fb12345"))
                .andExpect(jsonPath("$.status").value("eligible"));

        verify(service).create(any(User.class), eq(request));
    }

    @Test
    @DisplayName("POST /api/ml/feedback: unauthenticated request returns 403 Forbidden")
    void submitFeedback_unauthenticated_returnsForbidden() throws Exception {
        MlFeedbackRequest request = new MlFeedbackRequest(
                "42", "Uber trip", "food_dining", "transportation", 0.65, "tfidf@2.0");

        mockMvc.perform(post("/api/ml/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/ml/feedback: invalid payload with blank text returns 400 Bad Request")
    void submitFeedback_blankText_returnsBadRequest() throws Exception {
        MlFeedbackRequest request = new MlFeedbackRequest(
                "42", "   ", "shopping_retail", "food_dining", 0.78, "tfidf@2.0");

        Authentication auth = new UsernamePasswordAuthenticationToken(
                customUserDetails, null, customUserDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        mockMvc.perform(post("/api/ml/feedback")
                        .principal(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/internal/ml/feedback/count: valid token returns eligible count")
    void countTrainingFeedback_validToken_returnsCount() throws Exception {
        when(service.countEligible()).thenReturn(42L);

        mockMvc.perform(get("/api/internal/ml/feedback/count")
                        .header("X-ML-Training-Token", VALID_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eligibleCount").value(42));
    }

    @Test
    @DisplayName("GET /api/internal/ml/feedback/count: invalid token returns 403 Forbidden")
    void countTrainingFeedback_invalidToken_returnsForbidden() throws Exception {
        mockMvc.perform(get("/api/internal/ml/feedback/count")
                        .header("X-ML-Training-Token", INVALID_TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /api/internal/ml/feedback/count: missing token returns 403 Forbidden")
    void countTrainingFeedback_missingToken_returnsForbidden() throws Exception {
        mockMvc.perform(get("/api/internal/ml/feedback/count"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /api/internal/ml/feedback: valid token returns paginated records")
    void fetchTrainingFeedback_validToken_returnsPage() throws Exception {
        MlFeedbackPageResponse page = new MlFeedbackPageResponse(List.of(), "cursor-10");
        when(service.fetchEligible("5", 50)).thenReturn(page);

        mockMvc.perform(get("/api/internal/ml/feedback")
                        .header("X-ML-Training-Token", VALID_TOKEN)
                        .param("after", "5")
                        .param("limit", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextCursor").value("cursor-10"));
    }

    @Test
    @DisplayName("GET /api/internal/ml/feedback: invalid token returns 403 Forbidden")
    void fetchTrainingFeedback_invalidToken_returnsForbidden() throws Exception {
        mockMvc.perform(get("/api/internal/ml/feedback")
                        .header("X-ML-Training-Token", INVALID_TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/internal/ml/feedback/consume: valid token consumes feedback IDs")
    void consumeTrainingFeedback_validToken_returnsOk() throws Exception {
        MlFeedbackConsumeRequest request = new MlFeedbackConsumeRequest(List.of("f1", "f2"));
        when(service.consume(request)).thenReturn(2);

        mockMvc.perform(post("/api/internal/ml/feedback/consume")
                        .header("X-ML-Training-Token", VALID_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.consumed").value(2));
    }

    @Test
    @DisplayName("POST /api/internal/ml/feedback/consume: invalid token returns 403 Forbidden")
    void consumeTrainingFeedback_invalidToken_returnsForbidden() throws Exception {
        MlFeedbackConsumeRequest request = new MlFeedbackConsumeRequest(List.of("f1"));

        mockMvc.perform(post("/api/internal/ml/feedback/consume")
                        .header("X-ML-Training-Token", INVALID_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/internal/ml/feedback/consume: empty feedbackIds list returns 400 Bad Request")
    void consumeTrainingFeedback_emptyList_returnsBadRequest() throws Exception {
        MlFeedbackConsumeRequest request = new MlFeedbackConsumeRequest(List.of());

        mockMvc.perform(post("/api/internal/ml/feedback/consume")
                        .header("X-ML-Training-Token", VALID_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @TestConfiguration
    static class SecurityTestConfig implements WebMvcConfigurer {
        @Override
        public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
            resolvers.add(new AuthenticationPrincipalArgumentResolver());
        }
    }
}
