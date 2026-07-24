package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/** Standardised error response returned by the GlobalExceptionHandler. */
@Schema(description = "Standard error response body returned when a request fails")
public class ErrorResponse {

    @Schema(description = "Timestamp at which the error occurred", example = "2025-06-15T10:45:00")
    private final LocalDateTime timestamp;

    @Schema(description = "HTTP status code", example = "400")
    private final int status;

    @Schema(description = "Short HTTP status description", example = "Bad Request")
    private final String error;

    @Schema(description = "Human-readable explanation of the error", example = "Email already registered")
    private final String message;

    @Schema(description = "Request URI path that triggered the error", example = "/api/auth/register")
    private final String path;

    public ErrorResponse(LocalDateTime timestamp, int status, String error, String message, String path) {
        this.timestamp = timestamp;
        this.status    = status;
        this.error     = error;
        this.message   = message;
        this.path      = path;
    }

    public LocalDateTime getTimestamp() { return timestamp; }
    public int           getStatus()    { return status; }
    public String        getError()     { return error; }
    public String        getMessage()   { return message; }
    public String        getPath()      { return path; }
}
