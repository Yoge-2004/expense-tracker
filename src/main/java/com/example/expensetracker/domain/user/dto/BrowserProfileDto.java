package com.example.expensetracker.domain.user.dto;

import com.example.expensetracker.domain.user.model.User;

/**
 * Public browser-session profile snapshot returned without exposing raw JWT tokens to browser scripts.
 *
 * @param userId            database ID of the authenticated user
 * @param name              display name
 * @param username          unique username handle
 * @param email             email address
 * @param currency          ISO 4217 display currency code
 * @param hasSecurityPin    whether a 6-digit security PIN is configured
 * @param profilePictureUrl avatar URL or empty string if unset
 * @param role              assigned RBAC role name
 */
public record BrowserProfileDto(
        Long userId,
        String name,
        String username,
        String email,
        String currency,
        boolean hasSecurityPin,
        String profilePictureUrl,
        String role) {

    /**
     * Builds a sanitized {@link BrowserProfileDto} snapshot from a {@link User} entity.
     *
     * @param user authenticated user entity
     * @return non-null profile snapshot
     */
    public static BrowserProfileDto from(User user) {
        return new BrowserProfileDto(
                user.getId(),
                user.getName() == null ? "" : user.getName(),
                user.getUsername() == null ? "" : user.getUsername(),
                user.getEmail() == null ? "" : user.getEmail(),
                user.getCurrency() == null ? "INR" : user.getCurrency(),
                user.hasSecurityPin(),
                user.getProfilePictureUrl() == null ? "" : user.getProfilePictureUrl(),
                user.getRole() == null ? "ROLE_USER" : user.getRole().name());
    }
}
