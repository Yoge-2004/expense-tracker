package com.example.expensetracker.controller;

import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.any;
import org.springframework.beans.factory.annotation.Autowired;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link UserController}.
 *
 * <p>Endpoints covered:</p>
 * <ul>
 *   <li>DELETE /api/users/{userId}</li>
 *   <li>GET    /api/users/{userId}</li>
 *   <li>PUT    /api/users/{userId}/currency</li>
 *   <li>POST   /api/users/{userId}/verify-security-pin</li>
 * </ul>
 *
 * @author Yogeshwaran
 */
@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("UserController Tests")
class UserControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean UserService userService;
    @MockitoBean com.example.expensetracker.repository.UserRepository userRepository;
    @MockitoBean com.example.expensetracker.service.MonthlyReportService monthlyReportService;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;
    @MockitoBean JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean com.example.expensetracker.security.UserSecurity userSecurity;

    @BeforeEach
    void setUp() throws Exception {
        // Ensure the mocked JWT filter continues the filter chain
        doAnswer(invocation -> {
            jakarta.servlet.http.HttpServletRequest request = invocation.getArgument(0);
            jakarta.servlet.http.HttpServletResponse response = invocation.getArgument(1);
            jakarta.servlet.FilterChain chain = invocation.getArgument(2);
            chain.doFilter(request, response);
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    // ─────────────── DELETE /api/users/{userId} ───────────────

    @Test
    @WithMockUser
    @DisplayName("DELETE /api/users/{userId} → 204 No Content on successful deletion")
    void deleteAccount_existingUser_returns204() throws Exception {
        doNothing().when(userService).deleteUser(1L);

        mockMvc.perform(delete("/api/users/1"))
                .andExpect(status().isNoContent());

        verify(userService, times(1)).deleteUser(1L);
    }

    @Test
    @WithMockUser
    @DisplayName("DELETE /api/users/{userId} → 400 Bad Request when user not found")
    void deleteAccount_userNotFound_returns400() throws Exception {
        doThrow(new IllegalArgumentException("User not found"))
                .when(userService).deleteUser(99L);

        mockMvc.perform(delete("/api/users/99"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));
    }

    // ─────────────── GET /api/users/{userId} ───────────────

    @Test
    @WithMockUser
    @DisplayName("GET /api/users/{userId} → 200 OK with User profile including currency")
    void getUserProfile_returns200WithCurrency() throws Exception {
        com.example.expensetracker.model.User user = new com.example.expensetracker.model.User();
        user.setId(1L);
        user.setName("Yogeshwaran");
        user.setEmail("yoge@example.com");
        user.setCurrency("EUR");

        when(userService.findById(1L)).thenReturn(java.util.Optional.of(user));

        mockMvc.perform(get("/api/users/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Yogeshwaran"))
                .andExpect(jsonPath("$.currency").value("EUR"));
    }

    // ─────────────── PUT /api/users/{userId}/currency ───────────────

    @Test
    @WithMockUser
    @DisplayName("PUT /api/users/{userId}/currency → 200 OK on successful currency update")
    void updateCurrency_validRequest_returns200() throws Exception {
        doNothing().when(userService).updateCurrency(1L, "USD");

        mockMvc.perform(put("/api/users/1/currency")
                        .contentType("application/json")
                        .content("{\"currency\":\"USD\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currency").value("USD"));
    }

    // ─────────────── POST /api/users/{userId}/verify-security-pin ───────────────

    @Test
    @WithMockUser
    @DisplayName("POST /api/users/{userId}/verify-security-pin → 200 OK when PIN is correct")
    void verifySecurityPin_correctPin_returns200() throws Exception {
        when(userService.verifySecurityPin(1L, "123456")).thenReturn(true);

        mockMvc.perform(post("/api/users/1/verify-security-pin")
                        .contentType("application/json")
                        .content("{\"securityPin\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.message").value("Security PIN verified successfully."));
    }

    @Test
    @WithMockUser
    @DisplayName("POST /api/users/{userId}/verify-security-pin → 401 Unauthorized when PIN is incorrect")
    void verifySecurityPin_incorrectPin_returns401() throws Exception {
        when(userService.verifySecurityPin(1L, "999999")).thenReturn(false);

        mockMvc.perform(post("/api/users/1/verify-security-pin")
                        .contentType("application/json")
                        .content("{\"securityPin\":\"999999\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.message").value("Invalid security PIN."));
    }

    @Test
    @WithMockUser
    @DisplayName("POST /api/users/{userId}/verify-security-pin → 400 Bad Request when PIN is malformed")
    void verifySecurityPin_malformedPin_returns400() throws Exception {
        mockMvc.perform(post("/api/users/1/verify-security-pin")
                        .contentType("application/json")
                        .content("{\"securityPin\":\"12a\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Security PIN must be exactly 6 numeric digits."));
    }

    @Test
    @DisplayName("GET /api/users/suggest-usernames → 200 OK with suggestions")
    void suggestUsernames_checksDb_returns200() throws Exception {
        mockMvc.perform(get("/api/users/suggest-usernames?base=john"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions").isArray());
    }
}
