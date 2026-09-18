package com.example.expensetracker.controller;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.WebAuthnService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

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
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/webauthn")
public class WebAuthnController {

    private final WebAuthnService webAuthnService;
    private final UserRepository users;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(Authentication authentication) {
        User user = currentUser(authentication);
        boolean enabled = webAuthnService.isWebAuthnEnabled(user);
        log.info("Checking WebAuthn status for userId={}, enabled={}", user.getId(), enabled);
        return ResponseEntity.ok(Map.of("enabled", enabled, "userId", user.getId()));
    }

    @PostMapping("/register/options")
    public ResponseEntity<Map<String, String>> registrationOptions(Authentication authentication) {
        User user = currentUser(authentication);
        log.info("Initiating WebAuthn registration options for userId={}", user.getId());
        return ResponseEntity.ok(webAuthnService.startRegistration(user));
    }

    @PostMapping("/register/finish")
    public ResponseEntity<Map<String, String>> registrationFinish(
        Authentication authentication,
        @RequestBody(required = false) WebAuthnFinishRequest request
    ) {
        User user = currentUser(authentication);
        String txId = request != null ? request.transactionId() : null;
        String cred = request != null ? request.credential() : null;
        log.info("Completing WebAuthn registration for userId={}, transactionId={}", user.getId(), txId);
        webAuthnService.finishRegistration(user, txId, cred);
        log.info("WebAuthn registration finished successfully for userId={}", user.getId());
        return ResponseEntity.ok(Map.of("message", "Biometric sign-in is now enabled on this device."));
    }

    @PostMapping("/login/options")
    public ResponseEntity<Map<String, String>> loginOptions() {
        log.info("Initiating WebAuthn biometric login options");
        return ResponseEntity.ok(webAuthnService.startAuthentication());
    }

    @PostMapping("/login/finish")
    public ResponseEntity<Map<String, Object>> loginFinish(
            @RequestBody(required = false) WebAuthnFinishRequest request) {
        String txId = request != null ? request.transactionId() : null;
        String cred = request != null ? request.credential() : null;
        log.info("Completing WebAuthn biometric login for transactionId={}", txId);
        Map<String, Object> result = webAuthnService.finishAuthentication(txId, cred);
        log.info("WebAuthn biometric login successful for transactionId={}", txId);
        return ResponseEntity.ok(result);
    }

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
            String transactionId,
            String credential
    ) {}
}
