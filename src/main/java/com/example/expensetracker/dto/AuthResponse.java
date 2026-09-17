package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Response payload returned on successful authentication across all ceremonies
 * (standard email/password login, Google OAuth, and WebAuthn biometric login).
 *
 * @author Yogeshwaran
 */
@Schema(description = "JWT Bearer token and complete user identity profile returned after successful authentication")
public record AuthResponse(
        @Schema(description = "Signed JWT Bearer token. Pass as: Authorization: Bearer <token>", example = "eyJhbGciOiJIUzI1NiJ9...")
        String token,

        @Schema(description = "Unique database ID of the authenticated user", example = "1")
        Long userId,

        @Schema(description = "Display name of the authenticated user", example = "John Doe")
        String name,

        @Schema(description = "Unique login handle/username of the authenticated user", example = "johndoe")
        String username,

        @Schema(description = "Email address of the authenticated user", example = "john.doe@example.com")
        String email,

        @Schema(description = "Preferred display currency of the authenticated user (ISO 4217)", example = "INR")
        String currency,

        @Schema(description = "Whether the user has configured a 6-digit Security PIN for zero-email recovery", example = "true")
        Boolean hasSecurityPin
) {

    public AuthResponse(String token, Long userId, String name, String currency) {
        this(token, userId, name, null, null, currency, false);
    }

    public AuthResponse(String token, Long userId, String name, String currency, Boolean hasSecurityPin) {
        this(token, userId, name, null, null, currency, hasSecurityPin);
    }
}
