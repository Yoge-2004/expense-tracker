package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * Request payload for Google OAuth authentication and auto-onboarding.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Payload containing Google ID token and optional onboarding preferences for OAuth authentication")
public record OAuthRequest(
        @Schema(description = "Google ID token string", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Google ID token is required")
        String idToken,

        @Schema(description = "Optional custom user handle/username preference", example = "johndoe")
        String username,

        @Schema(description = "Optional preferred display currency (ISO 4217 3-letter code)", example = "USD")
        String currency
) {
}
