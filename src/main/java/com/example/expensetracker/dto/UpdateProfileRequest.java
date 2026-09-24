package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request payload for updating user profile information.
 *
 * @param name The new full display name of the user.
 */
@Schema(description = "Request payload for updating user profile display name.")
public record UpdateProfileRequest(
        @Schema(description = "The updated display name.", example = "Yogeshwaran R")
        @NotBlank(message = "Name cannot be blank")
        @Size(min = 2, max = 50, message = "Name must be between 2 and 50 characters")
        String name
) {}
