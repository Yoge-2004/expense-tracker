package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** Request body for POST /api/categories/user/{userId}. */
@Schema(description = "Name of the new expense category to create")
public record CategoryRequest(
        @Schema(description = "Category name — must be unique for the given user", example = "Groceries", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Category name is required")
        String name
) {}
