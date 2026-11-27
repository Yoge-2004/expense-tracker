package com.example.expensetracker.infrastructure.exception;

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

import com.example.expensetracker.common.ErrorResponse;



/**
 * Global exception handler for the Expense Tracker REST API.
 *
 * <p>Centralises error handling across all controllers using Spring's
 * {@code @RestControllerAdvice}. Each handler method intercepts a specific
 * exception type, wraps it in a standardised {@link ErrorResponse}, and returns
 * an appropriate HTTP status code to the client.</p>
 *
 * @author Yogeshwaran
 * @version 1.1
 * @see ErrorResponse
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(
            IllegalArgumentException ex,
            HttpServletRequest request) {
        if (ex.getCause() != null) {
            log.warn("Bad request at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        } else {
            log.warn("Bad request at '{}': {}", request.getRequestURI(), ex.getMessage());
        }
        return buildResponse(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(
            BadRequestException ex,
            HttpServletRequest request) {
        if (ex.getCause() != null) {
            log.warn("Bad request exception at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        } else {
            log.warn("Bad request exception at '{}': {}", request.getRequestURI(), ex.getMessage());
        }
        return buildResponse(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(
            IllegalStateException ex,
            HttpServletRequest request) {
        if (ex.getCause() != null) {
            log.error("Conflict / Illegal state at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        } else {
            log.warn("Conflict at '{}': {}", request.getRequestURI(), ex.getMessage());
        }
        return buildResponse(HttpStatus.CONFLICT, ex.getMessage(), request);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(
            ConflictException ex,
            HttpServletRequest request) {
        if (ex.getCause() != null) {
            log.error("Conflict exception at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        } else {
            log.warn("Conflict exception at '{}': {}", request.getRequestURI(), ex.getMessage());
        }
        return buildResponse(HttpStatus.CONFLICT, ex.getMessage(), request);
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(
            NoSuchElementException ex,
            HttpServletRequest request) {
        log.warn("Resource not found at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage(), request);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(
            ResourceNotFoundException ex,
            HttpServletRequest request) {
        log.warn("Resource not found exception at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage(), request);
    }

    @ExceptionHandler(jakarta.persistence.EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleEntityNotFound(
            jakarta.persistence.EntityNotFoundException ex,
            HttpServletRequest request) {
        log.warn("Entity not found at '{}': {}", request.getRequestURI(), ex.getMessage());
        String message = ex.getMessage() != null && !ex.getMessage().isBlank()
                ? ex.getMessage() : "Requested entity not found";
        return buildResponse(HttpStatus.NOT_FOUND, message, request);
    }

    @ExceptionHandler(org.springframework.dao.EmptyResultDataAccessException.class)
    public ResponseEntity<ErrorResponse> handleEmptyResultDataAccess(
            org.springframework.dao.EmptyResultDataAccessException ex,
            HttpServletRequest request) {
        log.warn("Empty result data access at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.NOT_FOUND, "Requested resource was not found.", request);
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(
            org.springframework.dao.DataIntegrityViolationException ex,
            HttpServletRequest request) {
        String message = "A record with these details already exists.";
        Throwable root = ex.getMostSpecificCause();
        if (root.getMessage() != null) {
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
        return buildResponse(HttpStatus.CONFLICT, message, request);
    }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(
            org.springframework.web.server.ResponseStatusException ex,
            HttpServletRequest request) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        String reason = ex.getReason() != null ? ex.getReason() : status.getReasonPhrase();
        if (status.is5xxServerError()) {
            log.error("ResponseStatusException ({}) at '{}': {}", status.value(), request.getRequestURI(), reason, ex);
        } else {
            log.warn("ResponseStatusException ({}) at '{}': {}", status.value(), request.getRequestURI(), reason);
        }
        return buildResponse(status, reason, request);
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
        log.error("Database connection failure at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        return buildResponse(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Unable to connect to the server. Please try again in a few moments.",
                request
        );
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
        return buildResponse(HttpStatus.UNAUTHORIZED, "Authentication Failed", msg, request);
    }

    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ErrorResponse> handleRateLimitExceeded(
            RateLimitExceededException ex,
            HttpServletRequest request) {
        log.warn("Rate limit exceeded at '{}': {}", request.getRequestURI(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(ex.getRetryAfterSeconds()))
                .body(new ErrorResponse(
                        LocalDateTime.now(),
                        HttpStatus.TOO_MANY_REQUESTS.value(),
                        HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
                        ex.getMessage(),
                        request.getRequestURI()
                ));
    }

    @ExceptionHandler(org.springframework.web.multipart.support.MissingServletRequestPartException.class)
    public ResponseEntity<ErrorResponse> handleMissingMultipartPart(
            org.springframework.web.multipart.support.MissingServletRequestPartException ex,
            HttpServletRequest request) {
        log.warn("Missing multipart request part at '{}': part='{}'", request.getRequestURI(), ex.getRequestPartName());
        return buildResponse(HttpStatus.BAD_REQUEST, "Required multipart file part is missing.", request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingRequestParameter(
            MissingServletRequestParameterException ex,
            HttpServletRequest request) {
        log.warn("Missing request parameter at '{}': parameter='{}'", request.getRequestURI(), ex.getParameterName());
        return buildResponse(HttpStatus.BAD_REQUEST, "Required request parameter '" + ex.getParameterName() + "' is missing", request);
    }

    @ExceptionHandler(MissingPathVariableException.class)
    public ResponseEntity<ErrorResponse> handleMissingPathVariable(
            MissingPathVariableException ex,
            HttpServletRequest request) {
        log.warn("Missing path variable at '{}': variable='{}'", request.getRequestURI(), ex.getVariableName());
        return buildResponse(HttpStatus.BAD_REQUEST, "Required path variable '" + ex.getVariableName() + "' is missing", request);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ErrorResponse> handleMissingRequestHeader(
            MissingRequestHeaderException ex,
            HttpServletRequest request) {
        log.warn("Missing request header at '{}': header='{}'", request.getRequestURI(), ex.getHeaderName());
        return buildResponse(HttpStatus.BAD_REQUEST, "Required request header '" + ex.getHeaderName() + "' is missing", request);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorResponse> handleMultipartException(
            MultipartException ex,
            HttpServletRequest request) {
        log.warn("Multipart request failure at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.BAD_REQUEST, "Required multipart file part is missing.", request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException ex,
            HttpServletRequest request) {
        log.warn("HTTP method '{}' not supported for URI '{}'", ex.getMethod(), request.getRequestURI());
        return buildResponse(HttpStatus.METHOD_NOT_ALLOWED, "Request method '" + ex.getMethod() + "' is not supported for this endpoint", request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(
            HttpMediaTypeNotSupportedException ex,
            HttpServletRequest request) {
        log.warn("HTTP Content-Type '{}' not supported for URI '{}'", ex.getContentType(), request.getRequestURI());
        return buildResponse(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Content-Type '" + ex.getContentType() + "' is not supported", request);
    }

    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotAcceptable(
            HttpMediaTypeNotAcceptableException ex,
            HttpServletRequest request) {
        log.warn("Acceptable media types cannot be produced for URI '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.NOT_ACCEPTABLE, "Could not produce acceptable response format requested by Accept header", request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(
            NoResourceFoundException ex,
            HttpServletRequest request) {
        log.warn("No static or routed resource found at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.NOT_FOUND, "Requested resource not found: " + request.getRequestURI(), request);
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
        return buildResponse(HttpStatus.BAD_REQUEST, message, request);
    }

    @ExceptionHandler(jakarta.validation.ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(
            jakarta.validation.ConstraintViolationException ex,
            HttpServletRequest request) {
        String violations = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining(", "));
        log.warn("Constraint violation at '{}': {}", request.getRequestURI(), violations);
        return buildResponse(HttpStatus.BAD_REQUEST, violations, request);
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMessageNotReadable(
            org.springframework.http.converter.HttpMessageNotReadableException ex,
            HttpServletRequest request) {
        Throwable root = ex.getMostSpecificCause();
        String detail = (root.getMessage() != null) ? root.getMessage().split("\r?\n")[0].trim() : ex.getMessage();
        log.warn("Message not readable at '{}': {}", request.getRequestURI(), detail);
        return buildResponse(HttpStatus.BAD_REQUEST, "Malformed JSON request body.", request);
    }

    @ExceptionHandler(org.springframework.transaction.TransactionSystemException.class)
    public ResponseEntity<ErrorResponse> handleTransactionSystemException(
            org.springframework.transaction.TransactionSystemException ex,
            HttpServletRequest request) {
        Throwable root = ex.getRootCause();
        if (root instanceof jakarta.validation.ConstraintViolationException cve) {
            return handleConstraintViolation(cve, request);
        }
        log.error("Transaction failure at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "A transaction commit failure occurred", request);
    }

    @ExceptionHandler({
            org.springframework.dao.OptimisticLockingFailureException.class,
            jakarta.persistence.OptimisticLockException.class
    })
    public ResponseEntity<ErrorResponse> handleOptimisticLock(
            Exception ex,
            HttpServletRequest request) {
        log.warn("Optimistic lock conflict at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(
                HttpStatus.CONFLICT,
                "The resource was modified by another operation. Please reload and try again.",
                request
        );
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex,
            HttpServletRequest request) {
        log.warn("Type mismatch at '{}': parameter '{}' with value '{}'",
                request.getRequestURI(), ex.getName(), ex.getValue());
        return buildResponse(HttpStatus.BAD_REQUEST, "Invalid parameter value.", request);
    }

    @ExceptionHandler(java.time.format.DateTimeParseException.class)
    public ResponseEntity<ErrorResponse> handleDateTimeParseException(
            java.time.format.DateTimeParseException ex,
            HttpServletRequest request) {
        String rawInput = ex.getParsedString() != null ? ex.getParsedString() : "";
        String sanitized = rawInput.replaceAll("[\\r\\n\\p{Cntrl}]", "");
        if (sanitized.length() > 64) {
            sanitized = sanitized.substring(0, 64) + "...";
        }
        log.warn("Invalid date format at '{}': parsedString='{}', errorIndex={}",
                request.getRequestURI(), sanitized, ex.getErrorIndex());
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "Invalid date format: '" + sanitized + "'. Expected format: yyyy-MM-dd",
                request
        );
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(
            ForbiddenException ex,
            HttpServletRequest request) {
        log.warn("Forbidden at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.FORBIDDEN, ex.getMessage(), request);
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(
            org.springframework.security.access.AccessDeniedException ex,
            HttpServletRequest request) {
        log.warn("Access denied at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.FORBIDDEN, "Access is denied: " + ex.getMessage(), request);
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(
            org.springframework.web.multipart.MaxUploadSizeExceededException ex,
            HttpServletRequest request) {
        log.warn("Max upload size exceeded at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.CONTENT_TOO_LARGE, "Uploaded file exceeds maximum allowed size limit.", request);
    }

    @ExceptionHandler(EmailDeliveryException.class)
    public ResponseEntity<ErrorResponse> handleEmailDeliveryException(
            EmailDeliveryException ex,
            HttpServletRequest request) {
        log.error("Email delivery failed at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        return buildResponse(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage(), request);
    }

    @ExceptionHandler(org.springframework.mail.MailException.class)
    public ResponseEntity<ErrorResponse> handleMailException(
            org.springframework.mail.MailException ex,
            HttpServletRequest request) {
        log.error("Mail service error at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        return buildResponse(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Email delivery service is currently unavailable.",
                request
        );
    }

    @ExceptionHandler(org.springframework.web.context.request.async.AsyncRequestTimeoutException.class)
    public ResponseEntity<ErrorResponse> handleAsyncTimeout(
            org.springframework.web.context.request.async.AsyncRequestTimeoutException ex,
            HttpServletRequest request) {
        log.warn("Async request timeout at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.SERVICE_UNAVAILABLE, "Request processing timed out. Please try again.", request);
    }

    @ExceptionHandler(ImportException.class)
    public ResponseEntity<ErrorResponse> handleImportException(
            ImportException ex,
            HttpServletRequest request) {
        log.warn("Import failure at '{}': {}", request.getRequestURI(), ex.getMessage());
        return buildResponse(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    @ExceptionHandler(ExportException.class)
    public ResponseEntity<ErrorResponse> handleExportException(
            ExportException ex,
            HttpServletRequest request) {
        log.error("Export generation error at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage(), request);
    }

    @ExceptionHandler(FileStorageException.class)
    public ResponseEntity<ErrorResponse> handleFileStorageException(
            FileStorageException ex,
            HttpServletRequest request) {
        log.error("File storage error at '{}': {}", request.getRequestURI(), ex.getMessage(), ex);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage(), request);
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
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected error occurred", request);
    }

    private ResponseEntity<ErrorResponse> buildResponse(
            HttpStatus status,
            String message,
            HttpServletRequest request) {
        return buildResponse(status, status.getReasonPhrase(), message, request);
    }

    private ResponseEntity<ErrorResponse> buildResponse(
            HttpStatus status,
            String errorPhrase,
            String message,
            HttpServletRequest request) {
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now(),
                status.value(),
                errorPhrase != null ? errorPhrase : status.getReasonPhrase(),
                message,
                request.getRequestURI()
        );
        return ResponseEntity.status(status).body(response);
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
