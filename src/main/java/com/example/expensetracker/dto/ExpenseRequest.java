package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Request body for POST /api/expenses/user/{userId}. */
@Schema(description = "Data required to create a new expense record")
public record ExpenseRequest(
        @Schema(description = "Monetary amount of the expense — must be a positive number",
                example = "19.99", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Amount is required")
        @Positive(message = "Amount must be positive")
        BigDecimal amount,

        @Schema(description = "Optional short description or note about the expense",
                example = "Monthly coffee subscription")
        String description,

        @Schema(description = "Date the expense was incurred (ISO-8601: yyyy-MM-dd)",
                example = "2025-06-15", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Expense date is required")
        LocalDate expenseDate,

        @Schema(description = "ID of the category to associate with this expense",
                example = "1", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Category ID is required")
        Long categoryId
) {}
