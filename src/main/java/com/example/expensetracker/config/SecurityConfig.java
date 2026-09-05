package com.example.expensetracker.config;

import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.RestAccessDeniedHandler;
import com.example.expensetracker.security.RestAuthenticationEntryPoint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.XXssProtectionHeaderWriter;

/**
 * Main Spring Security configuration for the Expense Tracker application.
 *
 * <p>Configures stateless JWT authentication, endpoint authorization,
 * custom entry points, and robust HTTP security headers including
 * Content-Security-Policy (CSP), Strict-Transport-Security (HSTS),
 * X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see JwtAuthenticationFilter
 * @see org.springframework.security.web.SecurityFilterChain
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    private static final String CSP_POLICY =
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://accounts.google.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; " +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            "img-src 'self' data: https://images.unsplash.com https://*.googleusercontent.com https://cozy-narwhal-3099ad.netlify.app; " +
            "connect-src 'self' https://accounts.google.com https://ipapi.co https://yoge-2004-expense-tracker-backend.hf.space; " +
            "frame-src 'self' https://accounts.google.com; " +
            "frame-ancestors 'self'; " +
            "object-src 'none'; " +
            "base-uri 'self';";

    /** The JWT authentication filter injected into the security filter chain. */
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RestAuthenticationEntryPoint restAuthenticationEntryPoint;
    private final RestAccessDeniedHandler restAccessDeniedHandler;

    /**
     * Constructs a {@code SecurityConfig} with the required JWT authentication filter
     * and the JSON-based handlers for filter-chain-level auth failures.
     */
    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                           RestAuthenticationEntryPoint restAuthenticationEntryPoint,
                           RestAccessDeniedHandler restAccessDeniedHandler) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.restAuthenticationEntryPoint = restAuthenticationEntryPoint;
        this.restAccessDeniedHandler = restAccessDeniedHandler;
    }

    /**
     * Defines the primary {@link SecurityFilterChain} bean.
     *
     * @param http the {@link HttpSecurity} builder
     * @return the configured {@link SecurityFilterChain}
     * @throws Exception if any security configuration fails
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        log.info("Configuring Spring SecurityFilterChain with stateless JWT authentication and robust security headers");

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

                .formLogin(form -> form.disable())

                .headers(headers -> headers
                        .contentTypeOptions(Customizer.withDefaults())
                        .xssProtection(xss -> xss.headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
                        .frameOptions(frame -> frame.sameOrigin())
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31536000)
                        )
                        .referrerPolicy(referrer -> referrer
                                .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                        )
                        .permissionsPolicyHeader(permissions -> permissions
                                .policy("geolocation=(), camera=(), microphone=(), payment=()")
                        )
                        .contentSecurityPolicy(csp -> csp
                                .policyDirectives(CSP_POLICY)
                        )
                );

        // Register JWT Filter before the default username/password filter
        http.addFilterBefore(
                jwtAuthenticationFilter,
                UsernamePasswordAuthenticationFilter.class
        );

        return http.build();
    }
}
