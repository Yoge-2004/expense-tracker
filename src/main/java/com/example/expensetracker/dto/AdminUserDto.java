package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * Detailed user model exposed specifically to administrative operators.
 * Never includes sensitive credentials (password hash, PIN hash).
 *
 * @author Yogeshwaran
 */
@Schema(description = "User directory entry with administrative moderation attributes")
public record AdminUserDto(
        @Schema(description = "Internal unique user database ID", example = "42")
        Long id,

        @Schema(description = "Display name of the user", example = "Jane Doe")
        String name,

        @Schema(description = "Login handle/username", example = "janedoe")
        String username,

        @Schema(description = "Primary registered email address", example = "jane@example.com")
        String email,

        @Schema(description = "Assigned RBAC role", example = "ROLE_USER")
        String role,

        @Schema(description = "Whether account authentication is enabled", example = "true")
        boolean enabled,

        @Schema(description = "Whether account has been administratively locked", example = "false")
        boolean accountLocked,

        @Schema(description = "User preferred currency", example = "INR")
        String currency,

        @Schema(description = "Account registration timestamp")
        LocalDateTime createdAt,

        @Schema(description = "Total number of expenses owned by this user", example = "128")
        long expenseCount
) {}
