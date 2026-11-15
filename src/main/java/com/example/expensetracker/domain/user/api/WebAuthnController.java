package com.example.expensetracker.domain.user.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.domain.user.service.WebAuthnService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;



/**
 * REST controller providing passkey / WebAuthn passwordless authentication endpoints.
 *
 * <p>Flow:
 * <ul>
 *   <li><b>Registration:</b> authenticated user calls {@code /register/options} to obtain the
 *       PublicKeyCredentialCreationOptions challenge, then submits the authenticator response
 *       to {@code /register/finish} to bind the credential to their account.</li>
 *   <li><b>Login:</b> unauthenticated visitor calls {@code /login/options} to get the assertion
 *       challenge, then presents the signed assertion to {@code /login/finish} which validates
 *       the signature and generates a JWT.</li>
 * </ul>
 */
@Tag(
    name = "Passkeys (WebAuthn)",
    description = """
        Passwordless sign-in with a device passkey (fingerprint, face or security key).

        **Registering** (signed-in user): call `register/options`, pass the returned options to the
        browser or device, then send the result to `register/finish`.

        **Signing in** (no token needed): call `login/options`, complete the device prompt, then
        send the result to `login/finish` to receive a JWT.

        `status` and `credentials` manage the passkey on the signed-in account.
        """
)
@SecurityRequirement(name = "BearerAuth")
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/webauthn")
public class WebAuthnController {

    private final WebAuthnService webAuthnService;
    private final UserRepository users;

    @Operation(summary = "Passkey status",
            description = "Tells whether the signed-in user has a passkey registered.")
    @ApiResponse(responseCode = "200", description = "`enabled` flag and the user id")
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(Authentication authentication) {
        User user = currentUser(authentication);
        boolean enabled = webAuthnService.isWebAuthnEnabled(user);
        log.info("Checking WebAuthn status for userId={}, enabled={}", user.getId(), enabled);
        return ResponseEntity.ok(Map.of("enabled", enabled, "userId", user.getId()));
    }

    @Operation(summary = "Start passkey registration",
            description = "Returns the WebAuthn creation options for the signed-in user. "
                    + "Pass them to the browser or device, then call `register/finish`.")
    @ApiResponse(responseCode = "200", description = "Registration options")
    @PostMapping("/register/options")
    public ResponseEntity<Map<String, String>> registrationOptions(Authentication authentication) {
        User user = currentUser(authentication);
        log.info("Initiating WebAuthn registration options for userId={}", user.getId());
        return ResponseEntity.ok(webAuthnService.startRegistration(user));
    }

    @Operation(summary = "Finish passkey registration",
            description = "Verifies the device's response and stores the new passkey.")
    @ApiResponse(responseCode = "200", description = "Passkey registered")
    @ApiResponse(responseCode = "400", description = "Missing or invalid registration response")
    @PostMapping("/register/finish")
    public ResponseEntity<Map<String, String>> registrationFinish(
        Authentication authentication,
        @Valid @RequestBody(required = false) WebAuthnFinishRequest request
    ) {
        User user = currentUser(authentication);
        String txId = request != null ? request.transactionId() : null;
        String cred = request != null ? request.credential() : null;
        log.info("Completing WebAuthn registration for userId={}, transactionId={}", user.getId(), txId);
        webAuthnService.finishRegistration(user, txId, cred);
        log.info("WebAuthn registration finished successfully for userId={}", user.getId());
        return ResponseEntity.ok(Map.of("message", "Biometric sign-in is now enabled on this device."));
    }

    @Operation(summary = "Start passkey sign-in",
            description = "Returns the WebAuthn request options. Public endpoint, no token needed.")
    @SecurityRequirements
    @ApiResponse(responseCode = "200", description = "Sign-in options")
    @PostMapping("/login/options")
    public ResponseEntity<Map<String, String>> loginOptions() {
        log.info("Initiating WebAuthn biometric login options");
        return ResponseEntity.ok(webAuthnService.startAuthentication());
    }

    @Operation(summary = "Finish passkey sign-in",
            description = "Verifies the device's response and, on success, returns a JWT. "
                    + "Public endpoint, no token needed.")
    @SecurityRequirements
    @ApiResponse(responseCode = "200", description = "Authenticated; token returned")
    @ApiResponse(responseCode = "401", description = "Passkey could not be verified")
    @PostMapping("/login/finish")
    public ResponseEntity<Map<String, Object>> loginFinish(
            @Valid @RequestBody(required = false) WebAuthnFinishRequest request) {
        String txId = request != null ? request.transactionId() : null;
        String cred = request != null ? request.credential() : null;
        log.info("Completing WebAuthn biometric login for transactionId={}", txId);
        Map<String, Object> result = webAuthnService.finishAuthentication(txId, cred);
        log.info("WebAuthn biometric login successful for transactionId={}", txId);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Remove passkey",
            description = "Disables passkey sign-in for the signed-in user.")
    @ApiResponse(responseCode = "204", description = "Passkey removed")
    @DeleteMapping("/credentials")
    public ResponseEntity<Void> disable(Authentication authentication) {
        User user = currentUser(authentication);
        log.info("Disabling WebAuthn credentials for userId={}", user.getId());
        webAuthnService.disableForUser(user);
        log.info("WebAuthn credentials disabled successfully for userId={}", user.getId());
        return ResponseEntity.noContent().build();
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            log.warn("WebAuthn endpoint accessed without valid authentication");
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.UNAUTHORIZED, "Authentication required."
            );
        }
        return users.findByEmailIgnoreCase(authentication.getName())
            .or(() -> users.findByUsernameIgnoreCase(authentication.getName()))
            .orElseThrow(() -> {
                log.warn("WebAuthn principal '{}' not found in database", authentication.getName());
                return new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED, "User account not found."
                );
            });
    }

    public record WebAuthnFinishRequest(
            @Size(max = 100, message = "Transaction id is too long")
            String transactionId,
            @Size(max = 65_536, message = "Credential payload is too large")
            String credential
    ) {}
}
