package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Request payload for moderating a user's account state (lock/unlock or enable/disable).
 *
 * @author Yogeshwaran
 */
@Schema(description = "Payload for locking or disabling an account")
public record AdminUserStatusUpdateRequest(
        @Schema(description = "Whether to lock the account (prevents login)", example = "true")
        Boolean accountLocked,

        @Schema(description = "Whether to enable the account", example = "true")
        Boolean enabled,

        @Schema(description = "Mandatory administrative reason for audit trail", example = "Suspicious login attempts detected from anomalous IP")
        @Size(max = 500, message = "Reason cannot exceed 500 characters")
        String reason
) {}
