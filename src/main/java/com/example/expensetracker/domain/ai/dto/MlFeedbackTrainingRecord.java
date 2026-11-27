package com.example.expensetracker.domain.ai.dto;

import java.time.LocalDateTime;


/**
 * Training record projection exported from stored ML feedback entries.
 *
 * @param feedbackId        unique feedback UUID
 * @param transactionId     associated transaction reference ID
 * @param text              input transaction text
 * @param predictedCategory originally predicted category
 * @param correctedCategory user-corrected category label
 * @param confidence        model confidence at prediction time
 * @param modelVersion      model revision string
 * @param createdAt         submission timestamp
 * @param trainingStatus    lifecycle status (e.g., eligible, consumed)
 * @param source            originating feedback source
 */
public record MlFeedbackTrainingRecord(
        String feedbackId,
        String transactionId,
        String text,
        String predictedCategory,
        String correctedCategory,
        Double confidence,
        String modelVersion,
        LocalDateTime createdAt,
        String trainingStatus,
        String source
) {}
