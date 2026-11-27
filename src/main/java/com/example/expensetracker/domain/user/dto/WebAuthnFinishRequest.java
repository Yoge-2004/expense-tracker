package com.example.expensetracker.domain.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Request body sent after the client device completes a WebAuthn registration or login ceremony.
 *
 * @param transactionId opaque WebAuthn challenge/transaction identifier
 * @param credential    serialized authenticator credential JSON response
 */
@Schema(description = "WebAuthn ceremony completion payload containing challenge transaction ID and credential JSON")
public record WebAuthnFinishRequest(
        @Size(max = 100, message = "Transaction id is too long")
        String transactionId,
        @Size(max = 65_536, message = "Credential payload is too large")
        String credential
) {}
