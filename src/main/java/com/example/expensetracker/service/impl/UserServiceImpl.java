package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
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
 *
 * <p>This service coordinates interactions between {@link UserRepository},
 * {@link ExpenseRepository}, {@link CategoryRepository}, and the
 * {@link PasswordEncoder} to enforce unique emails, hashed passwords,
 * and clean cascading account deletion.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see UserService
 * @see UserRepository
 */
@Service
public class UserServiceImpl implements UserService {

    private static final Logger log = LoggerFactory.getLogger(UserServiceImpl.class);

    /** Repository for user entity persistence and lookup. */
    private final UserRepository userRepository;

    /** Encoder used to hash passwords before storing them in the database. */
    private final PasswordEncoder passwordEncoder;

    /** Repository for deleting expense records during account deletion. */
    private final ExpenseRepository expenseRepository;

    /** Repository for deleting user-created categories during account deletion. */
    private final CategoryRepository categoryRepository;

    /** Repository for deleting budget records during account deletion. */
    private final BudgetRepository budgetRepository;

    /** Repository for deleting recurring expense records during account deletion. */
    private final RecurringExpenseRepository recurringRepository;

    /** Repository for deleting income records during account deletion. */
    private final IncomeRepository incomeRepository;

    /** Repository for deleting savings goal records during account deletion. */
    private final SavingsGoalRepository savingsGoalRepository;

    /**
     * Constructs a new {@code UserServiceImpl} with all required repositories
     * and the password encoder injected by Spring.
     *
     * @param userRepository      the user repository
     * @param passwordEncoder     the BCrypt password encoder
     * @param expenseRepository   the expense repository
     * @param categoryRepository  the category repository
     * @param budgetRepository    the budget repository
     * @param recurringRepository the recurring expense repository
     * @param incomeRepository    the income repository
     * @param savingsGoalRepository the savings goal repository
     */
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

