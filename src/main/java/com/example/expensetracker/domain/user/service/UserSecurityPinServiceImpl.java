package com.example.expensetracker.domain.user.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Primary;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDateTime;

import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;

/**
 * Focused implementation of {@link UserSecurityPinService} responsible for managing
 * and verifying 6-digit Security PINs with brute-force lockout protection.
 */
@Slf4j
@Primary
@Service
@Transactional(readOnly = true)
public class UserSecurityPinServiceImpl implements UserSecurityPinService {

    private static final int MAX_FAILED_PIN_ATTEMPTS = 5;
    private static final int LOCKOUT_MINUTES = 15;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    /**
     * Constructs the PIN service with an injectable {@link Clock} for deterministic lockout testing.
     *
     * @param userRepository  repository for loading and saving user PIN state
     * @param passwordEncoder encoder used to hash and verify 6-digit PINs
     * @param clock           time source used to evaluate and record lockout expiry; defaults to system zone
     */
    @Autowired
    public UserSecurityPinServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Autowired(required = false) Clock clock) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    /**
     * Convenience constructor defaulting {@link Clock} to {@link Clock#systemDefaultZone()}.
     *
     * @param userRepository  repository for loading and saving user PIN state
     * @param passwordEncoder encoder used to hash and verify 6-digit PINs
     */
    public UserSecurityPinServiceImpl(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this(userRepository, passwordEncoder, Clock.systemDefaultZone());
    }

    @Override
    @Transactional
    public void updateSecurityPin(Long userId, String newPin) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (newPin == null || !newPin.matches("^[0-9]{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 digits.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setSecurityPinHash(passwordEncoder.encode(newPin));
        user.setFailedPinAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
        log.info("Security PIN updated successfully for userId={}", userId);
    }

    @Override
    @Transactional
    public boolean verifySecurityPin(Long userId, String pin) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (pin == null || !pin.matches("^[0-9]{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        LocalDateTime now = LocalDateTime.now(clock);
        if (user.getPinLockedUntil() != null) {
            if (user.getPinLockedUntil().isAfter(now)) {
                log.warn("Security PIN verification blocked: userId={} is locked until {}",
                        userId, user.getPinLockedUntil());
                throw new IllegalStateException("Security PIN verification temporarily locked");
            }
            user.setPinLockedUntil(null);
            user.setFailedPinAttempts(0);
        }

        if (user.getSecurityPinHash() == null || user.getSecurityPinHash().isBlank()) {
            log.warn("Security PIN verification rejected: no PIN set for userId={}", userId);
            throw new IllegalStateException("No security PIN has been set");
        }

        if (passwordEncoder.matches(pin, user.getSecurityPinHash())) {
            user.setFailedPinAttempts(0);
            user.setPinLockedUntil(null);
            userRepository.save(user);
            log.info("Security PIN verified successfully for userId={}", userId);
            return true;
        }

        int attempts = user.getFailedPinAttempts() + 1;
        user.setFailedPinAttempts(attempts);
        if (attempts >= MAX_FAILED_PIN_ATTEMPTS) {
            user.setPinLockedUntil(now.plusMinutes(LOCKOUT_MINUTES));
            log.warn("Security PIN verification locked out for {} minutes for userId={} after {} attempts",
                    LOCKOUT_MINUTES, userId, attempts);
        } else {
            log.warn("Security PIN verification failed for userId={}, failedAttempts={}", userId, attempts);
        }
        userRepository.save(user);
        return false;
    }
}
