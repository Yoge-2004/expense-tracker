package com.example.expensetracker.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.time.format.DateTimeParseException;
import java.util.NoSuchElementException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final HttpServletRequest request = request("/api/test");

    @Test
    void dateTimeParseExceptionMapsToBadRequestWithDescriptiveMessage() {
        var ex = new DateTimeParseException("Text 'bad-date' could not be parsed", "bad-date", 0);
        var response = handler.handleDateTimeParseException(ex, request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(400, response.getBody().status());
        assertEquals("Invalid date format: 'bad-date'. Expected format: yyyy-MM-dd", response.getBody().message());
        assertEquals("/api/test", response.getBody().path());
    }

    @Test
    void illegalArgumentMapsToBadRequestWithMessageAndPath() {
        ResponseEntity<com.example.expensetracker.dto.ErrorResponse> response =
                handler.handleIllegalArgument(new IllegalArgumentException("Invalid value"), request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(400, response.getBody().status());
        assertEquals("Invalid value", response.getBody().message());
        assertEquals("/api/test", response.getBody().path());
        assertNotNull(response.getBody().timestamp());
    }

    @Test
    void illegalStateMapsToConflict() {
        var response = handler.handleIllegalState(new IllegalStateException("Already exists"), request);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(409, response.getBody().status());
        assertEquals("Conflict", response.getBody().error());
        assertEquals("Already exists", response.getBody().message());
    }

    @Test
    void notFoundMapsToNotFound() {
        var response = handler.handleNotFound(new NoSuchElementException("Missing resource"), request);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(404, response.getBody().status());
        assertEquals("Missing resource", response.getBody().message());
    }

    @Test
    void authenticationBadCredentialsUsesGenericSafeMessage() {
        var response = handler.handleAuthenticationException(new BadCredentialsException("Bad credentials"), request);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(401, response.getBody().status());
        assertEquals("Authentication Failed", response.getBody().error());
        assertEquals("Invalid email/username or password", response.getBody().message());
    }

    @Test
    void authenticationFailurePreservesNonSensitiveMessage() {
        var response = handler.handleAuthenticationException(new BadCredentialsException("Account is disabled"), request);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Account is disabled", response.getBody().message());
    }

    @Test
    void databaseFailureReturnsServiceUnavailableWithoutLeakingDatabaseDetails() {
        var databaseFailure = new DataAccessResourceFailureException("jdbc:postgresql://secret-host:5432/expenses password=secret");

        var response = handler.handleDatabaseUnavailable(databaseFailure, request);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(503, response.getBody().status());
        assertEquals("Unable to connect to the server. Please try again in a few moments.", response.getBody().message());
        assertFalse(response.getBody().message().contains("secret-host"));
        assertFalse(response.getBody().message().contains("password"));
    }

    @Test
    void rateLimitIncludesRetryAfterHeader() {
        var ex = new RateLimitExceededException("Too many requests", 30);
        var response = handler.handleRateLimitExceeded(ex, request);

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("30", response.getHeaders().getFirst("Retry-After"));
        assertNotNull(response.getBody());
        assertEquals(429, response.getBody().status());
        assertEquals("Too many requests", response.getBody().message());
    }

    @Test
    void missingMultipartPartMapsToBadRequestWithoutExposingPartName() {
        var ex = new MissingServletRequestPartException("file");

        var response = handler.handleMissingMultipartPart(ex, request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(400, response.getBody().status());
        assertEquals("Required multipart file part is missing.", response.getBody().message());
    }

    @Test
    void genericUnexpectedFailureUsesSafeMessage() {
        var response = handler.handleGeneric(new RuntimeException("internal secret details"), request);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(500, response.getBody().status());
        assertEquals("Unexpected error occurred", response.getBody().message());
        assertFalse(response.getBody().message().contains("internal secret details"));
    }

    @Test
    void accessDeniedReturnsForbidden() {
        var response = handler.handleAccessDenied(new AccessDeniedException("insufficient permission"), request);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(403, response.getBody().status());
        assertEquals("Access is denied: insufficient permission", response.getBody().message());
    }

    @Test
    void oversizedUploadReturnsContentTooLarge() {
        var response = handler.handleMaxUploadSize(new MaxUploadSizeExceededException(4096), request);

        assertEquals(HttpStatus.CONTENT_TOO_LARGE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(413, response.getBody().status());
        assertEquals("Uploaded file exceeds maximum allowed size limit.", response.getBody().message());
    }

    @Test
    void malformedJsonReturnsSafeBadRequestMessage() {
        var response = handler.handleMessageNotReadable(
                new org.springframework.http.converter.HttpMessageNotReadableException("malformed json", null), request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(400, response.getBody().status());
        assertEquals("Malformed JSON request body.", response.getBody().message());
    }

    @Test
    void typeMismatchReturnsGenericBadRequestMessage() {
        var ex = mock(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class);
        when(ex.getName()).thenReturn("userId");
        when(ex.getValue()).thenReturn("not-a-number");

        var response = handler.handleTypeMismatch(ex, request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Invalid parameter value.", response.getBody().message());
    }

    @Test
    void databaseCauseInsideAuthenticationExceptionIsMappedToServiceUnavailable() {
        var databaseFailure = new DataAccessResourceFailureException("database offline");
        var authFailure = new BadCredentialsException("Authentication failed", databaseFailure);

        var response = handler.handleAuthenticationException(authFailure, request);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(503, response.getBody().status());
        assertEquals("Unable to connect to the server. Please try again in a few moments.", response.getBody().message());
    }

    @Test
    void responseAlwaysIncludesRequestPath() {
        HttpServletRequest otherRequest = request("/api/auth/login");

        var response = handler.handleGeneric(new RuntimeException("boom"), otherRequest);

        assertNotNull(response.getBody());
        assertEquals("/api/auth/login", response.getBody().path());
    }

    private static HttpServletRequest request(String uri) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn(uri);
        return request;
    }
}
