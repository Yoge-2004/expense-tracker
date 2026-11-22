package com.example.expensetracker.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import io.jsonwebtoken.JwtException;
import org.jspecify.annotations.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

import com.example.expensetracker.infrastructure.logging.CorrelationIdFilter;



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
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** Service used to parse, validate, and extract claims from JWT tokens. */
    private final JwtService jwtService;

    /** Service used to load user details from the database by email. */
    private final CustomUserDetailsService userDetailsService;

    private final BrowserSessionCookieService browserSessionCookieService;

    @Autowired
    public JwtAuthenticationFilter(
            JwtService jwtService,
            CustomUserDetailsService userDetailsService,
            BrowserSessionCookieService browserSessionCookieService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.browserSessionCookieService = browserSessionCookieService;
    }

    /** Compatibility constructor for bearer-only filter consumers. */
    public JwtAuthenticationFilter(JwtService jwtService, CustomUserDetailsService userDetailsService) {
        this(jwtService, userDetailsService, new BrowserSessionCookieService());
    }

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
        final boolean bearerRequest = authHeader != null && authHeader.startsWith("Bearer ");
        final String jwt = bearerRequest ? authHeader.substring(7) : cookieValue(request, BrowserSessionCookieService.SESSION_COOKIE);
        final String userEmail;

        if (jwt == null || jwt.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

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

            try {
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
            } catch (org.springframework.security.core.userdetails.UsernameNotFoundException exception) {
                // Token subject no longer resolves to a user (account deleted after
                // issuance). Continue unauthenticated instead of failing the request
                // with a 500 from the filter chain.
                log.warn("JWT subject no longer exists; continuing unauthenticated for path '{}': {}",
                        request.getRequestURI(), exception.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String cookieValue(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

}
