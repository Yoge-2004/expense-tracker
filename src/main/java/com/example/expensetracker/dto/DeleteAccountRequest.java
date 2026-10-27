package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request payload for DELETE /api/users/{userId}.
 * Requires user credentials (password, security PIN, or Google ID token)
 * to prevent unauthorized or accidental cascading account destruction.
 */
@Schema(description = "Confirmation credentials required to permanently delete a user account")
public record DeleteAccountRequest(
        @Schema(description = "The user's current account password", example = "secret123")
        @Size(max = 255, message = "Password is too long")
        String password,

        @Schema(description = "Optional 6-digit Security PIN", example = "123456")
        @Pattern(regexp = "^$|^\\d{6}$", message = "Security PIN must be exactly 6 digits")
        String securityPin,

        @Schema(description = "Optional Google OAuth ID token for Google Sign-in accounts")
        @Size(max = 4096, message = "Google token is too long")
        String googleIdToken
) {
}
