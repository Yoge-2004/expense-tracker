package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request body for PUT /api/auth/reset-password. */
@Schema(description = "Identifies the account, proves control via 6-digit Security PIN or email OTP, and supplies the new password")
public record ResetPasswordRequest(
        @NotBlank(message = "Email is required")
        @Schema(description = "Email address of the account whose password will be reset", example = "john.doe@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
        String email,

        @Schema(description = "6-digit one-time code sent to email OR 6-digit Security PIN", example = "123456")
        String otp,

        @Schema(description = "6-digit Security PIN set by the user", example = "123456")
        String securityPin,

        @NotBlank(message = "New password is required")
        @Size(min = 6, message = "Password must be at least 6 characters")
        @Schema(description = "New plain-text password — BCrypt-encoded before storage", example = "newSecret456", requiredMode = Schema.RequiredMode.REQUIRED)
        String newPassword
) {

    @AssertTrue(message = "OTP or Security PIN is required")
    public boolean isVerificationCodePresent() {
        return (otp != null && !otp.isBlank()) || (securityPin != null && !securityPin.isBlank());
    }

    /** Returns the code to verify: prefers explicit securityPin if provided, otherwise otp. */
    public String resolveVerificationCode() {
        if (securityPin != null && !securityPin.isBlank()) {
            return securityPin.trim();
        }
        return otp != null ? otp.trim() : "";
    }
}
