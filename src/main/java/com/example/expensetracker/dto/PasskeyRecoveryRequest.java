package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request body for POST /api/webauthn/recovery/finish. */
@Schema(description = "A signed passkey assertion plus the new password to set once it is verified")
public record PasskeyRecoveryRequest(
        @NotBlank(message = "Transaction ID is required")
        @Schema(description = "transactionId returned by /recovery/options", requiredMode = Schema.RequiredMode.REQUIRED)
        String transactionId,

        @NotBlank(message = "Passkey assertion is required")
        @Schema(description = "JSON of the signed assertion produced by navigator.credentials.get",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String credential,

        @NotBlank(message = "New password is required")
        @Size(min = 6, message = "Password must be at least 6 characters")
        @Schema(description = "New plain-text password — BCrypt-encoded before storage",
                example = "newSecret456", requiredMode = Schema.RequiredMode.REQUIRED)
        String newPassword
) {
}
