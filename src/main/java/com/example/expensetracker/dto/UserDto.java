package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Public user profile returned after registration (password is never included). */
@Schema(description = "Public profile of a registered user. Password is intentionally excluded.")
public record UserDto(
        @Schema(description = "Unique database identifier of the user", example = "1")
        Long id,

        @Schema(description = "Full display name of the user", example = "John Doe")
        String name,

        @Schema(description = "Unique handle/username of the user", example = "johndoe")
        String username,

        @Schema(description = "Email address associated with the user account", example = "john.doe@example.com")
        String email,

        @Schema(description = "Whether the account is active and permitted to authenticate", example = "true")
        boolean enabled,

        @Schema(description = "Preferred display currency (ISO 4217 3-letter code)", example = "INR")
        String currency
) {}
