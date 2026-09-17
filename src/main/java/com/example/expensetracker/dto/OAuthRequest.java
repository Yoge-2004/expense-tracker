package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** Request body for Google OAuth login. */
@Schema(description = "Payload containing Google ID token for OAuth authentication")
public record OAuthRequest(
        @Schema(description = "Google ID token string", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Google ID token is required")
        String idToken
) {}
