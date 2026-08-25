package com.example.expensetracker.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for {@code POST /api/auth/oauth/google} — carries the raw
 * Google ID token obtained client-side via Google Identity Services, which
 * {@link com.example.expensetracker.security.GoogleIdTokenVerifier} then
 * cryptographically verifies server-side (checking signature, audience, and
 * expiry) before trusting any identity claims from it. The client-supplied
 * token is never trusted directly — only what the verified token itself
 * asserts after Google's own signature check passes.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OAuthRequest {
    @NotBlank(message = "Google ID token is required")
    private String idToken;
}
