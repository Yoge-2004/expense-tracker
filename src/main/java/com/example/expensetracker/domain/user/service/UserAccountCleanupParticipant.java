package com.example.expensetracker.domain.user.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.user.repository.PasswordResetOtpRepository;
import com.example.expensetracker.domain.user.repository.UserAppearanceRepository;
import com.example.expensetracker.domain.user.repository.WebAuthnChallengeRepository;
import com.example.expensetracker.domain.user.repository.WebAuthnCredentialRepository;

/**
 * Deletes authentication credentials, WebAuthn challenges, appearance settings, and reset OTPs for a user.
 */
@Component
public class UserAccountCleanupParticipant implements UserCleanupParticipant {

    private final UserAppearanceRepository userAppearanceRepository;
    private final WebAuthnCredentialRepository webAuthnCredentialRepository;
    private final PasswordResetOtpRepository passwordResetOtpRepository;
    private final WebAuthnChallengeRepository webAuthnChallengeRepository;

    @Autowired
    public UserAccountCleanupParticipant(
            UserAppearanceRepository userAppearanceRepository,
            WebAuthnCredentialRepository webAuthnCredentialRepository,
            @Autowired(required = false) PasswordResetOtpRepository passwordResetOtpRepository,
            @Autowired(required = false) WebAuthnChallengeRepository webAuthnChallengeRepository) {
        this.userAppearanceRepository = userAppearanceRepository;
        this.webAuthnCredentialRepository = webAuthnCredentialRepository;
        this.passwordResetOtpRepository = passwordResetOtpRepository;
        this.webAuthnChallengeRepository = webAuthnChallengeRepository;
    }

    @Override
    public int order() {
        return 40;
    }

    @Override
    public void cleanupForUser(Long userId, String email) {
        if (userId != null) {
            userAppearanceRepository.deleteByUserId(userId);
            webAuthnCredentialRepository.deleteByUserId(userId);
            if (webAuthnChallengeRepository != null) {
                webAuthnChallengeRepository.deleteByUserId(userId);
            }
        }
        if (passwordResetOtpRepository != null && email != null) {
            passwordResetOtpRepository.deleteByEmailIgnoreCase(email);
        }
    }
}
