package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Response returned on successful authentication (POST /api/auth/login). */
@Schema(description = "JWT token and basic user info returned after a successful login")
public record AuthResponse(
        @Schema(description = "Signed JWT Bearer token. Pass as: Authorization: Bearer <token>", example = "eyJhbGciOiJIUzI1NiJ9...")
        String token,

        @Schema(description = "Unique database ID of the authenticated user", example = "1")
        Long userId,

        @Schema(description = "Display name of the authenticated user", example = "John Doe")
        String name,

        @Schema(description = "Preferred display currency of the authenticated user (ISO 4217)", example = "INR")
        String currency,

        @Schema(description = "Whether the user has configured a 6-digit Security PIN for zero-email recovery", example = "true")
        Boolean hasSecurityPin
) {

    public AuthResponse(String token, Long userId, String name, String currency) {
        this(token, userId, name, currency, false);
    }
}
