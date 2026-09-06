package com.example.expensetracker.security;

import com.example.expensetracker.model.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("UserSecurity IDOR/BOLA Unit Tests")
class UserSecurityTest {

    private UserSecurity userSecurity;

    @BeforeEach
    void setUp() {
        userSecurity = new UserSecurity();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Allows access when requesting own user ID")
    void allowsAccess_whenRequestingOwnUserId() {
        User user = new User();
        user.setId(100L);
        user.setEmail("user100@example.com");

        CustomUserDetails userDetails = new CustomUserDetails(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertTrue(userSecurity.isCurrentUser(100L));
        assertDoesNotThrow(() -> userSecurity.validateUserAccess(100L));
    }

    @Test
    @DisplayName("Rejects access with AccessDeniedException when requesting another user ID (IDOR prevention)")
    void rejectsAccess_whenRequestingAnotherUserId() {
        User user = new User();
        user.setId(100L);
        user.setEmail("user100@example.com");

        CustomUserDetails userDetails = new CustomUserDetails(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertFalse(userSecurity.isCurrentUser(200L));
        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> userSecurity.validateUserAccess(200L));
        assertTrue(ex.getMessage().contains("Access denied"));
    }

    @Test
    @DisplayName("Rejects access when target userId is null")
    void rejectsAccess_whenUserIdIsNull() {
        User user = new User();
        user.setId(100L);
        CustomUserDetails userDetails = new CustomUserDetails(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertFalse(userSecurity.isCurrentUser(null));
        assertThrows(AccessDeniedException.class, () -> userSecurity.validateUserAccess(null));
    }

    @Test
    @DisplayName("Rejects access when there is no authenticated principal")
    void rejectsAccess_whenNoAuthentication() {
        SecurityContextHolder.clearContext();

        assertFalse(userSecurity.isCurrentUser(100L));
        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> userSecurity.validateUserAccess(100L));
        assertEquals("Access denied.", ex.getMessage());
    }
}
