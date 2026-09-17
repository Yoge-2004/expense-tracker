package com.example.expensetracker.security;

import io.jsonwebtoken.Claims;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Date;
import java.util.Map;
import java.util.function.Function;

/**
 * Service interface for JSON Web Token (JWT) lifecycle operations:
 * <ul>
 *     <li>Generating tokens</li>
 *     <li>Validating tokens</li>
 *     <li>Extracting claims</li>
 * </ul>
 */
public interface JwtService {

    /**
     * Extracts username (subject email) from token.
     *
     * @param token JWT token
     * @return username/email
     */
    String extractUsername(String token);

    /**
     * Extracts expiration date from token.
     *
     * @param token JWT token
     * @return expiration date
     */
    Date extractExpiration(String token);

    /**
     * Extracts a specific claim from token using a claims resolver function.
     *
     * @param token JWT token
     * @param claimsResolver resolver function
     * @param <T> claim return type
     * @return extracted claim
     */
    <T> T extractClaim(String token, Function<Claims, T> claimsResolver);

    /**
     * Generates a signed token with standard subject claim.
     *
     * @param userEmail authenticated user email
     * @return signed JWT token string
     */
    String generateToken(String userEmail);

    /**
     * Generates a signed token with additional custom claims.
     *
     * @param extraClaims additional claims map
     * @param userEmail authenticated user email
     * @return signed JWT token string
     */
    String generateToken(Map<String, Object> extraClaims, String userEmail);

    /**
     * Validates token authenticity, signature, expiration, and user account status.
     *
     * @param token JWT token
     * @param userDetails authenticated user details
     * @return true if valid
     */
    boolean isTokenValid(String token, UserDetails userDetails);
}
