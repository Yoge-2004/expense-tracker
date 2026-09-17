package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request body for POST /api/auth/register. */
@Schema(description = "Information required to create a new user account")
public record RegisterRequest(
        @Schema(description = "Full display name of the new user", example = "John Doe", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Name is required")
        String name,

        @Schema(description = "Unique login handle, distinct from the display name", example = "johndoe_26", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Username is required")
        @Pattern(
                regexp = "^[a-zA-Z0-9._]{3,30}$",
                message = "Username must be 3-30 characters and contain only letters, numbers, dots, or underscores")
        String username,

        @Schema(description = "Email address — used as the unique login identifier", example = "john.doe@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        String email,

        @Schema(description = "Plain-text password — BCrypt-encoded before storage. Minimum 6 characters.", example = "secret123", minLength = 6, requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Password is required")
        @Size(min = 6, message = "Password must be at least 6 characters")
        String password,

        @Schema(description = "6-digit email verification OTP (required when email verification is enabled)", example = "482913")
        String otp,

        @Schema(description = "Optional 6-digit Security PIN for zero-email instant recovery and biometric verification", example = "123456")
        @Pattern(
                regexp = "^$|^[0-9]{6}$",
                message = "Security PIN must be exactly 6 numeric digits")
        String securityPin,

        @Schema(description = "Preferred display currency (ISO 4217 3-letter code). Defaults to INR if omitted.", example = "INR")
        @Pattern(
                regexp = "^[A-Za-z]{3}$",
                message = "Currency must be a 3-letter ISO 4217 code (e.g. INR, USD, EUR)")
        String currency
) {
    public RegisterRequest {
        if (currency == null || currency.isBlank()) {
            currency = "INR";
        }
    }
}
