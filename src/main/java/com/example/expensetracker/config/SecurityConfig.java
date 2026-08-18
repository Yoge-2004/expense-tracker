package com.example.expensetracker.config;

import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.RestAccessDeniedHandler;
import com.example.expensetracker.security.RestAuthenticationEntryPoint;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Main Spring Security configuration for the Expense Tracker application.
 *
 * <p>This class configures the HTTP security filter chain, enabling stateless
 * JWT-based authentication while disabling session management and CSRF protection
 * (appropriate for REST APIs consumed by non-browser or SPA clients).</p>
 *
 * <p>Security rules defined here:</p>
 * <ul>
 *   <li>Public access is granted to {@code /api/auth/**} (login, register, reset-password)
 *       and {@code /h2-console/**} (for development).</li>
 *   <li>All other endpoints require an authenticated JWT token.</li>
 *   <li>The custom {@link JwtAuthenticationFilter} is inserted before the default
 *       {@link UsernamePasswordAuthenticationFilter} to intercept and validate JWTs.</li>
 * </ul>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see JwtAuthenticationFilter
 * @see org.springframework.security.web.SecurityFilterChain
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** The JWT authentication filter injected into the security filter chain. */
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RestAuthenticationEntryPoint restAuthenticationEntryPoint;
    private final RestAccessDeniedHandler restAccessDeniedHandler;

    /**
     * Constructs a {@code SecurityConfig} with the required JWT authentication filter
     * and the JSON-based handlers for filter-chain-level auth failures.
     *
     * @param jwtAuthenticationFilter the custom filter responsible for JWT validation
     *                                on each incoming HTTP request
     */
    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                           RestAuthenticationEntryPoint restAuthenticationEntryPoint,
                           RestAccessDeniedHandler restAccessDeniedHandler) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.restAuthenticationEntryPoint = restAuthenticationEntryPoint;
        this.restAccessDeniedHandler = restAccessDeniedHandler;
    }

    /**
     * Defines and builds the main {@link SecurityFilterChain} bean for the application.
     *
     * <p>The chain is configured to:</p>
     * <ul>
     *   <li>Enable CORS with default settings (delegated to {@link CorsConfig}).</li>
     *   <li>Disable CSRF protection (not needed for stateless JWT APIs).</li>
     *   <li>Enforce stateless session management — no HTTP sessions are created or used.</li>
     *   <li>Allow unauthenticated access to auth endpoints and H2 console.</li>
     *   <li>Require authentication for all other requests.</li>
     *   <li>Disable form-based login.</li>
     *   <li>Register the {@link JwtAuthenticationFilter} before the standard
     *       username/password filter.</li>
     * </ul>
     *
     * @param http the {@link HttpSecurity} builder provided by Spring Security
     * @return the fully configured {@link SecurityFilterChain}
     * @throws Exception if the security configuration fails
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())

                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/",
                                "/*.html",
                                "/frontend/**",
                                "/css/**",
                                "/js/**",
                                "/images/**",
                                "/favicon.ico",
                                "/api/auth/**",
                                "/api/users/suggest-usernames",
                                "/api/health/**",
                                "/api/sync/**",
                                "/h2-console/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/v3/api-docs",
                                "/swagger-resources/**",
                                "/webjars/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )

                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(restAuthenticationEntryPoint)
                        .accessDeniedHandler(restAccessDeniedHandler)
                )

                .formLogin(form -> form.disable());

        http.headers(headers -> headers.frameOptions(frame -> frame.disable()));

        // Register JWT Filter before the default username/password filter
        http.addFilterBefore(
                jwtAuthenticationFilter,
                UsernamePasswordAuthenticationFilter.class
        );

        return http.build();
    }
}
