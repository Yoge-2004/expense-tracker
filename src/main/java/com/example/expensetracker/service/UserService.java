package com.example.expensetracker.service;

import com.example.expensetracker.model.User;

import java.util.Optional;

/**
 * Service interface defining the business operations for managing user accounts.
 *
 * <p>This interface abstracts the user management layer, providing methods for
 * user registration, lookup, password reset, and account deletion. The concrete
 * implementation is provided by
 * {@link com.example.expensetracker.service.impl.UserServiceImpl}.</p>
 *
 * <p>Business rules enforced at this layer:</p>
 * <ul>
 *   <li>Email addresses must be unique — duplicate registrations are rejected.</li>
 *   <li>Passwords are BCrypt-encoded before storage and never stored in plain text.</li>
 *   <li>Account deletion cascades to all associated expenses and user-created categories.</li>
 * </ul>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see com.example.expensetracker.service.impl.UserServiceImpl
 */
public interface UserService {

    /**
     * Registers a new user account in the system.
     *
     * <p>Validates that no existing user is registered with the same email address,
     * encodes the plain-text password with BCrypt, marks the account as enabled,
     * and persists the user to the database.</p>
     *
     * @param user a {@link User} entity populated with {@code name}, {@code email},
     *             and plain-text {@code password}; must not be {@code null}
     * @return the fully persisted {@link User} entity with a generated ID and
     *         encoded password
     * @throws IllegalArgumentException if a user with the same email is already registered
     */
    User registerUser(User user);

    /**
     * Looks up a user by their email address.
     *
     * <p>Used in authentication flows (post-login user detail retrieval) and
     * in password reset operations to locate the target account.</p>
     *
     * @param email the email address of the user to find (case-sensitive)
     * @return an {@link Optional} containing the matched {@link User},
     *         or {@link Optional#empty()} if no user exists with that email
     */
    Optional<User> findByEmail(String email);

    /**
     * Looks up a user by their numeric database ID.
     *
     * <p>Used widely across controllers to resolve the owner of resources
     * (expenses, categories, budgets) from path variable user IDs.</p>
     *
     * @param id the primary key of the user to find
     * @return an {@link Optional} containing the matched {@link User},
     *         or {@link Optional#empty()} if no user exists with that ID
     */
    Optional<User> findById(Long id);

    /**
     * Deletes the user account identified by the given ID, along with all
     * associated data.
     *
     * <p>This operation performs a cascading deletion in the following order:</p>
     * <ol>
     *   <li>Deletes all expense records owned by the user.</li>
     *   <li>Deletes all custom categories created by the user.</li>
     *   <li>Deletes the user entity itself.</li>
     * </ol>
     *
     * @param userId the primary key of the user account to delete
     * @throws IllegalArgumentException if no user is found with the given ID
     */
    void deleteUser(Long userId);

    /**
     * Updates the preferred display currency of a user account.
     *
     * @param userId   the primary key of the user to update
     * @param currency the ISO 4217 3-letter currency code (e.g. {@code "INR"}, {@code "USD"})
     * @throws IllegalArgumentException if no user exists with the given ID
     */
    void updateCurrency(Long userId, String currency);
}
