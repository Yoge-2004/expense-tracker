package com.example.expensetracker.security;

import com.example.expensetracker.exception.BadRequestException;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Verifies the Security PIN an administrator supplies to confirm a high-privilege action.
 *
 * <p>A wrong PIN counts toward the same lockout the ordinary PIN flows use, so a stolen
 * administrator session cannot be used to guess the PIN: after {@value #MAX_FAILED_ATTEMPTS}
 * failures the PIN is locked for {@value #LOCK_MINUTES} minutes. The counter is written in its
 * own transaction so it survives the exception that rejects the request.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StepUpPinVerifier {

    static final int MAX_FAILED_ATTEMPTS = 5;
    static final int LOCK_MINUTES = 15;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * @param actor the administrator confirming the action
     * @param pin   the PIN they typed
     * @throws BadRequestException when no PIN is configured, the PIN is locked, or the PIN is wrong
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BadRequestException.class)
    public void verify(User actor, String pin) {
        User current = userRepository.findById(actor.getId()).orElse(actor);

        if (!current.hasSecurityPin()) {
            throw new BadRequestException(
                    "You must configure a Security PIN on your administrator account before executing high-privilege actions");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime lockedUntil = current.getPinLockedUntil();
        if (lockedUntil != null) {
            if (lockedUntil.isAfter(now)) {
                long minutes = Math.max(1, Duration.between(now.atZone(ZoneId.systemDefault()), lockedUntil.atZone(ZoneId.systemDefault())).toMinutes() + 1);
                throw new BadRequestException(
                        "Security PIN is temporarily locked after too many wrong attempts. Try again in about "
                                + minutes + " minute(s).");
            }
            current.setPinLockedUntil(null);
            current.setFailedPinAttempts(0);
        }

        if (pin != null && passwordEncoder.matches(pin, current.getSecurityPinHash())) {
            if (current.getFailedPinAttempts() > 0 || current.getPinLockedUntil() != null) {
                current.setFailedPinAttempts(0);
                current.setPinLockedUntil(null);
                userRepository.save(current);
            }
            return;
        }

        int failed = current.getFailedPinAttempts() + 1;
        current.setFailedPinAttempts(failed);
        if (failed >= MAX_FAILED_ATTEMPTS) {
            current.setPinLockedUntil(now.plusMinutes(LOCK_MINUTES));
            log.warn("Step-up PIN locked for userId={} after {} failed attempts", current.getId(), failed);
        }
        userRepository.save(current);
        throw new BadRequestException("Invalid step-up Security PIN. Verification failed.");
    }
}
