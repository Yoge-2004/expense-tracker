package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Health statistics for the machine learning categorization engine.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Health and feedback metrics for the ML categorization pipeline")
public record AdminMlStatsDto(
        long totalFeedbackCount,
        long pendingFeedbackCount,
        long reviewedFeedbackCount,
        String activeModelVersion,
        double averageConfidence,
        String status
) {}
