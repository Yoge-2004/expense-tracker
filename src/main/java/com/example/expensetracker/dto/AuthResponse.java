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
        @Schema(description = "Signed JWT Bearer token. Pass as: Authorization: Bearer <token>",
                example = "eyJhbGciOiJIUzI1NiJ9...")
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

        @Schema(description = "Whether the user has configured a 6-digit Security PIN for zero-email recovery",
                example = "true")
        Boolean hasSecurityPin,

        @Schema(description = "URL of the user profile avatar picture (e.g. from Google OAuth)",
                example = "https://lh3.googleusercontent.com/a/...")
        String profilePictureUrl,

        @Schema(description = "Role-based access authority assigned to the user", example = "ROLE_USER")
        String role
) {
    public AuthResponse(String token, Long userId, String name, String username, String email, String currency, Boolean hasSecurityPin) {
        this(token, userId, name, username, email, currency, hasSecurityPin, null, "ROLE_USER");
    }

    public AuthResponse(String token, Long userId, String name, String username, String email, String currency, Boolean hasSecurityPin, String profilePictureUrl) {
        this(token, userId, name, username, email, currency, hasSecurityPin, profilePictureUrl, "ROLE_USER");
    }
}
