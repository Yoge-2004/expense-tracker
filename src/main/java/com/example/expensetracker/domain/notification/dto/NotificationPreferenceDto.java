package com.example.expensetracker.domain.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * DTO describing a notification preference category and whether the user has it enabled.
 *
 * @param type        notification kind identifier
 * @param label       human-readable display title
 * @param description explanation of when notifications are sent
 * @param enabled     whether delivery is enabled
 * @param locked      true if the preference cannot be disabled by the user
 */
@Schema(description = "One notification kind and whether the user receives it")
public record NotificationPreferenceDto(
        @Schema(example = "BUDGET_WARNING") String type,
        @Schema(example = "Budget warnings") String label,
        @Schema(example = "When a budget reaches 80% of its limit") String description,
        boolean enabled,
        @Schema(description = "True when the user cannot switch this kind off") boolean locked
) {
}
