package com.example.expensetracker.security;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Custom Spring Security {@link UserDetailsService} implementation for the
 * Expense Tracker application.
 *
 * <p>This service is responsible for loading a {@link User} entity from the
 * database by email address during the Spring Security authentication process.
 * It is used internally by Spring Security's {@link org.springframework.security.authentication.AuthenticationManager}
 * when validating credentials at login.</p>
 *
 * <p>The loaded user is wrapped in a {@link CustomUserDetails} object,
 * which adapts the domain {@link User} model to the {@link UserDetails}
 * interface expected by the security framework.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see CustomUserDetails
 * @see UserRepository
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    /** Repository used to look up users by their email address. */
    private final UserRepository userRepository;

    /**
     * Constructs a {@code CustomUserDetailsService} with the required user repository.
     *
     * @param userRepository the repository for fetching user records from the database
     */
    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Loads a user by their email address for Spring Security authentication.
     *
     * <p>Spring Security calls this method during the login flow, passing the
     * value entered in the "username" field — which in this application is the
     * user's email address. The returned {@link UserDetails} is then used
     * to verify the provided password and check account status flags.</p>
     *
     * @param email the email address of the user to authenticate (used as the username)
     * @return a {@link CustomUserDetails} instance wrapping the matched {@link User}
     * @throws UsernameNotFoundException if no user exists with the given email address
     */
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new UsernameNotFoundException("User not found with email: " + email));
        return new CustomUserDetails(user);
    }
}
