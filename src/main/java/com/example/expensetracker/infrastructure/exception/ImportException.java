package com.example.expensetracker.infrastructure.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;


/**
 * Thrown when data parsing, schema validation, or processing fails during bulk import operations.
 */
@ResponseStatus(HttpStatus.BAD_REQUEST)
public class ImportException extends RuntimeException {
    public ImportException(String message) {
        super(message);
    }

    public ImportException(String message, Throwable cause) {
        super(message, cause);
    }
}
