package com.example.expensetracker.security;

import com.example.expensetracker.dto.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDateTime;

/**
 * Handles requests that Spring Security's filter chain rejects as unauthenticated
 * (missing/invalid JWT) before they ever reach a controller — meaning
 * {@link com.example.expensetracker.exception.GlobalExceptionHandler} never sees
 * them. Without this, Spring Security's default behaviour returns an empty body
 * (or, with httpBasic previously enabled, a WWW-Authenticate challenge that could
 * trigger the browser's native login prompt on a plain navigation). This ensures
 * every 401 the API returns has the same JSON {@link ErrorResponse} shape the
 * rest of the app uses, so the frontend never has to guess at a message.
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public RestAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                          AuthenticationException authException) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        ErrorResponse body = new ErrorResponse(
                LocalDateTime.now(),
                HttpServletResponse.SC_UNAUTHORIZED,
                "Unauthorized",
                "Authentication is required to access this resource. Please sign in again.",
                request.getRequestURI()
        );
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
