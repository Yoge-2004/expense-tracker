package com.example.expensetracker.controller;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.WebAuthnService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/webauthn")
public class WebAuthnController {
    private final WebAuthnService webAuthnService;
    private final UserRepository users;

    public WebAuthnController(WebAuthnService webAuthnService, UserRepository users) {
        this.webAuthnService = webAuthnService;
        this.users = users;
    }

    @PostMapping("/register/options")
    public ResponseEntity<String> registrationOptions(Authentication authentication) {
        User user = currentUser(authentication);
        return ResponseEntity.ok(webAuthnService.startRegistration(user));
    }

    @PostMapping("/register/finish")
    public ResponseEntity<Map<String, String>> registrationFinish(
        Authentication authentication,
        @RequestBody WebAuthnFinishRequest request
    ) {
        User user = currentUser(authentication);
        webAuthnService.finishRegistration(user, request.transactionId(), request.credential());
        return ResponseEntity.ok(Map.of("message", "Biometric sign-in is now enabled on this device."));
    }

    @PostMapping("/login/options")
    public ResponseEntity<String> loginOptions() {
        return ResponseEntity.ok(webAuthnService.startAuthentication());
    }

    @PostMapping("/login/finish")
    public ResponseEntity<Map<String, Object>> loginFinish(@RequestBody WebAuthnFinishRequest request) {
        return ResponseEntity.ok(webAuthnService.finishAuthentication(request.transactionId(), request.credential()));
    }

    @DeleteMapping("/credentials")
    public ResponseEntity<Void> disable(Authentication authentication) {
        webAuthnService.disableForUser(currentUser(authentication));
        return ResponseEntity.noContent().build();
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.UNAUTHORIZED, "Authentication required."
            );
        }
        return users.findByEmailIgnoreCase(authentication.getName())
            .or(() -> users.findByUsernameIgnoreCase(authentication.getName()))
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.UNAUTHORIZED, "User account not found."
            ));
    }

    public record WebAuthnFinishRequest(String transactionId, String credential) {}
}
