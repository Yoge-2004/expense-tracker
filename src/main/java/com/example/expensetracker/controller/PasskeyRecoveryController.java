package com.example.expensetracker.controller;

import com.example.expensetracker.dto.PasskeyRecoveryRequest;
import com.example.expensetracker.security.RateLimited;
import com.example.expensetracker.service.PasskeyRecoveryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Reset a forgotten password with a passkey. Public (the user cannot sign in), so both endpoints are
 * strictly rate limited, and the only thing that authorises the change is a valid user-verified assertion.
 *
 * <ol>
 *   <li>{@code POST /options} returns an assertion challenge (no account is named).</li>
 *   <li>{@code POST /finish} verifies the signed assertion and sets the new password.</li>
 * </ol>
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/webauthn/recovery")
public class PasskeyRecoveryController {

    private final PasskeyRecoveryService passkeyRecoveryService;

    @Operation(summary = "Start password reset with a passkey",
            description = "Returns the assertion challenge to sign with a registered passkey.")
    @SecurityRequirements
    @PostMapping("/options")
    @RateLimited(key = "webauthn-recovery-options", maxRequests = 10, windowSeconds = 600,
            message = "Too many attempts. Please try again in %d seconds.")
    public ResponseEntity<Map<String, String>> options() {
        return ResponseEntity.ok(passkeyRecoveryService.startRecovery());
    }

    @Operation(summary = "Reset the password with a signed passkey assertion",
            description = "Verifies the assertion (signature, single-use challenge, user verification) and, only "
                    + "then, sets the new password.")
    @SecurityRequirements
    @PostMapping("/finish")
    @RateLimited(key = "webauthn-recovery-finish", maxRequests = 5, windowSeconds = 600,
            message = "Too many password reset attempts. Please try again in %d seconds.")
    public ResponseEntity<Void> finish(@Valid @RequestBody PasskeyRecoveryRequest request) {
        passkeyRecoveryService.resetPassword(request.transactionId(), request.credential(), request.newPassword());
        return ResponseEntity.ok().build();
    }
}
