package com.example.expensetracker.domain.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

import com.example.expensetracker.domain.expense.model.Category;



/**
 * Representation of a single user category correction for ML moderation.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Category correction submission from user feedback")
public record AdminMlFeedbackItemDto(
        Long id,
        String feedbackId,
        String text,
        String predictedCategory,
        String correctedCategory,
        Double confidence,
        String trainingStatus,
        String userEmail,
        LocalDateTime createdAt
) {}
