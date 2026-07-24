package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.UserService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Concrete implementation of {@link UserService} providing business logic
 * for user registration, lookup, password management, and account deletion.
 *
 * <p>This service coordinates interactions between {@link UserRepository},
 * {@link ExpenseRepository}, {@link CategoryRepository}, and the
 * {@link PasswordEncoder} to enforce the following rules:</p>
 * <ul>
 *   <li>Email addresses must be unique across all registered users.</li>
 *   <li>Passwords are always BCrypt-encoded before being stored in the database.</li>
 *   <li>Account deletion cascades to remove all user-owned expenses and
 *       user-created categories before the user record itself is deleted.</li>
 * </ul>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see UserService
 * @see UserRepository
 */
@Service
public class UserServiceImpl implements UserService {

    /** Repository for user entity persistence and lookup. */
    private final UserRepository userRepository;

    /** Encoder used to hash passwords before storing them in the database. */
    private final PasswordEncoder passwordEncoder;

    /** Repository for deleting expense records during account deletion. */
    private final ExpenseRepository expenseRepository;

    /** Repository for deleting user-created categories during account deletion. */
    private final CategoryRepository categoryRepository;

    /** Repository for deleting budget configurations during account deletion. */
    private final BudgetRepository budgetRepository;

    /** Repository for deleting recurring expenses during account deletion. */
    private final RecurringExpenseRepository recurringRepository;

    /**
     * Constructs a {@code UserServiceImpl} with the required dependencies.
     *
     * @param userRepository     JPA repository for {@link User} entities
     * @param passwordEncoder    BCrypt password encoder
     * @param expenseRepository  JPA repository for {@link Expense} entities
     * @param categoryRepository JPA repository for {@link Category} entities
     */
    public UserServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           ExpenseRepository expenseRepository,
                           CategoryRepository categoryRepository,
                           BudgetRepository budgetRepository,
                           RecurringExpenseRepository recurringRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.expenseRepository = expenseRepository;
        this.categoryRepository = categoryRepository;
        this.budgetRepository = budgetRepository;
        this.recurringRepository = recurringRepository;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Checks for duplicate email using {@link UserRepository#existsByEmail(String)}.
     * If the email is already taken, throws {@link IllegalArgumentException}.
     * Otherwise, encodes the password, sets the {@code enabled} flag to {@code true},
     * {@code accountLocked} to {@code false}, and persists the user.</p>
     *
     * @param user the new user entity with plain-text password and email
     * @return the persisted {@link User} with an encoded password and generated ID
     * @throws IllegalArgumentException if the email is already registered
     */
    @Override
    public User registerUser(User user) {
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setEnabled(true);
        user.setAccountLocked(false);

        return userRepository.save(user);
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
        return userRepository.findByEmail(email);
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
        return userRepository.findById(id);
    }

    /**
     * {@inheritDoc}
     *
     * <p>Looks up the user by email, encodes the new password using BCrypt,
     * updates the {@code password} field, and saves the modified entity.
     * Throws {@link IllegalArgumentException} if no user is found.</p>
     *
     * @param email       the email of the account to update
     * @param newPassword the new plain-text password to encode and store
     * @throws IllegalArgumentException if no user exists with the given email
     */
    @Override
    public void updatePassword(String email, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    /**
     * {@inheritDoc}
     *
     * <p>Performs a three-step cascading deletion:</p>
     * <ol>
     *   <li>Loads and deletes all {@link Expense} records owned by the user.</li>
     *   <li>Loads and deletes all {@link Category} records created by the user.</li>
     *   <li>Deletes the {@link User} record itself.</li>
     * </ol>
     *
     * <p>Throws {@link IllegalArgumentException} if no user is found with the given ID.</p>
     *
     * @param userId the primary key of the user to delete
     * @throws IllegalArgumentException if no user exists with the given ID
     */
    @Override
    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Step 1: Delete all expenses owned by the user
        expenseRepository.deleteAll(expenseRepository.findByUser(user));

        // Step 2: Delete all budgets owned by the user
        budgetRepository.deleteAll(budgetRepository.findByUser(user));

        // Step 3: Delete all recurring expenses owned by the user
        recurringRepository.deleteAll(recurringRepository.findByUser(user));

        // Step 4: Delete all user-created categories
        categoryRepository.deleteAll(categoryRepository.findByUser(user));

        // Step 5: Delete the user itself
        userRepository.delete(user);
    }
}
