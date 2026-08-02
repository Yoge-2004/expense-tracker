package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request body for PUT /api/auth/reset-password. */
@Schema(description = "Identifies the account, proves control of it via OTP, and supplies the new password")
public class ResetPasswordRequest {

    @NotBlank(message = "Email is required")
    @Schema(description = "Email address of the account whose password will be reset", example = "john.doe@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
    private String email;

    @NotBlank(message = "OTP is required")
    @Schema(description = "6-digit one-time code sent to the account's email via POST /api/auth/forgot-password", example = "482913", requiredMode = Schema.RequiredMode.REQUIRED)
    private String otp;

    @NotBlank(message = "New password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    @Schema(description = "New plain-text password — BCrypt-encoded before storage", example = "newSecret456", requiredMode = Schema.RequiredMode.REQUIRED)
    private String newPassword;

    public ResetPasswordRequest() {}

    public String getEmail()                       { return email; }
    public void   setEmail(String email)           { this.email = email; }
    public String getOtp()                         { return otp; }
    public void   setOtp(String otp)               { this.otp = otp; }
    public String getNewPassword()                 { return newPassword; }
    public void   setNewPassword(String p)         { this.newPassword = p; }
}
