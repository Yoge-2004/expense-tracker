package com.example.expensetracker.domain.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;

/**
 * Focused implementation of {@link UserProfileService} responsible for user lookup,
 * profile updates, currency preferences, and username handle suggestions.
 */
@Slf4j
@Primary
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserProfileServiceImpl implements UserProfileService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;

    @Override
    public Optional<User> findByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }
        String query = identifier.trim();
        log.debug("Finding user by supplied identifier");
        return userRepository.findByEmailIgnoreCase(query)
                .or(() -> userRepository.findByUsernameIgnoreCase(query));
    }

    @Override
    public Optional<User> findByEmail(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        log.debug("Finding user by email identifier");
        return userRepository.findByEmailIgnoreCase(email.trim())
                .or(() -> userRepository.findByEmail(email));
    }

    @Override
    public Optional<User> findById(Long id) {
        if (id == null) {
            return Optional.empty();
        }
        log.debug("Finding user by id: {}", id);
        return userRepository.findById(id);
    }

    @Override
    @Transactional
    public void updateName(Long userId, String name) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (name == null || name.trim().length() < 2 || name.trim().length() > 50) {
            throw new IllegalArgumentException("Display name must be between 2 and 50 characters.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setName(name.trim());
        userRepository.save(user);
        log.info("Display name updated successfully for userId={} to '{}'", userId, user.getName());
    }

    @Override
    @Transactional
    public void updateCurrency(Long userId, String currency) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (currency == null || !currency.matches("^[A-Za-z]{3}$")) {
            throw new IllegalArgumentException("Currency must be a 3-letter ISO 4217 code.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setCurrency(currency.toUpperCase(Locale.ROOT));
        userRepository.save(user);
        log.info("Currency updated successfully for userId={} to {}", userId, user.getCurrency());
    }

    @Override
    @Transactional
    public void updateProfilePicture(Long userId, String profilePictureUrl) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setProfilePictureUrl(profilePictureUrl);
        userRepository.save(user);
        log.info("Profile picture updated successfully for userId={}", userId);
    }

    @Override
    @Transactional
    public User updateProfile(Long userId, String name, String profilePictureUrl) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (name == null || name.trim().length() < 2 || name.trim().length() > 50) {
            throw new IllegalArgumentException("Display name must be between 2 and 50 characters.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setName(name.trim());
        if (profilePictureUrl != null && !profilePictureUrl.isBlank()) {
            user.setProfilePictureUrl(profilePictureUrl.trim());
        }
        User saved = userRepository.save(user);
        log.info("Profile updated successfully for userId={}", userId);
        return saved;
    }

    @Override
    public List<String> suggestUsernames(String base) {
        String clean = (base != null) ? base.replaceAll("[^a-zA-Z0-9]", "").toLowerCase(Locale.ROOT) : "";
        if (clean.isEmpty()) {
            clean = "user";
        }

        Set<String> uniqueSuggestions = new LinkedHashSet<>();
        String[] prefixes = {"iam", "the", "real", "hey", "go"};
        for (String prefix : prefixes) {
            if (uniqueSuggestions.size() >= 3) {
                break;
            }
            String candidate = (prefix + "_" + clean).replaceAll("[^a-zA-Z0-9_]", "");
            if (candidate.length() > 30) {
                candidate = candidate.substring(0, 30);
            }
            if (!userRepository.existsByUsernameIgnoreCase(candidate)) {
                uniqueSuggestions.add(candidate);
            }
        }

        int attempts = 0;
        while (uniqueSuggestions.size() < 3 && attempts < 100) {
            attempts++;
            int num = 100 + RANDOM.nextInt(900);
            String candidate = clean + num;
            if (candidate.length() > 30) {
                candidate = candidate.substring(0, 30);
            }
            if (!userRepository.existsByUsernameIgnoreCase(candidate)) {
                uniqueSuggestions.add(candidate);
            }
        }
        return new ArrayList<>(uniqueSuggestions);
    }
}
