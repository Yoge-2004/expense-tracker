package com.example.expensetracker.controller;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.WebAuthnService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
        controllers = WebAuthnController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class WebAuthnControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean WebAuthnService webAuthnService;
    @MockitoBean UserRepository users;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(7L);
        user.setEmail("jane@example.com");
        user.setUsername("jane_01");
        SecurityContextHolder.clearContext();
    }

    @Test
    void registrationOptionsRequiresAuthenticatedUserAndFindsByEmail() throws Exception {
        Authentication authentication = new UsernamePasswordAuthenticationToken("jane@example.com", null, java.util.List.of());
        when(users.findByEmailIgnoreCase("jane@example.com")).thenReturn(Optional.of(user));
        when(webAuthnService.startRegistration(user)).thenReturn(Map.of("transactionId", "tx-1", "challenge", "abc"));

        mockMvc.perform(post("/api/webauthn/register/options").principal(authentication))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionId").value("tx-1"))
                .andExpect(jsonPath("$.challenge").value("abc"));

        verify(webAuthnService).startRegistration(user);
        verify(users).findByEmailIgnoreCase("jane@example.com");
    }

    @Test
    void registrationOptionsFallsBackToUsernameLookup() throws Exception {
        Authentication authentication = new UsernamePasswordAuthenticationToken("jane_01", null, java.util.List.of());
        when(users.findByEmailIgnoreCase("jane_01")).thenReturn(Optional.empty());
        when(users.findByUsernameIgnoreCase("jane_01")).thenReturn(Optional.of(user));
        when(webAuthnService.startRegistration(user)).thenReturn(Map.of("transactionId", "tx-2"));

        mockMvc.perform(post("/api/webauthn/register/options").principal(authentication))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionId").value("tx-2"));

        verify(webAuthnService).startRegistration(user);
        verify(users).findByUsernameIgnoreCase("jane_01");
    }

    @Test
    void registrationOptionsRejectsAnonymousRequests() throws Exception {
        mockMvc.perform(post("/api/webauthn/register/options"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentication required."));

        verifyNoInteractions(users, webAuthnService);
    }

    @Test
    void registrationOptionsRejectsUnknownAuthenticatedUser() throws Exception {
        Authentication authentication = new UsernamePasswordAuthenticationToken("missing@example.com", null, java.util.List.of());
        when(users.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());
        when(users.findByUsernameIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/webauthn/register/options").principal(authentication))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("User account not found."));

        verifyNoInteractions(webAuthnService);
    }

    @Test
    void registrationFinishPassesTransactionAndCredentialToService() throws Exception {
        Authentication authentication = new UsernamePasswordAuthenticationToken("jane@example.com", null, java.util.List.of());
        when(users.findByEmailIgnoreCase("jane@example.com")).thenReturn(Optional.of(user));

        mockMvc.perform(post("/api/webauthn/register/finish")
                        .principal(authentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"transactionId\":\"tx-1\",\"credential\":\"cred-json\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Biometric sign-in is now enabled on this device."));

        verify(webAuthnService).finishRegistration(user, "tx-1", "cred-json");
    }

    @Test
    void registrationFinishAllowsNullFieldsToReachServiceForValidation() throws Exception {
        Authentication authentication = new UsernamePasswordAuthenticationToken("jane@example.com", null, java.util.List.of());
        when(users.findByEmailIgnoreCase("jane@example.com")).thenReturn(Optional.of(user));

        mockMvc.perform(post("/api/webauthn/register/finish")
                        .principal(authentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        verify(webAuthnService).finishRegistration(user, null, null);
    }

    @Test
    void loginOptionsDoesNotRequireExistingUserLookupAndReturnsChallengeData() throws Exception {
        when(webAuthnService.startAuthentication()).thenReturn(Map.of("transactionId", "tx-9", "challenge", "challenge"));

        mockMvc.perform(post("/api/webauthn/login/options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionId").value("tx-9"))
                .andExpect(jsonPath("$.challenge").value("challenge"));

        verify(webAuthnService).startAuthentication();
        verifyNoInteractions(users);
    }

    @Test
    void loginFinishDelegatesTransactionAndCredential() throws Exception {
        when(webAuthnService.finishAuthentication("tx-9", "cred-json"))
                .thenReturn(Map.of("token", "jwt", "userId", 7));

        mockMvc.perform(post("/api/webauthn/login/finish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"transactionId\":\"tx-9\",\"credential\":\"cred-json\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt"))
                .andExpect(jsonPath("$.userId").value(7));

        verify(webAuthnService).finishAuthentication("tx-9", "cred-json");
    }

    @Test
    void disableCredentialsRequiresAuthenticatedUserAndDeletesForResolvedAccount() throws Exception {
        Authentication authentication = new UsernamePasswordAuthenticationToken("jane@example.com", null, java.util.List.of());
        when(users.findByEmailIgnoreCase("jane@example.com")).thenReturn(Optional.of(user));

        mockMvc.perform(delete("/api/webauthn/credentials").principal(authentication))
                .andExpect(status().isNoContent());

        verify(webAuthnService).disableForUser(user);
    }

    @Test
    void disableCredentialsRejectsUnknownUser() throws Exception {
        Authentication authentication = new UsernamePasswordAuthenticationToken("missing@example.com", null, java.util.List.of());
        when(users.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());
        when(users.findByUsernameIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        mockMvc.perform(delete("/api/webauthn/credentials").principal(authentication))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("User account not found."));

        verifyNoInteractions(webAuthnService);
    }
}
