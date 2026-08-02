package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** Request body for POST /api/auth/forgot-password. */
@Schema(description = "Identifies the account to send a password-reset code to")
public class ForgotPasswordRequest {

    @NotBlank(message = "Email is required")
    @Schema(description = "Email address of the account requesting a reset code", example = "john.doe@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
    private String email;

    public ForgotPasswordRequest() {}

    public String getEmail()             { return email; }
    public void   setEmail(String email) { this.email = email; }
}
