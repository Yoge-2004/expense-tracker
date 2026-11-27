package com.example.expensetracker.domain.ai.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;



/**
 * Request payload listing ML feedback record IDs that have been consumed by retraining.
 *
 * @param feedbackIds non-empty list of consumed feedback identifiers
 */
public record MlFeedbackConsumeRequest(@NotEmpty List<String> feedbackIds) {}
