package com.example.expensetracker.security.impl;

import com.example.expensetracker.security.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
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
 * Standard implementation of {@link JwtService} using HMAC-SHA256.
 */
@Slf4j
@Service
public class JwtServiceImpl implements JwtService {

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
            throw new IllegalStateException(
                    "JWT secret key is not configured. Set the JWT_SECRET environment variable.");
        }

        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(secretKey.trim());
        } catch (Exception e) {
            keyBytes = secretKey.trim().getBytes(StandardCharsets.UTF_8);
        }

        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "JWT secret key must be at least 256 bits (32 bytes) for HS256 algorithm. "
                            + "Current length: " + keyBytes.length + " bytes."
            );
        }

        signingKey = Keys.hmacShaKeyFor(keyBytes);
        log.info("JwtService successfully initialized with HMAC-SHA signing key (algorithm: HS256).");
    }

    @Override
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    @Override
    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    @Override
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    @Override
    public String generateToken(String userEmail) {
        return generateToken(new HashMap<>(), userEmail);
    }

    @Override
    public String generateToken(Map<String, Object> extraClaims, String userEmail) {
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

    @Override
    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername())
                && !isTokenExpired(token)
                && userDetails.isEnabled()
                && userDetails.isAccountNonLocked()
                && userDetails.isCredentialsNonExpired();
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
