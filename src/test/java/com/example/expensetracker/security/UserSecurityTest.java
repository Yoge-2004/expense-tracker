package com.example.expensetracker.security;

import com.example.expensetracker.model.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

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

    private void authenticateUser(Long userId, String email) {
        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        CustomUserDetails cud = new CustomUserDetails(user);

        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(cud, null, cud.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("isCurrentUser returns true when authenticated principal owns the given userId")
    void isCurrentUser_matchingId_returnsTrue() {
        authenticateUser(42L, "user@example.com");

        assertTrue(userSecurity.isCurrentUser(42L));
    }

    @Test
    @DisplayName("isCurrentUser returns false when authenticated principal has different userId (IDOR)")
    void isCurrentUser_mismatchedId_returnsFalse() {
        authenticateUser(42L, "user@example.com");

        assertFalse(userSecurity.isCurrentUser(99L));
    }

    @Test
    @DisplayName("isCurrentUser returns false when userId is null")
    void isCurrentUser_nullUserId_returnsFalse() {
        authenticateUser(42L, "user@example.com");

        assertFalse(userSecurity.isCurrentUser(null));
    }

    @Test
    @DisplayName("isCurrentUser returns false when security context has no authentication")
    void isCurrentUser_noAuthentication_returnsFalse() {
        SecurityContextHolder.clearContext();

        assertFalse(userSecurity.isCurrentUser(42L));
    }

    @Test
    @DisplayName("isCurrentUser returns false when caller is anonymous")
    void isCurrentUser_anonymousUser_returnsFalse() {
        AnonymousAuthenticationToken anon = new AnonymousAuthenticationToken(
                "key", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))
        );
        SecurityContextHolder.getContext().setAuthentication(anon);

        assertFalse(userSecurity.isCurrentUser(42L));
    }

    @Test
    @DisplayName("validateUserAccess succeeds silently when authenticated principal owns the resource")
    void validateUserAccess_matchingId_succeeds() {
        authenticateUser(42L, "user@example.com");

        assertDoesNotThrow(() -> userSecurity.validateUserAccess(42L));
    }

    @Test
    @DisplayName("validateUserAccess throws AccessDeniedException when caller targets another user's ID (IDOR)")
    void validateUserAccess_mismatchedId_throwsAccessDeniedException() {
        authenticateUser(42L, "user@example.com");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                userSecurity.validateUserAccess(99L)
        );
        assertEquals("Access denied.", ex.getMessage());
    }

    @Test
    @DisplayName("validateUserAccess throws AccessDeniedException when unauthenticated")
    void validateUserAccess_unauthenticated_throwsAccessDeniedException() {
        SecurityContextHolder.clearContext();

        assertThrows(AccessDeniedException.class, () ->
                userSecurity.validateUserAccess(42L)
        );
    }
}
