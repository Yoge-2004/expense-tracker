package com.example.expensetracker.config;

import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.RestAccessDeniedHandler;
import com.example.expensetracker.security.RestAuthenticationEntryPoint;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;

@Slf4j
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private static final String CSP_POLICY =
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; " +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            "img-src 'self' data: https://images.unsplash.com https://*.googleusercontent.com " +
            "https://cozy-narwhal-3099ad.netlify.app; " +
            "connect-src 'self' https://accounts.google.com https://ipapi.co " +
            "https://yoge-2004-expense-tracker-backend.hf.space; " +
            "frame-src 'self' https://accounts.google.com; " +
            "frame-ancestors 'self'; " +
            "object-src 'none'; " +
            "base-uri 'self';";

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RestAuthenticationEntryPoint restAuthenticationEntryPoint;
    private final RestAccessDeniedHandler restAccessDeniedHandler;

    @Bean
    @SuppressWarnings("java:S4502")
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {
        log.info("Configuring Spring SecurityFilterChain with stateless JWT authentication and security headers");

        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/",
                                "/*.html",
                                "/sw.js",
                                "/frontend/**",
                                "/css/**",
                                "/js/**",
                                "/images/**",
                                "/favicon.ico",
                                "/api/auth/**",
                                "/api/webauthn/login/**",
                                "/api/users/suggest-usernames",
                                "/api/health/**",
                                "/api/sync/**",
                                "/api/internal/ml/**",
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
                .formLogin(AbstractHttpConfigurer::disable)
                .headers(headers -> headers
                        .contentTypeOptions(Customizer.withDefaults())
                        // NOTE: X-XSS-Protection is intentionally not sent. The header is
                        // obsolete (ignored by modern browsers) and known to *introduce*
                        // reflected-XSS issues in legacy engines when set to "1; mode=block".
                        .frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin)
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31536000))
                        .referrerPolicy(referrer -> referrer.policy(
                                ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .permissionsPolicyHeader(permissions -> permissions.policy(
                                "geolocation=(), camera=(), microphone=(), payment=()"))
                        .contentSecurityPolicy(csp -> csp.policyDirectives(CSP_POLICY))
                );

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
