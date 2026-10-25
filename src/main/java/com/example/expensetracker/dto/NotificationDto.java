package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Schema(description = "One notification in the user's inbox")
public record NotificationDto(
        @Schema(example = "12") Long id,
        @Schema(description = "BUDGET_WARNING, BUDGET_EXCEEDED, SUBSCRIPTION_DUE, GOAL_MILESTONE, LARGE_EXPENSE, "
                + "WEEKLY_DIGEST or SYSTEM", example = "BUDGET_WARNING") String type,
        @Schema(example = "Budget almost used: Food") String title,
        @Schema(example = "You have used 84% of your INR 5,000 budget (INR 4,200 spent).") String body,
        @Schema(description = "Where tapping it should go in the app, if anywhere", example = "budgets") String route,
        @Schema(description = "True once the user has opened or dismissed it") boolean read,
        @Schema(description = "UTC ISO-8601 timestamp with trailing 'Z'", example = "2026-10-24T09:00:00Z") Instant createdAt
) {
    /**
     * Backward-compatibility constructor accepting {@link LocalDateTime}, automatically converting
     * to a UTC {@link Instant}.
     */
    public NotificationDto(Long id, String type, String title, String body, String route, boolean read, LocalDateTime createdAt) {
        this(id, type, title, body, route, read, createdAt != null ? createdAt.toInstant(ZoneOffset.UTC) : null);
    }
}