    /**
     * {@inheritDoc}
     *
     * <p>Checks that the email is not already registered before encoding the
     * password and saving the new entity.</p>
     *
     * @param user the user data to register
     * @return the persisted user with generated ID
     * @throws IllegalArgumentException if the email is already in use
     */
    @Override
    @Transactional
    public User registerUser(User user) {
        log.info("Attempting to register user with email: {}, username: {}", user.getEmail(), user.getUsername());
        if (userRepository.findByEmail(user.getEmail().trim()).isPresent()) {
            log.warn("Registration rejected — email already exists: {}", user.getEmail());
            throw new IllegalArgumentException("User with this email already exists");
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            if (userRepository.findByUsernameIgnoreCase(user.getUsername().trim()).isPresent()) {
                log.warn("Registration rejected — username already exists: {}", user.getUsername());
                throw new IllegalArgumentException("Username '" + user.getUsername().trim() + "' is already taken. Please choose another.");
            }
            user.setUsername(user.getUsername().trim());
        }
        user.setEmail(user.getEmail().trim());
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

    /**
     * {@inheritDoc}
     */
    @Override
    public Optional<User> findByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }
        String q = identifier.trim();
        log.debug("Finding user by identifier: {}", q);
        return userRepository.findByEmailIgnoreCase(q)
                .or(() -> userRepository.findByUsernameIgnoreCase(q));
    }

    /**
     * {@inheritDoc}
     *
     * <p>Delegates to {@link UserRepository#findByEmail(String)}.</p>
     *
     * @param email the email address to search for
     * @return an {@link Optional} with the matching {@link User}, or empty if not found
     */
    @Override
    public Optional<User> findByEmail(String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        log.debug("Finding user by email: {}", email);
        return userRepository.findByEmailIgnoreCase(email.trim())
                .or(() -> userRepository.findByEmail(email));
    }

    /**
     * {@inheritDoc}
     *
     * <p>Delegates to {@link UserRepository#findById(Object)}.</p>
     *
     * @param id the primary key of the user to find
     * @return an {@link Optional} with the matching {@link User}, or empty if not found
     */
    @Override
    public Optional<User> findById(Long id) {
        log.debug("Finding user by id: {}", id);
        return userRepository.findById(id);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void updateSecurityPin(Long userId, String newPin) {
        if (newPin == null || !newPin.matches("^[0-9]{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setSecurityPinHash(passwordEncoder.encode(newPin.trim()));
        user.setFailedPinAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
        log.info("Security PIN successfully updated for userId={}", userId);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public boolean verifySecurityPin(Long userId, String pin) {
        if (pin == null || !pin.matches("^[0-9]{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getPinLockedUntil() != null && user.getPinLockedUntil().isAfter(LocalDateTime.now())) {
            long minutesRemaining = java.time.Duration.between(LocalDateTime.now(), user.getPinLockedUntil()).toMinutes() + 1;
            throw new IllegalStateException("Security PIN verification temporarily locked due to too many failed attempts. Please try again in " + minutesRemaining + " minute(s).");
        }

        if (user.getSecurityPinHash() == null) {
            throw new IllegalStateException("No security PIN has been set for this account.");
        }

        if (passwordEncoder.matches(pin.trim(), user.getSecurityPinHash())) {
            user.setFailedPinAttempts(0);
            user.setPinLockedUntil(null);
            userRepository.save(user);
            log.info("Security PIN successfully verified for userId={}", userId);
            return true;
        } else {
            int failed = user.getFailedPinAttempts() + 1;
            user.setFailedPinAttempts(failed);
            if (failed >= 5) {
                user.setPinLockedUntil(LocalDateTime.now().plusMinutes(15));
                log.warn("UserId={} security PIN locked for 15 minutes due to 5 consecutive failures", userId);
            }
            userRepository.save(user);
            log.warn("Incorrect security PIN attempt for userId={}, failedAttempts={}", userId, failed);
            return false;
        }
    }

    /**
     * {@inheritDoc}
     *
     * <p>Performs a full cascading deletion across all user data in order:</p>
     * <ol>
     *   <li>Expenses</li>
     *   <li>Incomes</li>
     *   <li>Savings Goals</li>
     *   <li>Budgets</li>
     *   <li>Recurring Expenses</li>
     *   <li>User Categories</li>
     *   <li>User account</li>
     * </ol>
     *
     * @param userId the primary key of the user to delete
     * @throws IllegalArgumentException if no user exists with the given ID
     */
    @Override
    @Transactional
    public void deleteUser(Long userId) {
        log.info("Initiating cascading account deletion for userId={}", userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Step 1: Delete all expenses owned by the user
        expenseRepository.deleteAll(expenseRepository.findByUser(user));

        // Step 2: Delete all incomes owned by the user
        incomeRepository.deleteAll(incomeRepository.findByUser(user));

        // Step 3: Delete all savings goals owned by the user
        savingsGoalRepository.deleteAll(savingsGoalRepository.findByUser(user));

        // Step 4: Delete all budgets owned by the user
        budgetRepository.deleteAll(budgetRepository.findByUser(user));

        // Step 5: Delete all recurring expenses owned by the user
        recurringRepository.deleteAll(recurringRepository.findByUser(user));

        // Step 6: Delete all user-created categories
        categoryRepository.deleteAll(categoryRepository.findByUser(user));

        // Step 7: Delete the user itself
        userRepository.delete(user);
        log.info("Cascading account deletion completed successfully for userId={}", userId);
    }

    /**
     * Updates the {@code currency} field on the user entity.
     *
     * @param userId   the primary key of the user to update
     * @param currency the ISO 4217 3-letter currency code
     * @throws IllegalArgumentException if no user exists with the given ID
     */
    public void updateCurrency(Long userId, String currency) {
        log.info("Updating currency preference for userId={} to {}", userId, currency);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setCurrency(currency != null ? currency.toUpperCase() : "INR");
        userRepository.save(user);
        log.info("Currency preference saved for userId={}: {}", userId, user.getCurrency());
    }
}
