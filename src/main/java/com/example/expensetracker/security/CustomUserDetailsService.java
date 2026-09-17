package com.example.expensetracker.security;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomUserDetailsService implements UserDetailsService {

    /** Repository used to look up users by their email address. */
    private final UserRepository userRepository;

    /**
     * Loads a user by their email address for Spring Security authentication.
     *
     * <p>Spring Security calls this method during the login flow, passing the
     * value entered in the "username" field — which in this application is the
     * user's email address. The returned {@link UserDetails} is then used
     * to verify the provided password and check account status flags.</p>
     *
     * @param usernameOrEmail the email address or username of the user to authenticate
     * @return a {@link CustomUserDetails} instance wrapping the matched {@link User}
     * @throws UsernameNotFoundException if no user exists with the given email address
     */
    @Override
    public UserDetails loadUserByUsername(String usernameOrEmail) throws UsernameNotFoundException {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            log.warn("loadUserByUsername failed: identifier is null or blank");
            throw new UsernameNotFoundException("Username or email must not be blank.");
        }
        String query = usernameOrEmail.trim();
        log.debug("Authenticating user by identifier");
        User user = userRepository.findByEmailIgnoreCase(query)
                .or(() -> userRepository.findByUsernameIgnoreCase(query))
                .orElseThrow(() -> {
                    log.warn("Authentication failed: user not found for identifier");
                    return new UsernameNotFoundException("User not found with email or username: " + query);
                });
        return new CustomUserDetails(user);
    }
}
