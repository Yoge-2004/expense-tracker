package com.example.expensetracker.exception;

import com.example.expensetracker.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * @author Yogeshwaran
 * @version 1.0
 * @see ErrorResponse
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Handles {@link IllegalArgumentException} thrown when invalid input is provided.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(
            IllegalArgumentException ex,
            HttpServletRequest request) {

        log.warn("Bad request at '{}': {}", request.getRequestURI(), ex.getMessage());
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
     * Handles {@link IllegalStateException}, used for operations that are valid
     * requests but conflict with the resource's current state.
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(
            IllegalStateException ex,
            HttpServletRequest request) {

        log.warn("Conflict at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.CONFLICT.value(),
                HttpStatus.CONFLICT.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    /**
     * Handles {@link NoSuchElementException} thrown when a requested resource is not found.
     */
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(
            NoSuchElementException ex,
            HttpServletRequest request) {

        log.warn("Resource not found at '{}': {}", request.getRequestURI(), ex.getMessage());
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

        log.error("Database unavailable at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                HttpStatus.SERVICE_UNAVAILABLE.getReasonPhrase(),
                "Unable to connect to the server. Please try again in a few moments.",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }

    /**
     * Handles authentication failures such as wrong credentials, locked, or disabled accounts.
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

        String message = (ex.getMessage() != null && !ex.getMessage().isBlank() && !"Bad credentials".equalsIgnoreCase(ex.getMessage()))
                ? ex.getMessage()
                : "Invalid email/username or password";

        log.warn("Authentication failed at '{}': {}", request.getRequestURI(), message);
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.UNAUTHORIZED.value(),
                "Authentication Failed",
                message,
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    /**
     * Handles rate limit violations across throttled endpoints.
     */
    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ErrorResponse> handleRateLimitExceeded(
            RateLimitExceededException ex,
            HttpServletRequest request) {

        log.warn("Rate limit exceeded at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.TOO_MANY_REQUESTS.value(),
                HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(ex.getRetryAfterSeconds()))
                .body(response);
    }

    /**
     * Catch-all handler for any unhandled exceptions not covered by more specific handlers.
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

        log.error("Unhandled exception at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
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

        log.warn("Validation error at '{}': {}", request.getRequestURI(), message);
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                message,
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Handles malformed or unparseable HTTP request payloads (e.g. invalid JSON syntax).
     */
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMessageNotReadable(
            org.springframework.http.converter.HttpMessageNotReadableException ex,
            HttpServletRequest request) {

        log.warn("Malformed JSON payload at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Malformed JSON request body: " + (ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage()),
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Handles URL path variable or query parameter type mismatches.
     */
    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex,
            HttpServletRequest request) {

        log.warn("Type mismatch at '{}': parameter '{}' with value '{}'", request.getRequestURI(), ex.getName(), ex.getValue());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Invalid parameter value for '" + ex.getName() + "': " + ex.getValue(),
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Handles access denied / authorization rejections from Spring Security.
     */
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(
            org.springframework.security.access.AccessDeniedException ex,
            HttpServletRequest request) {

        log.warn("Access denied at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.FORBIDDEN.value(),
                HttpStatus.FORBIDDEN.getReasonPhrase(),
                "Access is denied: " + ex.getMessage(),
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    /**
     * Handles oversized file upload attempts exceeding configured multipart boundaries.
     */
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(
            org.springframework.web.multipart.MaxUploadSizeExceededException ex,
            HttpServletRequest request) {

        log.warn("Max upload size exceeded at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.PAYLOAD_TOO_LARGE.value(),
                HttpStatus.PAYLOAD_TOO_LARGE.getReasonPhrase(),
                "Uploaded file exceeds maximum allowed size limit.",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(response);
    }
}
