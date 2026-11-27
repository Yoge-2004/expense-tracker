package com.example.expensetracker.infrastructure.logging;

/**
 * Infrastructure representation of a buffered application log event.
 *
 * @param timestamp ISO-8601 UTC event timestamp
 * @param level     normalized severity level
 * @param thread    originating thread name
 * @param logger    SLF4J logger name
 * @param message   masked log message text
 */
public record LogEntryDto(
        String timestamp,
        String level,
        String thread,
        String logger,
        String message
) {}
