package com.example.expensetracker.exception;

import com.example.expensetracker.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.bind.MissingPathVariableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

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
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

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

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(
            BadRequestException ex,
            HttpServletRequest request) {

        log.warn("Bad request exception at '{}': {}", request.getRequestURI(), ex.getMessage());
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

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(
            ConflictException ex,
            HttpServletRequest request) {

        log.warn("Conflict exception at '{}': {}", request.getRequestURI(), ex.getMessage());
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

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(
            ResourceNotFoundException ex,
            HttpServletRequest request) {

        log.warn("Resource not found exception at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.NOT_FOUND.value(),
                HttpStatus.NOT_FOUND.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(jakarta.persistence.EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleEntityNotFound(
            jakarta.persistence.EntityNotFoundException ex,
            HttpServletRequest request) {

        log.warn("Entity not found at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.NOT_FOUND.value(),
                HttpStatus.NOT_FOUND.getReasonPhrase(),
                ex.getMessage() != null && !ex.getMessage().isBlank() ? ex.getMessage() : "Requested entity not found",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(org.springframework.dao.EmptyResultDataAccessException.class)
    public ResponseEntity<ErrorResponse> handleEmptyResultDataAccess(
            org.springframework.dao.EmptyResultDataAccessException ex,
            HttpServletRequest request) {

        log.warn("Empty result data access at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.NOT_FOUND.value(),
                HttpStatus.NOT_FOUND.getReasonPhrase(),
                "Requested resource was not found.",
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
            } else if (lower.contains("foreign key") || lower.contains("fk_")) {
                message = "Referenced entity does not exist or violates relational integrity.";
            } else if (lower.contains("not-null") || lower.contains("null value")) {
                message = "Required data field is missing in request.";
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

        log.warn("ResponseStatusException ({}) at '{}': {}", status.value(), request.getRequestURI(), reason);
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
            org.springframework.dao.DataAccessException.class,
            org.springframework.transaction.CannotCreateTransactionException.class,
            org.hibernate.exception.JDBCConnectionException.class,
            DatabaseUnavailableException.class
    })
    public ResponseEntity<ErrorResponse> handleDatabaseUnavailable(
            Exception ex,
            HttpServletRequest request) {

        log.error("Database connection failure at '{}': {}", request.getRequestURI(), ex.getMessage());
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

        Exception dbCause = findDatabaseUnavailableCause(ex);
        if (dbCause != null) {
            return handleDatabaseUnavailable(dbCause, request);
        }

        String msg = ex.getMessage();
        if ("Bad credentials".equalsIgnoreCase(msg)) {
            msg = "Invalid email/username or password";
        }

        log.warn("Authentication failed at '{}': {}", request.getRequestURI(), msg);
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.UNAUTHORIZED.value(),
                "Authentication Failed",
                msg,
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

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingRequestParameter(
            MissingServletRequestParameterException ex,
            HttpServletRequest request) {

        log.warn("Missing request parameter at '{}': parameter='{}'", request.getRequestURI(), ex.getParameterName());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Required request parameter '" + ex.getParameterName() + "' is missing",
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(MissingPathVariableException.class)
    public ResponseEntity<ErrorResponse> handleMissingPathVariable(
            MissingPathVariableException ex,
            HttpServletRequest request) {

        log.warn("Missing path variable at '{}': variable='{}'", request.getRequestURI(), ex.getVariableName());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Required path variable '" + ex.getVariableName() + "' is missing",
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ErrorResponse> handleMissingRequestHeader(
            MissingRequestHeaderException ex,
            HttpServletRequest request) {

        log.warn("Missing request header at '{}': header='{}'", request.getRequestURI(), ex.getHeaderName());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Required request header '" + ex.getHeaderName() + "' is missing",
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorResponse> handleMultipartException(
            MultipartException ex,
            HttpServletRequest request) {

        log.warn("Multipart request failure at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Required multipart file part is missing.",
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException ex,
            HttpServletRequest request) {

        log.warn("HTTP method '{}' not supported for URI '{}'", ex.getMethod(), request.getRequestURI());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.METHOD_NOT_ALLOWED.value(),
                HttpStatus.METHOD_NOT_ALLOWED.getReasonPhrase(),
                "Request method '" + ex.getMethod() + "' is not supported for this endpoint",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(response);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(
            HttpMediaTypeNotSupportedException ex,
            HttpServletRequest request) {

        log.warn("HTTP Content-Type '{}' not supported for URI '{}'", ex.getContentType(), request.getRequestURI());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.UNSUPPORTED_MEDIA_TYPE.value(),
                HttpStatus.UNSUPPORTED_MEDIA_TYPE.getReasonPhrase(),
                "Content-Type '" + ex.getContentType() + "' is not supported",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(response);
    }

    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotAcceptable(
            HttpMediaTypeNotAcceptableException ex,
            HttpServletRequest request) {

        log.warn("Acceptable media types cannot be produced for URI '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.NOT_ACCEPTABLE.value(),
                HttpStatus.NOT_ACCEPTABLE.getReasonPhrase(),
                "Could not produce acceptable response format requested by Accept header",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.NOT_ACCEPTABLE).body(response);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(
            NoResourceFoundException ex,
            HttpServletRequest request) {

        log.warn("No static or routed resource found at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.NOT_FOUND.value(),
                HttpStatus.NOT_FOUND.getReasonPhrase(),
                "Requested resource not found: " + request.getRequestURI(),
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {

        List<String> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .toList();
        String message = String.join(", ", errors);

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

    @ExceptionHandler(jakarta.validation.ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(
            jakarta.validation.ConstraintViolationException ex,
            HttpServletRequest request) {

        String violations = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining(", "));

        log.warn("Constraint violation at '{}': {}", request.getRequestURI(), violations);
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                violations,
                request.getRequestURI()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMessageNotReadable(
            org.springframework.http.converter.HttpMessageNotReadableException ex,
            HttpServletRequest request) {

        log.warn("Message not readable at '{}': {}", request.getRequestURI(), ex.getMessage());
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

    @ExceptionHandler(java.time.format.DateTimeParseException.class)
    public ResponseEntity<ErrorResponse> handleDateTimeParseException(
            java.time.format.DateTimeParseException ex,
            HttpServletRequest request) {

        log.warn("Invalid date format at '{}': parsedString='{}', errorIndex={}",
                request.getRequestURI(), ex.getParsedString(), ex.getErrorIndex());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Invalid date format: '" + ex.getParsedString() + "'. Expected format: yyyy-MM-dd",
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

    @ExceptionHandler(EmailDeliveryException.class)
    public ResponseEntity<ErrorResponse> handleEmailDeliveryException(
            EmailDeliveryException ex,
            HttpServletRequest request) {

        log.error("Email delivery failed at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                HttpStatus.SERVICE_UNAVAILABLE.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }

    @ExceptionHandler(org.springframework.mail.MailException.class)
    public ResponseEntity<ErrorResponse> handleMailException(
            org.springframework.mail.MailException ex,
            HttpServletRequest request) {

        log.error("Mail service error at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                HttpStatus.SERVICE_UNAVAILABLE.getReasonPhrase(),
                "Email delivery service is currently unavailable: " + ex.getMessage(),
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }

    @ExceptionHandler(org.springframework.web.context.request.async.AsyncRequestTimeoutException.class)
    public ResponseEntity<ErrorResponse> handleAsyncTimeout(
            org.springframework.web.context.request.async.AsyncRequestTimeoutException ex,
            HttpServletRequest request) {

        log.warn("Async request timeout at '{}': {}", request.getRequestURI(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                HttpStatus.SERVICE_UNAVAILABLE.getReasonPhrase(),
                "Request processing timed out. Please try again.",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(
            Exception ex,
            HttpServletRequest request) {

        Exception dbCause = findDatabaseUnavailableCause(ex);
        if (dbCause != null) {
            return handleDatabaseUnavailable(dbCause, request);
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

    private Exception findDatabaseUnavailableCause(Throwable throwable) {
        Throwable current = throwable != null ? throwable.getCause() : null;
        while (current != null) {
            if (current instanceof org.springframework.dao.DataAccessException
                    || current instanceof org.springframework.transaction.CannotCreateTransactionException
                    || current instanceof org.hibernate.exception.JDBCConnectionException
                    || current instanceof java.sql.SQLException
                    || current instanceof DatabaseUnavailableException) {
                return (Exception) current;
            }
            current = current.getCause();
        }
        return null;
    }
}
