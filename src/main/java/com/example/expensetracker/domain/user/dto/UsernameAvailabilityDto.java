package com.example.expensetracker.domain.user.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

import com.example.expensetracker.domain.user.model.User;


/**
 * Strongly-typed payload reporting real-time username availability and validation feedback.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Real-time username availability status")
@JsonInclude(JsonInclude.Include.NON_NULL)
public record UsernameAvailabilityDto(
        @Schema(description = "Whether the queried username handle is available for registration", example = "true")
        boolean available,

        @Schema(description = "Sanitized username handle evaluated", example = "john.doe")
        String username,

        @Schema(description = "User-facing informational or error message", example = "Username is available!")
        String message
) {}
