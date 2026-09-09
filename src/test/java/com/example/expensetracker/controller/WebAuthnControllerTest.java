package com.example.expensetracker.controller;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.WebAuthnService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(WebAuthnController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("WebAuthnController contract tests")
class WebAuthnControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean WebAuthnService webAuthnService;
    @MockitoBean UserRepository users;

    @Test
    @DisplayName("registration options requires authentication")
    void registrationOptions_withoutAuthentication_returns401() throws Exception {
        mockMvc.perform(post("/api/webauthn/register/options"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(webAuthnService);
    }

    @Test
    @DisplayName("registration options resolves the authenticated user by email")
    void registrationOptions_authenticatedByEmail_returnsOptions() throws Exception {
        User user = new User();
        user.setId(7L);
        user.setEmail("user@example.com");
        when(users.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));
        when(webAuthnService.startRegistration(user)).thenReturn(Map.of("transactionId", "tx-1", "publicKey", "options"));

        mockMvc.perform(post("/api/webauthn/register/options")
                        .principal(() -> "user@example.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionId").value("tx-1"))
                .andExpect(jsonPath("$.publicKey").value("options"));
    }

    @Test
    @DisplayName("registration finish forwards transaction and credential")
    void registrationFinish_forwardsRequest() throws Exception {
        User user = new User();
        user.setId(7L);
        user.setEmail("user@example.com");
        when(users.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));

        mockMvc.perform(post("/api/webauthn/register/finish")
                        .principal(() -> "user@example.com")
                        .contentType("application/json")
                        .content("{\"transactionId\":\"tx-1\",\"credential\":\"credential-data\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Biometric sign-in is now enabled on this device."));

        verify(webAuthnService).finishRegistration(user, "tx-1", "credential-data");
    }

    @Test
    @DisplayName("login options returns authentication challenge")
    void loginOptions_returnsChallenge() throws Exception {
        when(webAuthnService.startAuthentication()).thenReturn(Map.of("transactionId", "login-tx", "publicKey", "challenge"));

        mockMvc.perform(post("/api/webauthn/login/options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionId").value("login-tx"))
                .andExpect(jsonPath("$.publicKey").value("challenge"));
    }

    @Test
    @DisplayName("login finish returns service authentication result")
    void loginFinish_returnsAuthenticationResult() throws Exception {
        when(webAuthnService.finishAuthentication("login-tx", "credential-data"))
                .thenReturn(Map.of("token", "jwt-token", "userId", 7));

        mockMvc.perform(post("/api/webauthn/login/finish")
                        .contentType("application/json")
                        .content("{\"transactionId\":\"login-tx\",\"credential\":\"credential-data\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token"))
                .andExpect(jsonPath("$.userId").value(7));
    }

    @Test
    @DisplayName("disable requires authentication")
    void disable_withoutAuthentication_returns401() throws Exception {
        mockMvc.perform(delete("/api/webauthn/credentials"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(webAuthnService);
    }

    @Test
    @DisplayName("disable resolves the authenticated user by username")
    void disable_authenticatedByUsername_returns204() throws Exception {
        User user = new User();
        user.setId(9L);
        user.setUsername("yoge_26");
        when(users.findByEmailIgnoreCase("yoge_26")).thenReturn(Optional.empty());
        when(users.findByUsernameIgnoreCase("yoge_26")).thenReturn(Optional.of(user));

        mockMvc.perform(delete("/api/webauthn/credentials")
                        .principal(() -> "yoge_26"))
                .andExpect(status().isNoContent());

        verify(webAuthnService).disableForUser(user);
    }
}
