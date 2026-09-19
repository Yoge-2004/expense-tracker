package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Represents a single expense record in API responses (and recurring expense requests). */
@Schema(description = "An expense record — used as both a response body and a request body for recurring expenses")
public record ExpenseDto(
        @Schema(description = "Unique database ID of the expense",
                example = "42", accessMode = Schema.AccessMode.READ_ONLY)
        Long id,

        @Schema(description = "Monetary amount of the expense",
                example = "19.99", requiredMode = Schema.RequiredMode.REQUIRED)
        BigDecimal amount,

        @Schema(description = "Optional short description or note about the expense",
                example = "Monthly coffee subscription")
        String description,

        @Schema(description = "Date the expense was incurred (ISO-8601: yyyy-MM-dd)",
                example = "2025-06-15", requiredMode = Schema.RequiredMode.REQUIRED)
        LocalDate expenseDate,

        @Schema(description = "ID of the associated category (null = uncategorised)", example = "1")
        Long categoryId,

        @Schema(description = "Human-readable name of the associated category",
                example = "Food", accessMode = Schema.AccessMode.READ_ONLY)
        String categoryName,

        @Schema(description = "Recurrence pattern for a subscription: DAILY, WEEKLY, MONTHLY, YEARLY, or CUSTOM")
        String frequency,

        @Schema(description = "Number of days between charges when frequency is CUSTOM")
        Integer intervalDays,

        @Schema(description = "Timestamp when the expense was created in database",
                accessMode = Schema.AccessMode.READ_ONLY)
        LocalDateTime createdAt
) {
    public ExpenseDto(Long id, BigDecimal amount, String description,
                      LocalDate expenseDate, Long categoryId, String categoryName) {
        this(id, amount, description, expenseDate, categoryId, categoryName, null, null, null);
    }
}
