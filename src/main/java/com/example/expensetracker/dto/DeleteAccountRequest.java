package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Request payload for DELETE /api/users/{userId}.
 * Requires user credentials (password, security PIN, or Google ID token)
 * to prevent unauthorized or accidental cascading account destruction.
 */
@Schema(description = "Confirmation credentials required to permanently delete a user account")
public class DeleteAccountRequest {

    @Schema(description = "The user's current account password", example = "secret123")
    private String password;

    @Schema(description = "Optional 6-digit Security PIN", example = "123456")
    private String securityPin;

    @Schema(description = "Optional Google OAuth ID token for Google Sign-in accounts")
    private String googleIdToken;

    public DeleteAccountRequest() {}

    public DeleteAccountRequest(String password) {
        this.password = password;
    }

    public DeleteAccountRequest(String password, String securityPin, String googleIdToken) {
        this.password = password;
        this.securityPin = securityPin;
        this.googleIdToken = googleIdToken;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getSecurityPin() {
        return securityPin;
    }

    public void setSecurityPin(String securityPin) {
        this.securityPin = securityPin;
    }

    public String getGoogleIdToken() {
        return googleIdToken;
    }

    public void setGoogleIdToken(String googleIdToken) {
        this.googleIdToken = googleIdToken;
    }
}
