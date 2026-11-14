package com.example.expensetracker.domain.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;



/**
 * Strongly-typed payload containing creative unique username candidates.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Recommended unique available username suggestions")
public record UsernameSuggestionsDto(
        @Schema(description = "List of exactly 3 available unique username handles")
        List<String> suggestions
) {}
