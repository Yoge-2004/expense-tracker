package com.example.expensetracker.security;

import com.example.expensetracker.dto.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

class RestSecurityHandlersTest {

    private RestAuthenticationEntryPoint entryPoint;
    private RestAccessDeniedHandler accessDeniedHandler;
    private ObjectMapper objectMapper;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        entryPoint = new RestAuthenticationEntryPoint();
        accessDeniedHandler = new RestAccessDeniedHandler();
        objectMapper = new ObjectMapper().registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    @Test
    @DisplayName("RestAuthenticationEntryPoint writes 401 JSON ErrorResponse")
    void commence_returns401JsonErrorResponse() throws IOException {
        request.setRequestURI("/api/expenses/user/1");
        BadCredentialsException authEx = new BadCredentialsException("Bad credentials");

        entryPoint.commence(request, response, authEx);

        assertEquals(401, response.getStatus());
        assertEquals(MediaType.APPLICATION_JSON_VALUE, response.getContentType());

        ErrorResponse errorResponse = objectMapper.readValue(response.getContentAsString(), ErrorResponse.class);
        assertEquals(401, errorResponse.status());
        assertEquals("Unauthorized", errorResponse.error());
        assertEquals("/api/expenses/user/1", errorResponse.path());
        assertNotNull(errorResponse.timestamp());
    }

    @Test
    @DisplayName("RestAccessDeniedHandler writes 403 JSON ErrorResponse")
    void handle_returns403JsonErrorResponse() throws IOException {
        request.setRequestURI("/api/users/99/profile");
        AccessDeniedException accessDenied = new AccessDeniedException("Access denied.");

        accessDeniedHandler.handle(request, response, accessDenied);

        assertEquals(403, response.getStatus());
        assertEquals(MediaType.APPLICATION_JSON_VALUE, response.getContentType());

        ErrorResponse errorResponse = objectMapper.readValue(response.getContentAsString(), ErrorResponse.class);
        assertEquals(403, errorResponse.status());
        assertEquals("Forbidden", errorResponse.error());
        assertEquals("/api/users/99/profile", errorResponse.path());
        assertNotNull(errorResponse.timestamp());
    }
}
