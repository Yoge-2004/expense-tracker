package com.example.expensetracker.domain.user.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

import com.example.expensetracker.domain.user.model.User;

/**
 * Complete read-only view of a user's account profile and preferences.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Complete profile and preferences for the authenticated user")
@JsonInclude(JsonInclude.Include.NON_NULL)
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

        @Schema(description = "Profile avatar picture URL", example = "/api/users/1/avatar")
        String profilePictureUrl,

        @Schema(description = "Role assigned to the user", example = "ROLE_USER")
        String role
) {
    public static UserProfileDto from(User user) {
        if (user == null) {
            return null;
        }
        return new UserProfileDto(
                user.getId(),
                user.getName(),
                user.getUsername(),
                user.getEmail(),
                user.getCurrency(),
                user.hasSecurityPin(),
                user.getProfilePictureUrl(),
                user.getRole() != null ? user.getRole().name() : null
        );
    }
}
