package com.example.expensetracker.domain.ai.dto;

/**
 * Log entry returned by the Python ML inference microservice.
 *
 * @param timestamp ISO-8601 timestamp
 * @param level     log severity
 * @param thread    worker/thread identifier
 * @param logger    logger name
 * @param message   log message body
 */
public record MlLogEntryDto(
        String timestamp,
        String level,
        String thread,
        String logger,
        String message
) {}
