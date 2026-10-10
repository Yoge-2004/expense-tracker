package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.User;
import com.example.expensetracker.service.PasskeyRecoveryService;
import com.example.expensetracker.service.PasswordResetService;
import com.example.expensetracker.service.WebAuthnService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PasskeyRecoveryServiceImpl implements PasskeyRecoveryService {

    private static final int MIN_PASSWORD_LENGTH = 6;

    private final WebAuthnService webAuthnService;
    private final PasswordResetService passwordResetService;

    @Override
    public Map<String, String> startRecovery() {
        // Same challenge as sign-in: it names no account, so it reveals nothing about who has a passkey.
        return webAuthnService.startAuthentication();
    }

    @Override
    public void resetPassword(String transactionId, String credentialJson, String newPassword) {
        // Validate the password first: a weak one must not consume the single-use challenge
        // and force another fingerprint scan. This check does not depend on any account.
        if (newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException("New password is required.");
        }
        if (newPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalArgumentException("New password must be at least " + MIN_PASSWORD_LENGTH
                    + " characters long.");
        }

        User user = webAuthnService.verifyAssertionForRecovery(transactionId, credentialJson);
        passwordResetService.resetPasswordForVerifiedUser(user, newPassword);
        log.info("Passkey recovery completed for userId={}", user.getId());
    }
}
