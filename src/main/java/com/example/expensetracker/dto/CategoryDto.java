package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Represents an expense category in API responses. */
@Schema(description = "An expense category (user-specific or global)")
public class CategoryDto {

    @Schema(description = "Unique database ID of the category", example = "1")
    private Long id;

    @Schema(description = "Human-readable name of the category", example = "Food")
    private String name;

    public CategoryDto() {}

    public CategoryDto(Long id, String name) {
        this.id   = id;
        this.name = name;
    }

    public Long   getId()              { return id; }
    public void   setId(Long id)       { this.id = id; }
    public String getName()            { return name; }
    public void   setName(String name) { this.name = name; }
}
