package com.example.expensetracker.exception;

import com.example.expensetracker.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.time.LocalDateTime;
import java.util.NoSuchElementException;

/**
 * Global exception handler for the Expense Tracker REST API.
 *
 * <p>Centralises error handling across all controllers using Spring's
 * {@code @RestControllerAdvice}. Each handler method intercepts a specific
 * exception type, wraps it in a standardised {@link ErrorResponse}, and returns
 * an appropriate HTTP status code to the client.</p>
 *
 * <p>Exception types handled:</p>
 * <ul>
 *   <li>{@link IllegalArgumentException} — {@code 400 Bad Request}</li>
 *   <li>{@link NoSuchElementException} — {@code 404 Not Found}</li>
 *   <li>{@link BadCredentialsException} / {@link InternalAuthenticationServiceException}
 *       — {@code 401 Unauthorized}</li>
 *   <li>{@link MethodArgumentNotValidException} — {@code 400 Bad Request} (validation errors)</li>
 *   <li>{@link Exception} (catch-all) — {@code 500 Internal Server Error}</li>
 * </ul>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see ErrorResponse
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handles {@link IllegalArgumentException} thrown when invalid input is provided.
     *
     * <p>Common causes include: duplicate email during registration, invalid category ID,
     * category ownership violations, or missing required entities.</p>
     *
     * @param ex      the thrown {@link IllegalArgumentException}
     * @param request the current HTTP request (used to populate the {@code path} field)
     * @return a {@code 400 Bad Request} response with an {@link ErrorResponse} body
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(
            IllegalArgumentException ex,
            HttpServletRequest request) {

        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Handles {@link NoSuchElementException} thrown when a requested resource is not found.
     *
     * <p>Typically occurs when an optional value is unwrapped without a fallback.</p>
     *
     * @param ex      the thrown {@link NoSuchElementException}
     * @param request the current HTTP request
     * @return a {@code 404 Not Found} response with an {@link ErrorResponse} body
     */
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(
            NoSuchElementException ex,
            HttpServletRequest request) {

        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.NOT_FOUND.value(),
                HttpStatus.NOT_FOUND.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    /**
     * Handles {@link DatabaseUnavailableException} and Spring/JDBC DB connectivity failures.
     *
     * @param ex      the database exception
     * @param request the current HTTP request
     * @return a {@code 503 Service Unavailable} response
     */
    @ExceptionHandler({
        DatabaseUnavailableException.class,
        org.springframework.dao.DataAccessException.class,
        org.springframework.transaction.CannotCreateTransactionException.class,
        org.hibernate.exception.JDBCConnectionException.class,
        java.sql.SQLException.class
    })
    public ResponseEntity<ErrorResponse> handleDatabaseUnavailable(
            Exception ex,
            HttpServletRequest request) {

        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                HttpStatus.SERVICE_UNAVAILABLE.getReasonPhrase(),
                "Database service is unavailable. Please try again later.",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }

    /**
     * Handles authentication failures such as wrong credentials, locked, or disabled accounts.
     * Checks if the underlying root cause is a database connectivity issue.
     *
     * @param ex      the authentication-related exception
     * @param request the current HTTP request
     * @return a {@code 401 Unauthorized} or {@code 503 Service Unavailable} response
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(
            AuthenticationException ex,
            HttpServletRequest request) {

        Throwable rootCause = ex.getCause();
        while (rootCause != null) {
            if (rootCause instanceof org.springframework.dao.DataAccessException
                    || rootCause instanceof org.springframework.transaction.CannotCreateTransactionException
                    || rootCause instanceof org.hibernate.exception.JDBCConnectionException
                    || rootCause instanceof java.sql.SQLException
                    || rootCause instanceof DatabaseUnavailableException) {
                return handleDatabaseUnavailable((Exception) rootCause, request);
            }
            rootCause = rootCause.getCause();
        }

        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.UNAUTHORIZED.value(),
                "Authentication Failed",
                "Invalid email or password",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    /**
     * Catch-all handler for any unhandled exceptions not covered by more specific handlers.
     *
     * @param ex      the unhandled exception
     * @param request the current HTTP request
     * @return a {@code 500 Internal Server Error} response with an {@link ErrorResponse} body
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(
            Exception ex,
            HttpServletRequest request) {

        Throwable rootCause = ex.getCause();
        while (rootCause != null) {
            if (rootCause instanceof org.springframework.dao.DataAccessException
                    || rootCause instanceof org.springframework.transaction.CannotCreateTransactionException
                    || rootCause instanceof org.hibernate.exception.JDBCConnectionException
                    || rootCause instanceof java.sql.SQLException
                    || rootCause instanceof DatabaseUnavailableException) {
                return handleDatabaseUnavailable((Exception) rootCause, request);
            }
            rootCause = rootCause.getCause();
        }

        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                "Unexpected error occurred",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    /**
     * Handles validation failures triggered by {@code @Valid} on request body parameters.
     *
     * <p>Extracts the first field-level validation error from the binding result and
     * returns it as a human-readable message in the error response.</p>
     *
     * @param ex      the {@link MethodArgumentNotValidException} containing binding errors
     * @param request the current HTTP request
     * @return a {@code 400 Bad Request} response with the first validation error message
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationError(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {

        String message = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .findFirst()
                .orElse("Validation error");

        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                message,
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }
}
