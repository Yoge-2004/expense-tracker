package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** Request body for POST /api/categories/user/{userId}. */
@Schema(description = "Name of the new expense category to create")
public class CategoryRequest {

    @Schema(description = "Category name — must be unique for the given user", example = "Groceries", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "Category name is required")
    private String name;

    public CategoryRequest() {}
    public CategoryRequest(String name) { this.name = name; }

    public String getName()            { return name; }
    public void   setName(String name) { this.name = name; }
}
