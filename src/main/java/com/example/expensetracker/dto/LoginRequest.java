package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** Request body for POST /api/auth/login. */
@Schema(description = "Credentials required to authenticate a user")
public record LoginRequest(
        @Schema(description = "Registered email address or username of the user",
                example = "john.doe@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Email or username is required")
        String email,

        @Schema(description = "Account password (compared against BCrypt hash)",
                example = "secret123", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Password is required")
        String password
) {}
