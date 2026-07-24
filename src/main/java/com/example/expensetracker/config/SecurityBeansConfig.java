package com.example.expensetracker.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Configuration class that exposes core Spring Security beans.
 *
 * <p>This class registers the {@link PasswordEncoder} and
 * {@link AuthenticationManager} as Spring-managed beans, making them available
 * for injection throughout the application — particularly in authentication
 * and user registration flows.</p>
 *
 * <p>{@link BCryptPasswordEncoder} is used as the password hashing strategy,
 * providing adaptive one-way hashing with built-in salting to protect stored
 * credentials against brute-force and rainbow table attacks.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
 * @see org.springframework.security.authentication.AuthenticationManager
 */
@Configuration
public class SecurityBeansConfig {

    /**
     * Creates a {@link PasswordEncoder} bean using the BCrypt hashing algorithm.
     *
     * <p>BCrypt automatically handles salt generation and includes a work factor
     * that can be increased over time to remain resistant to brute-force attacks
     * as hardware becomes faster.</p>
     *
     * @return a {@link BCryptPasswordEncoder} instance
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Exposes the {@link AuthenticationManager} from Spring Security's
     * {@link AuthenticationConfiguration} as a Spring bean.
     *
     * <p>The {@code AuthenticationManager} is used in the authentication flow
     * (e.g., login) to delegate credential verification to the configured
     * {@link org.springframework.security.core.userdetails.UserDetailsService}
     * and {@link PasswordEncoder}.</p>
     *
     * @param config the {@link AuthenticationConfiguration} provided by Spring Security
     * @return the configured {@link AuthenticationManager}
     * @throws Exception if the {@link AuthenticationManager} cannot be retrieved
     */
    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
