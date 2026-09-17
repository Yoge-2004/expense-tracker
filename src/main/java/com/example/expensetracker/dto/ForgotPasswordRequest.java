package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** Request body for POST /api/auth/forgot-password. */
@Schema(description = "Identifies the account to send a password-reset code to")
public record ForgotPasswordRequest(
        @NotBlank(message = "Email is required")
        @Schema(description = "Email address of the account requesting a reset code", example = "john.doe@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
        String email
) {}
