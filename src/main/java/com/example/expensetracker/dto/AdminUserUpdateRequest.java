package com.example.expensetracker.dto;

import com.example.expensetracker.model.Role;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Administrative payload for updating user profile, role, status, password, or PIN.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Payload for administrative user updates with step-up verification")
public record AdminUserUpdateRequest(
        @Schema(description = "Full name of the user", example = "Jane Doe")
        @NotBlank(message = "Name is required")
        @Size(max = 100, message = "Name must not exceed 100 characters")
        String name,

        @Schema(description = "Unique username handle", example = "janedoe")
        @NotBlank(message = "Username is required")
        @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
        String username,

        @Schema(description = "Valid email address", example = "jane@example.com")
        @NotBlank(message = "Email is required")
        @Email(message = "Email must be a valid email format")
        String email,

        @Schema(description = "Assigned authority role", example = "ROLE_USER")
        Role role,

        @Schema(description = "Account lock status", example = "false")
        Boolean accountLocked,

        @Schema(description = "Optional password override (leave blank to keep existing)", example = "NewPass@123")
        @Size(max = 100, message = "Password must not exceed 100 characters")
        String newPassword,

        @Schema(description = "Optional new 6-digit Security PIN (leave blank to keep existing)", example = "654321")
        @Pattern(regexp = "^$|^[0-9]{6}$", message = "Security PIN must be a 6-digit numeric string")
        String newPin,

        @Schema(description = "Actor admin's 6-digit Security PIN for step-up verification", example = "123456")
        @NotBlank(message = "Step-up PIN is required for account modification")
        String stepUpPin
) {}
