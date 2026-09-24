package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/** Standardised immutable error response returned by the GlobalExceptionHandler. */
@Schema(description = "Standard error response body returned when a request fails")
public record ErrorResponse(
        @Schema(description = "Timestamp at which the error occurred", example = "2025-06-15T10:45:00")
        LocalDateTime timestamp,

        @Schema(description = "HTTP status code", example = "400")
        int status,

        @Schema(description = "Short HTTP status description", example = "Bad Request")
        String error,

        @Schema(description = "Human-readable explanation of the error", example = "Email already registered")
        String message,

        @Schema(description = "Request URI path that triggered the error", example = "/api/auth/register")
        String path
) {}
