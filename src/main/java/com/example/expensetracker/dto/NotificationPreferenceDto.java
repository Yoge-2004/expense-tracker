package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One notification kind and whether the user receives it")
public record NotificationPreferenceDto(
        @Schema(example = "BUDGET_WARNING") String type,
        @Schema(example = "Budget warnings") String label,
        @Schema(example = "When a budget reaches 80% of its limit") String description,
        boolean enabled,
        @Schema(description = "True when the user cannot switch this kind off") boolean locked
) {
}
