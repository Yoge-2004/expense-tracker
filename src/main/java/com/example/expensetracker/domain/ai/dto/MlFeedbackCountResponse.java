package com.example.expensetracker.domain.ai.dto;

/**
 * Response containing the count of eligible unconsumed ML feedback records.
 *
 * @param eligibleCount number of feedback records eligible for retraining
 */
public record MlFeedbackCountResponse(long eligibleCount) {}
