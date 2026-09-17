package com.example.expensetracker.security.impl;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceImplTest {

    private JwtServiceImpl jwtService;
    // 256-bit test secret key
    private static final String TEST_SECRET = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";
    private static final long TEST_EXPIRATION = 3600000L; // 1 hour

    @BeforeEach
    void setUp() {
        jwtService = new JwtServiceImpl();
        ReflectionTestUtils.setField(jwtService, "secretKey", TEST_SECRET);
        ReflectionTestUtils.setField(jwtService, "jwtExpiration", TEST_EXPIRATION);
        jwtService.init();
    }

    @Test
    @DisplayName("init throws IllegalStateException when secretKey is null or blank")
    void init_throwsWhenSecretBlank() {
        JwtServiceImpl invalid = new JwtServiceImpl();
        ReflectionTestUtils.setField(invalid, "secretKey", "   ");
        ReflectionTestUtils.setField(invalid, "jwtExpiration", 1000L);
        assertThrows(IllegalStateException.class, invalid::init);
    }

    @Test
    @DisplayName("init throws IllegalStateException when secretKey is shorter than 256 bits (32 bytes)")
    void init_throwsWhenSecretTooShort() {
        JwtServiceImpl invalid = new JwtServiceImpl();
        ReflectionTestUtils.setField(invalid, "secretKey", "short-secret-key-too-short");
        ReflectionTestUtils.setField(invalid, "jwtExpiration", 1000L);
        assertThrows(IllegalStateException.class, invalid::init);
    }

    @Test
    @DisplayName("generateToken and extractUsername succeeds with valid email")
    void generateToken_extractUsername_success() {
        String email = "testuser@example.com";
        String token = jwtService.generateToken(email);

        assertNotNull(token);
        assertFalse(token.isBlank());
        assertEquals(email, jwtService.extractUsername(token));
    }

    @Test
    @DisplayName("extractExpiration returns future expiration date")
    void extractExpiration_returnsFutureDate() {
        String token = jwtService.generateToken("user@example.com");
        Date expiration = jwtService.extractExpiration(token);

        assertNotNull(expiration);
        assertTrue(expiration.after(new Date()));
    }

    @Test
    @DisplayName("generateToken with extra claims preserves and extracts custom claim")
    void generateToken_withExtraClaims_extractsCustomClaim() {
        String token = jwtService.generateToken(Map.of("role", "ROLE_ADMIN", "customId", 123), "admin@example.com");

        String role = jwtService.extractClaim(token, claims -> claims.get("role", String.class));
        Integer customId = jwtService.extractClaim(token, claims -> claims.get("customId", Integer.class));

        assertEquals("ROLE_ADMIN", role);
        assertEquals(123, customId);
    }

    @Test
    @DisplayName("isTokenValid returns true when token matches user details and is active")
    void isTokenValid_activeUser_returnsTrue() {
        String email = "alice@example.com";
        String token = jwtService.generateToken(email);
        UserDetails userDetails = new User(email, "pass", List.of(new SimpleGrantedAuthority("ROLE_USER")));

        assertTrue(jwtService.isTokenValid(token, userDetails));
    }

    @Test
    @DisplayName("isTokenValid returns false when username does not match")
    void isTokenValid_mismatchedUsername_returnsFalse() {
        String token = jwtService.generateToken("alice@example.com");
        UserDetails userDetails = new User("bob@example.com", "pass", List.of(new SimpleGrantedAuthority("ROLE_USER")));

        assertFalse(jwtService.isTokenValid(token, userDetails));
    }

    @Test
    @DisplayName("isTokenValid returns false when user account is disabled")
    void isTokenValid_disabledUser_returnsFalse() {
        String email = "disabled@example.com";
        String token = jwtService.generateToken(email);
        UserDetails userDetails = new User(email, "pass", false, true, true, true, List.of());

        assertFalse(jwtService.isTokenValid(token, userDetails));
    }

    @Test
    @DisplayName("isTokenValid returns false when user account is locked")
    void isTokenValid_lockedUser_returnsFalse() {
        String email = "locked@example.com";
        String token = jwtService.generateToken(email);
        UserDetails userDetails = new User(email, "pass", true, true, true, false, List.of());

        assertFalse(jwtService.isTokenValid(token, userDetails));
    }

    @Test
    @DisplayName("tampered token throws SignatureException")
    void tamperedToken_throwsSignatureException() {
        String validToken = jwtService.generateToken("user@example.com");
        // Tamper with the signature portion of the JWT (last segment after '.')
        String tamperedToken = validToken.substring(0, validToken.lastIndexOf('.') + 1) + "invalidSignatureHere";

        assertThrows(SignatureException.class, () -> jwtService.extractUsername(tamperedToken));
    }

    @Test
    @DisplayName("malformed token string throws MalformedJwtException")
    void malformedToken_throwsMalformedJwtException() {
        assertThrows(MalformedJwtException.class, () -> jwtService.extractUsername("not.a.valid.jwt.token"));
    }

    @Test
    @DisplayName("expired token throws ExpiredJwtException on extraction")
    void expiredToken_throwsExpiredJwtException() {
        JwtServiceImpl expiredJwtService = new JwtServiceImpl();
        ReflectionTestUtils.setField(expiredJwtService, "secretKey", TEST_SECRET);
        // Expiration is -1000ms (already expired)
        ReflectionTestUtils.setField(expiredJwtService, "jwtExpiration", -1000L);
        expiredJwtService.init();

        String expiredToken = expiredJwtService.generateToken("expired@example.com");

        assertThrows(ExpiredJwtException.class, () -> jwtService.extractUsername(expiredToken));
    }
}
