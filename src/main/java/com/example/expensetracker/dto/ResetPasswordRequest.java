package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Request body for PUT /api/auth/reset-password. */
@Schema(description = "Identifies the account and supplies the new password")
public class ResetPasswordRequest {

    @Schema(description = "Email address of the account whose password will be reset", example = "john.doe@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
    private String email;

    @Schema(description = "New plain-text password — BCrypt-encoded before storage", example = "newSecret456", requiredMode = Schema.RequiredMode.REQUIRED)
    private String newPassword;

    public ResetPasswordRequest() {}

    public String getEmail()                       { return email; }
    public void   setEmail(String email)           { this.email = email; }
    public String getNewPassword()                 { return newPassword; }
    public void   setNewPassword(String p)         { this.newPassword = p; }
}
