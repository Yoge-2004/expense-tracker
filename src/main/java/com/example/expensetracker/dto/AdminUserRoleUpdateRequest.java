package com.example.expensetracker.dto;

import com.example.expensetracker.model.Role;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * High-privilege request payload for elevating or demoting a user's role.
 * Requires mandatory step-up Security PIN verification from the actor Super Admin.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Payload for changing user RBAC role with step-up verification")
public record AdminUserRoleUpdateRequest(
        @Schema(description = "Target RBAC role to assign", example = "ROLE_ADMIN")
        @NotNull(message = "Role must not be null")
        Role role,

        @Schema(description = "Actor admin's 6-digit Security PIN for step-up verification", example = "123456")
        @NotBlank(message = "Step-up PIN is required for role modification")
        String stepUpPin,

        @Schema(description = "Audit justification for role update", example = "Promoted to support lead")
        @Size(max = 500, message = "Reason cannot exceed 500 characters")
        String reason
) {}
