package com.example.expensetracker.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * Service responsible for all JWT operations such as:
 * <ul>
 *     <li>Generating tokens</li>
 *     <li>Validating tokens</li>
 *     <li>Extracting claims</li>
 * </ul>
 *
 * Tokens are signed using HS256.
 */
@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    /**
     * Base64 encoded secret key from application.properties.
     */
    @Value("${jwt.secret}")
    private String secretKey;

    /**
     * Token expiration duration in milliseconds.
     */
    @Value("${jwt.expiration}")
    private long jwtExpiration;

    /**
     * Cached signing key.
     */
    private SecretKey signingKey;

    /**
     * Initializes the signing key once during bean creation.
     */
    @PostConstruct
    public void init() {
        if (secretKey == null || secretKey.trim().isEmpty()) {
            throw new IllegalStateException("JWT secret key is not configured. Set the JWT_SECRET environment variable.");
        }

        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(secretKey.trim());
        } catch (Exception e) {
            keyBytes = secretKey.trim().getBytes(StandardCharsets.UTF_8);
        }

        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "JWT secret key must be at least 256 bits (32 bytes) for HS256 algorithm. Current length: " + keyBytes.length + " bytes."
            );
        }

        signingKey = Keys.hmacShaKeyFor(keyBytes);
        log.info("JwtService successfully initialized with HMAC-SHA signing key (algorithm: HS256).");
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public void setJwtExpiration(long jwtExpiration) {
        this.jwtExpiration = jwtExpiration;
    }

    /**
     * Extracts username(email) from token.
     *
     * @param token JWT token
     * @return username/email
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Extracts expiration date from token.
     *
     * @param token JWT token
     * @return expiration date
     */
    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    /**
     * Extracts a specific claim from token.
     *
     * @param token JWT token
     * @param claimsResolver resolver function
     * @param <T> claim type
     * @return extracted claim
     */
    public <T> T extractClaim(String token,
                              Function<Claims, T> claimsResolver) {

        Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /**
     * Generates token without extra claims.
     *
     * @param userEmail authenticated user email
     * @return JWT token
     */
    public String generateToken(String userEmail) {
        return generateToken(new HashMap<>(), userEmail);
    }

    /**
     * Generates JWT token with optional extra claims.
     *
     * @param extraClaims additional claims
     * @param userEmail authenticated user email
     * @return JWT token
     */
    public String generateToken(Map<String, Object> extraClaims,
                                String userEmail) {

        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpiration);

        return Jwts.builder()
                .claims(extraClaims)
                .subject(userEmail)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(signingKey)
                .compact();
    }

    /**
     * Validates token against UserDetails.
     *
     * @param token JWT token
     * @param userDetails authenticated user details
     * @return true if valid
     */
    public boolean isTokenValid(String token,
                                UserDetails userDetails) {

        final String username = extractUsername(token);

        return username.equals(userDetails.getUsername())
                && !isTokenExpired(token);
    }

    /**
     * Checks whether token is expired.
     *
     * @param token JWT token
     * @return true if expired
     */
    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    /**
     * Extracts all claims from token after signature verification.
     *
     * @param token JWT token
     * @return claims payload
     */
    private Claims extractAllClaims(String token) {

        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
