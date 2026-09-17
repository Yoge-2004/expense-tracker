package com.example.expensetracker.security;

import com.example.expensetracker.model.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * Enforces Object-Level Authorization (IDOR / BOLA prevention).
 * Verifies that the authenticated user owns the resource they are attempting
 * to read, modify, export, or delete.
 *
 * @author Yogeshwaran
 * @version 1.0
 */
@Slf4j
@Component("userSecurity")
public class UserSecurity {

    public boolean isCurrentUser(Long userId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return isCurrentUser(auth, userId);
    }

    public boolean isCurrentUser(Authentication authentication, Long userId) {
        if (userId == null || authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof CustomUserDetails cud) {
            User u = cud.getUser();
            return u != null && Objects.equals(u.getId(), userId);
        }
        return false;
    }

    /**
     * Validates that the currently authenticated user matches the target userId.
     * Production authorization fails closed when no authenticated principal exists.
     */
    public void validateUserAccess(Long userId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!isCurrentUser(auth, userId)) {
            log.warn("Access denied: authenticated principal does not own userId={}", userId);
            throw new AccessDeniedException("Access denied.");
        }
    }
}
