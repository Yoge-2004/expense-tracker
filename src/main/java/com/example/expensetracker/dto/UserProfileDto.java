package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Complete profile and preferences for the authenticated user")
@SuppressWarnings("unused")
public record UserProfileDto(
        Long id,
        String name,
        String username,
        String email,
        String currency,
        boolean hasSecurityPin,
        boolean enabled,
        String profilePictureUrl
) {
    public UserProfileDto(
            Long id,
            String name,
            String username,
            String email,
            String currency,
            boolean hasSecurityPin,
            boolean enabled) {
        this(id, name, username, email, currency, hasSecurityPin, enabled, null);
    }
}
