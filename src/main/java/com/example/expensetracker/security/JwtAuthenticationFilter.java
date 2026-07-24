package com.example.expensetracker.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import io.jsonwebtoken.JwtException;
import org.jspecify.annotations.NonNull;
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
 * <p>This filter is registered before Spring Security's default
 * {@link org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter}
 * via {@link com.example.expensetracker.config.SecurityConfig}. It performs the following
 * steps on each request:</p>
 * <ol>
 *   <li>Extracts the {@code Authorization} header and checks for a {@code Bearer } prefix.</li>
 *   <li>If absent or malformed, the filter chain continues without setting authentication.</li>
 *   <li>Extracts the email (subject) from the JWT token via {@link JwtService}.</li>
 *   <li>If the {@link org.springframework.security.core.context.SecurityContext} is empty,
 *       loads the user via {@link CustomUserDetailsService}.</li>
 *   <li>Validates the token against the loaded user details.</li>
 *   <li>On success, creates a {@link UsernamePasswordAuthenticationToken} and stores it
 *       in the {@link org.springframework.security.core.context.SecurityContextHolder},
 *       marking the request as authenticated.</li>
 * </ol>
 *
 * <p>Extends {@link OncePerRequestFilter} to guarantee that the filter runs
 * at most once per request, preventing double-authentication in forwarded requests.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see JwtService
 * @see CustomUserDetailsService
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** Service used to parse, validate, and extract claims from JWT tokens. */
    private final JwtService jwtService;

    /** Service used to load user details from the database by email. */
    private final CustomUserDetailsService userDetailsService;

    /**
     * Constructs a {@code JwtAuthenticationFilter} with the required services.
     *
     * @param jwtService         the service responsible for JWT operations
     * @param userDetailsService the service for loading {@link UserDetails} by email
     */
    public JwtAuthenticationFilter(JwtService jwtService,
                                   CustomUserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    /**
     * Performs JWT extraction, validation, and security context population
     * for each incoming HTTP request.
     *
     * <p>If the {@code Authorization} header is missing or does not start with
     * {@code "Bearer "}, the request is forwarded without authentication. Otherwise,
     * the JWT is extracted and validated; on success, the security context is populated
     * with an authenticated {@link UsernamePasswordAuthenticationToken}.</p>
     *
     * @param request     the incoming {@link HttpServletRequest}
     * @param response    the outgoing {@link HttpServletResponse}
     * @param filterChain the remaining filter chain to pass the request through
     * @throws ServletException if a servlet-related error occurs during filtering
     * @throws IOException      if an I/O error occurs during filtering
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
            // An expired, malformed, or invalid token is simply unauthenticated.
            // Let Spring Security produce its normal 401 response instead of
            // propagating a parser exception as a 500 error.
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
            }
        }

        filterChain.doFilter(request, response);
    }
}
