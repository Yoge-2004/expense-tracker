package com.example.expensetracker.dto;

import java.time.LocalDateTime;

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
