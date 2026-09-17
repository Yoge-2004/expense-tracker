package com.example.expensetracker.controller;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.WebAuthnService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/webauthn")
public class WebAuthnController {

    private static final Logger log = LoggerFactory.getLogger(WebAuthnController.class);

    private final WebAuthnService webAuthnService;
    private final UserRepository users;

    public WebAuthnController(WebAuthnService webAuthnService, UserRepository users) {
        this.webAuthnService = webAuthnService;
        this.users = users;
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
        @RequestBody WebAuthnFinishRequest request
    ) {
        User user = currentUser(authentication);
        log.info("Completing WebAuthn registration for userId={}, transactionId={}", user.getId(), request.transactionId());
        webAuthnService.finishRegistration(user, request.transactionId(), request.credential());
        log.info("WebAuthn registration finished successfully for userId={}", user.getId());
        return ResponseEntity.ok(Map.of("message", "Biometric sign-in is now enabled on this device."));
    }

    @PostMapping("/login/options")
    public ResponseEntity<Map<String, String>> loginOptions() {
        log.info("Initiating WebAuthn biometric login options");
        return ResponseEntity.ok(webAuthnService.startAuthentication());
    }

    @PostMapping("/login/finish")
    public ResponseEntity<Map<String, Object>> loginFinish(@RequestBody WebAuthnFinishRequest request) {
        log.info("Completing WebAuthn biometric login for transactionId={}", request.transactionId());
        Map<String, Object> result = webAuthnService.finishAuthentication(request.transactionId(), request.credential());
        log.info("WebAuthn biometric login successful for transactionId={}", request.transactionId());
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
        if (authentication == null || !authentication.isAuthenticated()) {
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

    public record WebAuthnFinishRequest(String transactionId, String credential) {}
}
