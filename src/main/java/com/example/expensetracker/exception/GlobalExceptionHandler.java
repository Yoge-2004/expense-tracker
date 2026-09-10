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
     * Handles DB unique-constraint violations (e.g. duplicate category name for the same user,
     * duplicate monthly report log entry). Previously these were caught by the broader
     * {@link #handleDatabaseUnavailable} handler which incorrectly returned 503 SERVICE_UNAVAILABLE.
     * 409 CONFLICT is the correct semantic — the request itself is valid but conflicts with
     * the current state of the resource.
     */
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(
            org.springframework.dao.DataIntegrityViolationException ex,
            HttpServletRequest request) {

        String message = "A record with these details already exists.";
        // Try to extract a more user-friendly hint from the underlying constraint name.
        Throwable root = ex.getMostSpecificCause();
        if (root != null && root.getMessage() != null) {
            String lower = root.getMessage().toLowerCase(java.util.Locale.ROOT);
            if (lower.contains("category") || lower.contains("uk_category")) {
                message = "A category with this name already exists for this user.";
            } else if (lower.contains("monthly_report_log") || lower.contains("report")) {
                message = "A report for this period has already been generated.";
            } else if (lower.contains("email")) {
                message = "An account with this email already exists.";
            }
        }

        log.warn("Data integrity violation at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.CONFLICT.value(),
                HttpStatus.CONFLICT.getReasonPhrase(),
                message,
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    /**
     * Handles {@link org.springframework.web.server.ResponseStatusException} thrown by
     * controllers (e.g. {@code WebAuthnController}) so the response shape matches the
     * standard {@link ErrorResponse} schema used elsewhere.
     */
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(
            org.springframework.web.server.ResponseStatusException ex,
            HttpServletRequest request) {

        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        String reason = ex.getReason() != null ? ex.getReason() : status.getReasonPhrase();
        log.warn("Response status {} at '{}': {}", status.value(), request.getRequestURI(), reason);
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                reason,
                request.getRequestURI()
        );

        return ResponseEntity.status(status).body(response);
    }

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

    @ExceptionHandler(org.springframework.web.multipart.support.MissingServletRequestPartException.class)
    public ResponseEntity<ErrorResponse> handleMissingMultipartPart(
            org.springframework.web.multipart.support.MissingServletRequestPartException ex,
            HttpServletRequest request) {

        log.warn("Missing multipart request part at '{}': part='{}'", request.getRequestURI(), ex.getRequestPartName());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Required multipart file part is missing.",
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

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

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMessageNotReadable(
            org.springframework.http.converter.HttpMessageNotReadableException ex,
            HttpServletRequest request) {

        log.warn("Malformed JSON payload at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Malformed JSON request body.",
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex,
            HttpServletRequest request) {

        log.warn("Type mismatch at '{}': parameter '{}' with value '{}'", request.getRequestURI(), ex.getName(), ex.getValue());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Invalid parameter value.",
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

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

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(
            org.springframework.web.multipart.MaxUploadSizeExceededException ex,
            HttpServletRequest request) {

        log.warn("Max upload size exceeded at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.CONTENT_TOO_LARGE.value(),
                HttpStatus.CONTENT_TOO_LARGE.getReasonPhrase(),
                "Uploaded file exceeds maximum allowed size limit.",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE).body(response);
    }
}
