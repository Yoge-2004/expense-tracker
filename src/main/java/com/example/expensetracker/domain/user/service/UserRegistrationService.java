package com.example.expensetracker.domain.user.service;

import com.example.expensetracker.domain.user.model.User;


/**
 * Segregated service contract dedicated to new user account registration and unique credential existence checks.
 *
 * <p>Fulfills the Interface Segregation Principle (ISP) by isolating onboarding workflows
 * from profile edits, PIN management, and account deletion.</p>
 *
 * @author Yogeshwaran
 */
public interface UserRegistrationService {

    /**
     * Registers a new user account with encoded credentials and default settings.
     *
     * @param user user entity populated with registration details
     * @return persisted user entity
     */
    User registerUser(User user);

    /**
     * Checks whether a user account already exists with the specified email address.
     *
     * @param email email address to check
     * @return true if an account exists, false otherwise
     */
    boolean userExistsByEmail(String email);

    /**
     * Checks whether a user account already exists with the specified username.
     *
     * @param username username handle to check
     * @return true if an account exists, false otherwise
     */
    boolean userExistsByUsername(String username);
}
