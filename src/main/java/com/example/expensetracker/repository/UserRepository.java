package com.example.expensetracker.repository;

import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Spring Data JPA repository for {@link User} entities.
 *
 * <p>Extends {@link JpaRepository} to provide standard CRUD operations
 * alongside custom query methods for user lookup by email address —
 * which is the primary identifier used during authentication and
 * password reset flows.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see User
 */
@SuppressWarnings("unused")
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Retrieves a user by their unique email address.
     *
     * @param email the email address to search for (case-sensitive)
     * @return an {@link Optional} containing the matching {@link User},
     *         or {@link Optional#empty()} if no user exists with that email
     */
    Optional<User> findByEmail(String email);

    /**
     * Checks whether a user with the given email address already exists in the database.
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
     * Retrieves a user by their unique login handle (case-insensitive).
     */
    Optional<User> findByUsernameIgnoreCase(String username);

    /**
     * Checks whether a user with the given username already exists (case-insensitive).
     */
    boolean existsByUsernameIgnoreCase(String username);

    /**
     * Paginated search for users across name, email, and username with optional role filter.
     */
    @Query("SELECT u FROM User u WHERE " +
           "(:query IS NULL OR LOWER(u.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "AND (:role IS NULL OR u.role = :role) " +
           "ORDER BY u.id DESC")
    Page<User> searchUsers(@Param("query") String query, @Param("role") Role role, Pageable pageable);

    long countByRole(Role role);

    long countByAccountLocked(boolean accountLocked);
}
