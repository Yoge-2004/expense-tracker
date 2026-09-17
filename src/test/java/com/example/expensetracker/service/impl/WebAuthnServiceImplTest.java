package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.User;
import com.example.expensetracker.model.WebAuthnChallenge;
import com.example.expensetracker.model.WebAuthnCredential;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.repository.WebAuthnChallengeRepository;
import com.example.expensetracker.repository.WebAuthnCredentialRepository;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.WebAuthnCredentialRepositoryAdapter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebAuthnServiceImplTest {

    @Mock private WebAuthnChallengeRepository challenges;
    @Mock private WebAuthnCredentialRepository credentials;
    @Mock private UserRepository users;
    @Mock private JwtService jwtService;
    @Mock private WebAuthnCredentialRepositoryAdapter credentialRepositoryAdapter;

    private WebAuthnServiceImpl service;
    private User testUser;

    @BeforeEach
    void setUp() {
        service = new WebAuthnServiceImpl(
                challenges,
                credentials,
                users,
                jwtService,
                credentialRepositoryAdapter,
                "localhost",
                "http://localhost:8080"
        );

        testUser = new User();
        testUser.setId(10L);
        testUser.setEmail("alice@test.com");
        testUser.setName("Alice");
    }

    @Test
    @DisplayName("isWebAuthnEnabled returns true when user has registered credentials")
    void isWebAuthnEnabled_hasCredentials_returnsTrue() {
        WebAuthnCredential cred = new WebAuthnCredential();
        cred.setId(1L);
        when(credentials.findByUserId(10L)).thenReturn(List.of(cred));
        assertTrue(service.isWebAuthnEnabled(testUser));
    }

    @Test
    @DisplayName("isWebAuthnEnabled returns false when user has no registered credentials")
    void isWebAuthnEnabled_noCredentials_returnsFalse() {
        when(credentials.findByUserId(10L)).thenReturn(Collections.emptyList());
        assertFalse(service.isWebAuthnEnabled(testUser));
    }

    @Test
    @DisplayName("isWebAuthnEnabled returns false for null user or null userId")
    void isWebAuthnEnabled_nullUser_returnsFalse() {
        assertFalse(service.isWebAuthnEnabled(null));
        User emptyUser = new User();
        assertFalse(service.isWebAuthnEnabled(emptyUser));
    }

    @Test
    @DisplayName("startRegistration generates registration challenge and transaction ID")
    void startRegistration_generatesChallenge() {
        when(credentials.findByUserId(10L)).thenReturn(Collections.emptyList());

        Map<String, String> response = service.startRegistration(testUser);

        assertNotNull(response);
        assertTrue(response.containsKey("transactionId"));
        assertTrue(response.containsKey("publicKey"));
        verify(challenges).save(any(WebAuthnChallenge.class));
    }

    @Test
    @DisplayName("startAuthentication generates assertion challenge and transaction ID")
    void startAuthentication_generatesChallenge() {
        Map<String, String> response = service.startAuthentication();

        assertNotNull(response);
        assertTrue(response.containsKey("transactionId"));
        assertTrue(response.containsKey("publicKey"));
        verify(challenges).save(any(WebAuthnChallenge.class));
    }

    @Test
    @DisplayName("disableForUser removes all user credentials")
    void disableForUser_deletesCredentials() {
        WebAuthnCredential cred = new WebAuthnCredential();
        cred.setId(1L);
        when(credentials.findByUserId(10L)).thenReturn(List.of(cred));

        service.disableForUser(testUser);

        verify(credentials).deleteAll(List.of(cred));
    }
}
