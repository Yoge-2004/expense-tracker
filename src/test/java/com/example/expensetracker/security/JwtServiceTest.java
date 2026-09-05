package com.example.expensetracker.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JwtService Unit Tests")
class JwtServiceTest {

    private JwtService jwtService;
    private MockEnvironment environment;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        environment = new MockEnvironment();
        jwtService.setEnvironment(environment);
        jwtService.setSecretKey(JwtService.DEFAULT_DEV_SECRET);
        jwtService.setJwtExpiration(3600000); // 1 hour
        jwtService.init();
    }

    @Test
    @DisplayName("init with valid base64 secret succeeds")
    void init_validBase64Secret_succeeds() {
        assertNotNull(jwtService.generateToken("user@example.com"));
    }

    @Test
    @DisplayName("init with empty secret throws IllegalStateException")
    void init_emptySecret_throwsException() {
        JwtService service = new JwtService();
        service.setSecretKey("   ");
        assertThrows(IllegalStateException.class, service::init);
    }

    @Test
    @DisplayName("init with secret shorter than 32 bytes throws IllegalStateException")
    void init_shortSecret_throwsException() {
        JwtService service = new JwtService();
        service.setSecretKey("c2hvcnQ="); // "short" base64
        assertThrows(IllegalStateException.class, service::init);
    }

    @Test
    @DisplayName("generateToken and extractUsername round trip correctly")
    void generateTokenAndExtractUsername_validUser() {
        String token = jwtService.generateToken("testuser@example.com");
        assertNotNull(token);
        assertEquals("testuser@example.com", jwtService.extractUsername(token));
    }

    @Test
    @DisplayName("isTokenValid returns true for matching user")
    void isTokenValid_matchingUser_returnsTrue() {
        String token = jwtService.generateToken("valid@example.com");
        UserDetails userDetails = new User("valid@example.com", "password", Collections.emptyList());
        assertTrue(jwtService.isTokenValid(token, userDetails));
    }

    @Test
    @DisplayName("isTokenValid returns false for non-matching user")
    void isTokenValid_differentUser_returnsFalse() {
        String token = jwtService.generateToken("first@example.com");
        UserDetails userDetails = new User("second@example.com", "password", Collections.emptyList());
        assertFalse(jwtService.isTokenValid(token, userDetails));
    }
}
