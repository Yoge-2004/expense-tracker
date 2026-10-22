package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Single line/event of server application logs.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Server application log entry for administrative inspection")
public record AdminLogEntryDto(
        String timestamp,
        String level,
        String thread,
        String logger,
        String message
) {}
