package com.example.expensetracker.domain.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;


/**
 * Strongly-typed payload returned upon successful avatar image upload.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Avatar upload confirmation and URL")
public record AvatarUploadResponse(
        @Schema(description = "Resolved URL for accessing the updated avatar picture", example = "/api/users/1/avatar?v=1731600000000")
        String profilePictureUrl,

        @Schema(description = "Success message", example = "Profile picture updated successfully")
        String message
) {}
