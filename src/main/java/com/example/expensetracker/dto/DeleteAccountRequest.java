package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Request payload for DELETE /api/users/{userId}.
 * Requires user credentials (password, security PIN, or Google ID token)
 * to prevent unauthorized or accidental cascading account destruction.
 */
@Schema(description = "Confirmation credentials required to permanently delete a user account")
public record DeleteAccountRequest(
        @Schema(description = "The user's current account password", example = "secret123")
        String password,

        @Schema(description = "Optional 6-digit Security PIN", example = "123456")
        String securityPin,

        @Schema(description = "Optional Google OAuth ID token for Google Sign-in accounts")
        String googleIdToken
) {
    public DeleteAccountRequest(String password) {
        this(password, null, null);
    }
}
