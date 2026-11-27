package com.example.expensetracker.infrastructure.security;

import org.springframework.security.core.userdetails.UserDetails;
import java.time.Instant;

/**
 * {@link UserDetails} extension exposing stable user identity and token-revocation
 * metadata to infrastructure security components without coupling them to domain entities.
 */
public interface RevocableUserDetails extends UserDetails {

    /**
     * Returns the persistent identifier of the authenticated user.
     *
     * @return the user ID, or {@code null} if unavailable
     */
    Long getUserId();

    /**
     * Returns the cut-off timestamp before which issued tokens are considered revoked.
     *
     * @return the revocation cut-off instant, or {@code null} if tokens have never been revoked
     */
    Instant getTokensValidAfter();
}
