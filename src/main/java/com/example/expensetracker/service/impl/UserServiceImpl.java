package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.*;
import com.example.expensetracker.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Concrete implementation of {@link UserService} providing business logic
 * for user registration, lookup, password management, and account deletion.
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
        log.info("Attempting to register user");
        String normalizedEmail = user.getEmail().trim();
        if (userRepository.findByEmailIgnoreCase(normalizedEmail).isPresent()) {
            log.warn("Registration rejected because email is already registered");
            throw new IllegalArgumentException("User with this email already exists");
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            String normalizedUsername = user.getUsername().trim();
            if (userRepository.findByUsernameIgnoreCase(normalizedUsername).isPresent()) {
                log.warn("Registration rejected because username is already registered");
                throw new IllegalArgumentException("Username '" + normalizedUsername + "' is already taken. Please choose another.");
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
        String q = identifier.trim();
        log.debug("Finding user by supplied identifier");
        return userRepository.findByEmailIgnoreCase(q)
                .or(() -> userRepository.findByUsernameIgnoreCase(q));
    }

    @Override
    public Optional<User> findByEmail(String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        log.debug("Finding user by email identifier");
        return userRepository.findByEmailIgnoreCase(email.trim())
                .or(() -> userRepository.findByEmail(email));
    }

    @Override
    public Optional<User> findById(Long id) {
        log.debug("Finding user by id: {}", id);
        return userRepository.findById(id);
    }

    @Override
    @Transactional
    public void updateSecurityPin(Long userId, String newPin) {
        if (newPin == null || !newPin.matches("^[0-9]{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 digits.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setSecurityPinHash(passwordEncoder.encode(newPin));
        user.setFailedPinAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public boolean verifySecurityPin(Long userId, String pin) {
        if (pin == null || pin.isBlank()) return false;
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getPinLockedUntil() != null && user.getPinLockedUntil().isAfter(LocalDateTime.now())) {
            return false;
        }
        if (user.getSecurityPinHash() == null || user.getSecurityPinHash().isBlank()) return false;
        if (passwordEncoder.matches(pin, user.getSecurityPinHash())) {
            user.setFailedPinAttempts(0);
            user.setPinLockedUntil(null);
            userRepository.save(user);
            return true;
        }
        int attempts = Optional.ofNullable(user.getFailedPinAttempts()).orElse(0) + 1;
        user.setFailedPinAttempts(attempts);
        if (attempts >= 5) {
            user.setPinLockedUntil(LocalDateTime.now().plusMinutes(15));
            user.setFailedPinAttempts(0);
        }
        userRepository.save(user);
        return false;
    }

    @Override
    @Transactional
    public void updateCurrency(Long userId, String currency) {
        if (currency == null || !currency.matches("^[A-Za-z]{3}$")) {
            throw new IllegalArgumentException("Currency must be a 3-letter ISO 4217 code.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setCurrency(currency.toUpperCase(java.util.Locale.ROOT));
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        expenseRepository.deleteByUserId(userId);
        recurringRepository.deleteByUserId(userId);
        incomeRepository.deleteByUserId(userId);
        budgetRepository.deleteByUserId(userId);
        savingsGoalRepository.deleteByUserId(userId);
        categoryRepository.deleteByUserId(userId);
        userRepository.delete(user);
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
