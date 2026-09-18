package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Complete read-only view of a user's account profile and preferences.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Complete profile and preferences for the authenticated user")
@SuppressWarnings("unused")
public record UserProfileDto(
        @Schema(description = "Unique database ID of the user", example = "1")
        Long id,

        @Schema(description = "Full display name of the user", example = "Jane Doe")
        String name,

        @Schema(description = "Unique handle/username of the user", example = "janedoe")
        String username,

        @Schema(description = "Email address associated with the user account", example = "jane.doe@example.com")
        String email,

        @Schema(description = "Preferred ISO 4217 display currency", example = "INR")
        String currency,

        @Schema(description = "Whether the user has configured a 6-digit Security PIN", example = "true")
        boolean hasSecurityPin,

        @Schema(description = "Whether the user account is active and enabled", example = "true")
        boolean enabled
) {}
