package com.example.expensetracker.controller;

import com.example.expensetracker.model.User;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.GoogleIdTokenVerifier;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link AuthController}.
 *
 * <p>Uses {@code @WebMvcTest} to load only the web layer (filters, controllers,
 * security config). All service/security dependencies are mocked with
 * {@code @MockBean} so no database or JWT infrastructure is required.</p>
 *
 * <p>Endpoints covered:</p>
 * <ul>
 *   <li>POST  /api/auth/login</li>
 *   <li>POST  /api/auth/register</li>
 *   <li>PUT   /api/auth/reset-password</li>
 * </ul>
 *
 * @author Yogeshwaran
 */
@WebMvcTest(AuthController.class)
@DisplayName("AuthController Tests")
class AuthControllerTest {

    @Autowired MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    @MockitoBean AuthenticationManager authenticationManager;
    @MockitoBean JwtService jwtService;
    @MockitoBean UserService userService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;
    @MockitoBean GoogleIdTokenVerifier googleIdTokenVerifier;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setName("Yogeshwaran");
        sampleUser.setEmail("yoge@example.com");
        sampleUser.setPassword("$2a$10$encodedpassword");
        sampleUser.setEnabled(true);
    }

    // ─────────────────────────── POST /api/auth/login ───────────────────────────

    @Test
    @DisplayName("POST /api/auth/login → 200 OK with token on valid credentials")
    void login_validCredentials_returns200WithToken() throws Exception {
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("yoge@example.com");
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(auth);
        when(jwtService.generateToken("yoge@example.com")).thenReturn("mocked.jwt.token");
        when(userService.findByEmail("yoge@example.com")).thenReturn(Optional.of(sampleUser));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "yoge@example.com", "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mocked.jwt.token"))
                .andExpect(jsonPath("$.userId").value(1))
                .andExpect(jsonPath("$.name").value("Yogeshwaran"));
    }

    @Test
    @DisplayName("POST /api/auth/login → 401 Unauthorized on bad credentials")
    void login_badCredentials_returns401() throws Exception {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "wrong@example.com", "password", "wrongpass"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/auth/login → 400 Bad Request when email is blank")
    void login_blankEmail_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "", "password", "password123"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/auth/login → 400 Bad Request when password is blank")
    void login_blankPassword_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "yoge@example.com", "password", ""))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/auth/login → 400 Bad Request when email format is invalid")
    void login_invalidEmailFormat_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "not-an-email", "password", "password123"))))
                .andExpect(status().isBadRequest());
    }

    // ─────────────────────────── POST /api/auth/register ───────────────────────────

    @Test
    @DisplayName("POST /api/auth/register → 201 Created on successful registration")
    void register_validRequest_returns201() throws Exception {
        when(userService.registerUser(any(User.class))).thenReturn(sampleUser);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "Yogeshwaran",
                                        "email", "yoge@example.com",
                                        "password", "secret123"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.email").value("yoge@example.com"));
    }

    @Test
    @DisplayName("POST /api/auth/register → 400 Bad Request when email already exists")
    void register_duplicateEmail_returns400() throws Exception {
        when(userService.registerUser(any(User.class)))
                .thenThrow(new IllegalArgumentException("Email already registered"));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "Yogeshwaran",
                                        "email", "yoge@example.com",
                                        "password", "secret123"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Email already registered"));
    }

    @Test
    @DisplayName("POST /api/auth/register → 400 Bad Request when password is too short")
    void register_shortPassword_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "Yogeshwaran",
                                        "email", "yoge@example.com",
                                        "password", "abc"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/auth/register → 400 Bad Request when name is blank")
    void register_blankName_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "",
                                        "email", "yoge@example.com",
                                        "password", "secret123"))))
                .andExpect(status().isBadRequest());
    }

    // ─────────────────────────── PUT /api/auth/reset-password ───────────────────────────

    @Test
    @DisplayName("PUT /api/auth/reset-password → 200 OK on valid request")
    void resetPassword_validRequest_returns200() throws Exception {
        doNothing().when(userService).updatePassword(anyString(), anyString());

        mockMvc.perform(put("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "yoge@example.com",
                                        "newPassword", "newSecret456"))))
                .andExpect(status().isOk());

        verify(userService).updatePassword("yoge@example.com", "newSecret456");
    }

    @Test
    @DisplayName("PUT /api/auth/reset-password → 400 Bad Request when email is missing")
    void resetPassword_missingEmail_returns400() throws Exception {
        mockMvc.perform(put("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("newPassword", "newSecret456"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/auth/reset-password → 400 Bad Request when newPassword is missing")
    void resetPassword_missingNewPassword_returns400() throws Exception {
        mockMvc.perform(put("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "yoge@example.com"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/auth/reset-password → 400 Bad Request when user not found")
    void resetPassword_userNotFound_returns400() throws Exception {
        doThrow(new IllegalArgumentException("User not found"))
                .when(userService).updatePassword(anyString(), anyString());

        mockMvc.perform(put("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "ghost@example.com",
                                        "newPassword", "newSecret456"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));
    }

    // ─────────────────────────── POST /api/auth/oauth/google ───────────────────────────

    @Test
    @DisplayName("POST /api/auth/oauth/google → 200 OK when Google verifies the ID token")
    void oauthLogin_verifiedToken_returns200() throws Exception {
        when(googleIdTokenVerifier.verify(anyString()))
                .thenReturn(new GoogleIdTokenVerifier.VerifiedIdentity("yoge@example.com", "Yogeshwaran"));
        when(userService.findByEmail(anyString())).thenReturn(Optional.of(sampleUser));
        when(jwtService.generateToken(anyString())).thenReturn("mock-oauth-jwt-token");

        mockMvc.perform(post("/api/auth/oauth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("idToken", "a-real-google-signed-token"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mock-oauth-jwt-token"))
                .andExpect(jsonPath("$.name").value("Yogeshwaran"));
    }

    @Test
    @DisplayName("POST /api/auth/oauth/google → 401 when the ID token cannot be verified (forged/expired/wrong audience)")
    void oauthLogin_unverifiableToken_returns401() throws Exception {
        when(googleIdTokenVerifier.verify(anyString()))
                .thenThrow(new BadCredentialsException("Google sign-in failed: token was not issued for this application."));

        mockMvc.perform(post("/api/auth/oauth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("idToken", "a-token-claiming-to-be-someone-else"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/auth/login → 503 Service Unavailable when DB is down during auth")
    void login_dbDown_returns503() throws Exception {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Failure", new org.springframework.dao.DataAccessResourceFailureException("DB connection refused")));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "yoge@example.com", "password", "secret123"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.message").value("Database service is unavailable. Please try again later."));
    }
}
