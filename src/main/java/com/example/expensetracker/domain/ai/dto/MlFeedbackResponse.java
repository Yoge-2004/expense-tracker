package com.example.expensetracker.domain.ai.dto;

/**
 * Acknowledgement returned when an ML feedback record is stored.
 *
 * @param feedbackId persisted feedback identifier
 * @param status     processing status (e.g., recorded or ignored)
 */
public record MlFeedbackResponse(String feedbackId, String status) {}
