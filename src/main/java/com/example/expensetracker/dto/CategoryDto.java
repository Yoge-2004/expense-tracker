package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Represents an expense category in API responses. */
@Schema(description = "An expense category (user-specific or global)")
public record CategoryDto(
        @Schema(description = "Unique database ID of the category", example = "1")
        Long id,

        @Schema(description = "Human-readable name of the category", example = "Food")
        String name
) {}
