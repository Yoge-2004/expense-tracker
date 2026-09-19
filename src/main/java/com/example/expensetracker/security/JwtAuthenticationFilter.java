package com.example.expensetracker.security;

import com.example.expensetracker.logging.CorrelationIdFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import io.jsonwebtoken.JwtException;
import org.jspecify.annotations.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * JWT-based authentication filter that intercepts every incoming HTTP request
 * exactly once per request lifecycle.
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see JwtService
 * @see CustomUserDetailsService
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** Service used to parse, validate, and extract claims from JWT tokens. */
    private final JwtService jwtService;

    /** Service used to load user details from the database by email. */
    private final CustomUserDetailsService userDetailsService;

    /**
     * Performs JWT extraction, validation, and security context population
     * for each incoming HTTP request.
     */
    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String userEmail;

        // Skip filter if Authorization header is absent or malformed
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Extract the JWT token (strip "Bearer " prefix)
        jwt = authHeader.substring(7);
        try {
            userEmail = jwtService.extractUsername(jwt);
        } catch (JwtException | IllegalArgumentException exception) {
            log.warn("JWT parsing/validation failed for URI '{}': {}", request.getRequestURI(), exception.getMessage());
            filterChain.doFilter(request, response);
            return;
        }

        // Authenticate only if email was extracted and context is not already set
        if (userEmail != null &&
                SecurityContextHolder.getContext().getAuthentication() == null) {

            UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);

            if (jwtService.isTokenValid(jwt, userDetails)) {
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );

                authToken.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                );

                SecurityContextHolder.getContext().setAuthentication(authToken);
                MDC.put(CorrelationIdFilter.USER_MDC_KEY, userEmail);
                log.debug("Successfully authenticated user '{}' for path: {}", userEmail, request.getRequestURI());
            } else {
                log.warn("JWT token invalid for user '{}' on path: {}", userEmail, request.getRequestURI());
            }
        }

        filterChain.doFilter(request, response);
    }
}
