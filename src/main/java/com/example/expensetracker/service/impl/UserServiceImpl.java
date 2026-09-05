package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;

/**
 * Business logic for user registration, identity lookup, recovery PINs,
 * currency preference, and complete account deletion.
 */
@Service
public class UserServiceImpl implements UserService {

    private static final Logger log = LoggerFactory.getLogger(UserServiceImpl.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ExpenseRepository expenseRepository;
    private final CategoryRepository categoryRepository;
    private final BudgetRepository budgetRepository;
    private final RecurringExpenseRepository recurringRepository;
    private final IncomeRepository incomeRepository;
    private final SavingsGoalRepository savingsGoalRepository;

    public UserServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           ExpenseRepository expenseRepository,
                           CategoryRepository categoryRepository,
                           BudgetRepository budgetRepository,
                           RecurringExpenseRepository recurringRepository,
                           IncomeRepository incomeRepository,
                           SavingsGoalRepository savingsGoalRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.expenseRepository = expenseRepository;
        this.categoryRepository = categoryRepository;
        this.budgetRepository = budgetRepository;
        this.recurringRepository = recurringRepository;
        this.incomeRepository = incomeRepository;
        this.savingsGoalRepository = savingsGoalRepository;
    }

    @Override
    @Transactional
    public User registerUser(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User is required");
        }

        String email = normalizeEmail(user.getEmail());
        String password = user.getPassword();
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }

        log.info("Attempting to register user with email={}, username={}", email, user.getUsername());

        // Authentication is case-insensitive, so uniqueness must use the same
        // identity rule before relying on a database-level unique constraint.
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("User with this email already exists");
        }

        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            String username = user.getUsername().trim();
            if (userRepository.existsByUsernameIgnoreCase(username)) {
                throw new IllegalArgumentException("Username '" + username + "' is already taken. Please choose another.");
            }
            user.setUsername(username);
        }

        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        if (user.getSecurityPinHash() != null && !user.getSecurityPinHash().isBlank()) {
            user.setSecurityPinHash(passwordEncoder.encode(user.getSecurityPinHash().trim()));
        }
        user.setEnabled(true);
        if (user.getCurrency() == null || user.getCurrency().isBlank()) {
            user.setCurrency("INR");
        } else {
            user.setCurrency(user.getCurrency().trim().toUpperCase(Locale.ROOT));
        }

        User savedUser = userRepository.save(user);
        log.info("User registered successfully with id={}", savedUser.getId());
        return savedUser;
    }

    @Override
    public Optional<User> findByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }
        String normalized = identifier.trim();
        return userRepository.findByEmailIgnoreCase(normalized)
                .or(() -> userRepository.findByUsernameIgnoreCase(normalized));
    }

    @Override
    public Optional<User> findByEmail(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return userRepository.findByEmailIgnoreCase(email.trim())
                .or(() -> userRepository.findByEmail(email.trim()));
    }

    @Override
    public Optional<User> findById(Long id) {
        if (id == null) {
            return Optional.empty();
        }
        return userRepository.findById(id);
    }

    @Override
    @Transactional
    public void updateSecurityPin(Long userId, String newPin) {
        validatePinFormat(newPin);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setSecurityPinHash(passwordEncoder.encode(newPin.trim()));
        user.setFailedPinAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public boolean verifySecurityPin(Long userId, String pin) {
        validatePinFormat(pin);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        LocalDateTime now = LocalDateTime.now();
        if (user.getPinLockedUntil() != null && user.getPinLockedUntil().isAfter(now)) {
            long minutesRemaining = java.time.Duration.between(now, user.getPinLockedUntil()).toMinutes() + 1;
            throw new IllegalStateException(
                    "Security PIN verification temporarily locked due to too many failed attempts. Please try again in "
                            + minutesRemaining + " minute(s)."
            );
        }

        if (!user.hasSecurityPin()) {
            throw new IllegalStateException("No security PIN has been set for this account.");
        }

        if (passwordEncoder.matches(pin.trim(), user.getSecurityPinHash())) {
            user.setFailedPinAttempts(0);
            user.setPinLockedUntil(null);
            userRepository.save(user);
            return true;
        }

        int failed = user.getFailedPinAttempts() + 1;
        user.setFailedPinAttempts(failed);
        if (failed >= 5) {
            user.setPinLockedUntil(now.plusMinutes(15));
        }
        userRepository.save(user);
        return false;
    }

    @Override
    @Transactional
    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Delete dependants first. This keeps the service safe even when the
        // database schema is configured without cascading foreign keys.
        expenseRepository.deleteAll(expenseRepository.findByUser(user));
        incomeRepository.deleteAll(incomeRepository.findByUser(user));
        savingsGoalRepository.deleteAll(savingsGoalRepository.findByUser(user));
        budgetRepository.deleteAll(budgetRepository.findByUser(user));
        recurringRepository.deleteAll(recurringRepository.findByUser(user));
        categoryRepository.deleteAll(categoryRepository.findByUser(user));
        userRepository.delete(user);
    }

    @Override
    @Transactional
    public void updateCurrency(Long userId, String currency) {
        if (currency == null || currency.isBlank() || !currency.trim().matches("[A-Za-z]{3}")) {
            throw new IllegalArgumentException("currency must be a 3-letter ISO 4217 code");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setCurrency(currency.trim().toUpperCase(Locale.ROOT));
        userRepository.save(user);
    }

    private void validatePinFormat(String pin) {
        if (pin == null || !pin.trim().matches("^[0-9]{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits.");
        }
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email address is required");
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
