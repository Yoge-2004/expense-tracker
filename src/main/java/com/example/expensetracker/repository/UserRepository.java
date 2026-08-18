package com.example.expensetracker.repository;

import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data JPA repository for {@link User} entities.
 *
 * <p>Extends {@link JpaRepository} to provide standard CRUD operations
 * alongside custom query methods for user lookup by email address —
 * which is the primary identifier used during authentication and
 * password reset flows.</p>
 *
 * <p>Used by:</p>
 * <ul>
 *   <li>{@link com.example.expensetracker.security.CustomUserDetailsService} —
 *       to load a user by email during Spring Security authentication.</li>
 *   <li>{@link com.example.expensetracker.service.impl.UserServiceImpl} —
 *       for registration, password updates, and account deletion.</li>
 * </ul>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see User
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Retrieves a user by their unique email address.
     *
     * <p>Used during authentication (login), password reset, and post-login
     * user detail lookups. Email addresses are stored as unique values,
     * so at most one result is returned.</p>
     *
     * @param email the email address to search for (case-sensitive)
     * @return an {@link Optional} containing the matching {@link User},
     *         or {@link Optional#empty()} if no user exists with that email
     */
    Optional<User> findByEmail(String email);

    /**
     * Checks whether a user with the given email address already exists in the database.
     *
     * <p>Used during registration in
     * {@link com.example.expensetracker.service.impl.UserServiceImpl#registerUser}
     * to prevent duplicate account creation for the same email.</p>
     *
     * @param email the email address to check (case-sensitive)
     * @return {@code true} if a user with this email already exists;
     *         {@code false} otherwise
     */
    boolean existsByEmail(String email);

    /**
     * Retrieves a user by their email address (case-insensitive).
     */
    Optional<User> findByEmailIgnoreCase(String email);

    /**
     * Retrieves a user by their username/name (case-insensitive).
     */
    Optional<User> findByNameIgnoreCase(String name);

    /**
     * Checks whether a user with the given email address already exists (case-insensitive).
     */
    boolean existsByEmailIgnoreCase(String email);

    /**
     * Checks whether a user with the given name/username exists in the database (case-insensitive).
     *
     * @param name the username to check
     * @return {@code true} if an entry exists; {@code false} otherwise
     */
    boolean existsByNameIgnoreCase(String name);

    /**
     * Retrieves a user by their unique login handle (case-insensitive). Distinct
     * from {@link #findByNameIgnoreCase}, which matches the display name field.
     */
    Optional<User> findByUsernameIgnoreCase(String username);

    /**
     * Checks whether a user with the given username already exists (case-insensitive).
     */
    boolean existsByUsernameIgnoreCase(String username);
}
