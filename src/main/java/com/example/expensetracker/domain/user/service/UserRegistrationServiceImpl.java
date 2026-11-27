package com.example.expensetracker.domain.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Locale;

import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;

/**
 * Focused implementation of {@link UserRegistrationService} responsible for new account onboarding
 * and unique credential availability checks.
 */
@Slf4j
@Primary
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserRegistrationServiceImpl implements UserRegistrationService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public User registerUser(User user) {
        log.info("Attempting to register user");
        if (user == null) {
            throw new IllegalArgumentException("User cannot be null");
        }
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new IllegalArgumentException("User email cannot be blank");
        }
        if (user.getPassword() == null || user.getPassword().isBlank()) {
            throw new IllegalArgumentException("User password cannot be blank");
        }

        String normalizedEmail = user.getEmail().trim();
        if (userRepository.findByEmailIgnoreCase(normalizedEmail).isPresent()) {
            log.warn("Registration rejected because email is already registered");
            throw new IllegalArgumentException("User with this email already exists");
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            String normalizedUsername = user.getUsername().trim();
            if (userRepository.findByUsernameIgnoreCase(normalizedUsername).isPresent()) {
                log.warn("Registration rejected because username is already registered");
                throw new IllegalArgumentException("Username '" + normalizedUsername
                        + "' is already taken. Please choose another.");
            }
            user.setUsername(normalizedUsername);
        }
        user.setEmail(normalizedEmail);
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        if (user.getSecurityPinHash() != null && !user.getSecurityPinHash().isBlank()) {
            user.setSecurityPinHash(passwordEncoder.encode(user.getSecurityPinHash().trim()));
        }
        user.setEnabled(true);
        if (user.getCurrency() == null || user.getCurrency().isBlank()) {
            user.setCurrency("INR");
        } else {
            String currency = user.getCurrency().trim();
            if (!currency.matches("^[A-Za-z]{3}$")) {
                throw new IllegalArgumentException(
                        "Currency must be a 3-letter ISO 4217 code (got '" + currency + "')");
            }
            user.setCurrency(currency.toUpperCase(Locale.ROOT));
        }
        User savedUser = userRepository.save(user);
        log.info("User registered successfully with id={}", savedUser.getId());
        return savedUser;
    }

    @Override
    public boolean userExistsByEmail(String email) {
        return email != null && userRepository.existsByEmailIgnoreCase(email.trim());
    }

    @Override
    public boolean userExistsByUsername(String username) {
        return username != null && userRepository.existsByUsernameIgnoreCase(username.trim());
    }
}
