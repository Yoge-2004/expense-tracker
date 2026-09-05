package com.example.expensetracker.security;

import com.example.expensetracker.controller.AuthController;
import com.example.expensetracker.dto.LoginRequest;
import com.example.expensetracker.exception.GlobalExceptionHandler;
import com.example.expensetracker.service.PasswordResetService;
import com.example.expensetracker.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("RateLimitInterceptor and Protection Tests")
class RateLimitInterceptorTest {

    private MockMvc mockMvc;
    private RateLimiterService rateLimiterService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        rateLimiterService = new RateLimiterService();
        rateLimiterService.setEnabled(true);
        rateLimiterService.clearAll();

        AuthenticationManager authManager = mock(AuthenticationManager.class);
        when(authManager.authenticate(any())).thenThrow(new BadCredentialsException("Invalid credentials"));

        JwtService jwtService = mock(JwtService.class);
        UserService userService = mock(UserService.class);
        GoogleIdTokenVerifier googleIdTokenVerifier = mock(GoogleIdTokenVerifier.class);
        PasswordResetService passwordResetService = mock(PasswordResetService.class);

        AuthController authController = new AuthController(
                authManager, jwtService, userService, googleIdTokenVerifier, passwordResetService
        );

        RateLimitInterceptor interceptor = new RateLimitInterceptor(rateLimiterService);

        mockMvc = MockMvcBuilders.standaloneSetup(authController)
                .addInterceptors(interceptor)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("Should permit login attempts under threshold and set rate limit headers")
    void shouldPermitLoginUnderThreshold() throws Exception {
        LoginRequest req = new LoginRequest("test@example.com", "wrongpass");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("X-RateLimit-Limit", "10"))
                .andExpect(header().string("X-RateLimit-Remaining", "9"));
    }

    @Test
    @DisplayName("Should throttle requests and return HTTP 429 Too Many Requests when threshold exceeded")
    void shouldReturn429WhenThresholdExceeded() throws Exception {
        LoginRequest req = new LoginRequest("attacker@example.com", "bruteforce");

        // AuthController /api/auth/login has maxRequests = 10
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .header("X-Forwarded-For", "203.0.113.195")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnauthorized());
        }

        // 11th request must be throttled with HTTP 429 and Retry-After header
        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "203.0.113.195")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.error").value("Too Many Requests"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Too many login attempts")));
    }

    @Test
    @DisplayName("Different client IPs should have separate rate limit buckets")
    void differentIpsShouldHaveSeparateBuckets() throws Exception {
        LoginRequest req = new LoginRequest("user@example.com", "pass");

        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .header("X-Forwarded-For", "198.51.100.1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnauthorized());
        }

        // IP 1 is blocked
        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "198.51.100.1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isTooManyRequests());

        // IP 2 is not blocked
        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "198.51.100.2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized());
    }
}
