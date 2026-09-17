package com.example.expensetracker.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CorrelationIdFilterTest {

    @Mock
    private FilterChain filterChain;

    private CorrelationIdFilter filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        filter = new CorrelationIdFilter();
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        MDC.clear();
    }

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    @Test
    @DisplayName("doFilterInternal generates UUID traceId when no header is provided")
    void doFilterInternal_generatesTraceIdWhenMissing() throws ServletException, IOException {
        AtomicReference<String> mdcTraceIdDuringExecution = new AtomicReference<>();

        doAnswer(invocation -> {
            mdcTraceIdDuringExecution.set(MDC.get(CorrelationIdFilter.TRACE_ID_MDC_KEY));
            return null;
        }).when(filterChain).doFilter(any(), any());

        filter.doFilterInternal(request, response, filterChain);

        String capturedMdc = mdcTraceIdDuringExecution.get();
        assertNotNull(capturedMdc);
        assertFalse(capturedMdc.isBlank());

        // Header set on response
        assertEquals(capturedMdc, response.getHeader(CorrelationIdFilter.REQUEST_ID_HEADER));

        // MDC cleared after request completion
        assertNull(MDC.get(CorrelationIdFilter.TRACE_ID_MDC_KEY));
    }

    @Test
    @DisplayName("doFilterInternal propagates incoming X-Request-Id header")
    void doFilterInternal_preservesIncomingRequestId() throws ServletException, IOException {
        String existingTraceId = "req-test-12345";
        request.addHeader(CorrelationIdFilter.REQUEST_ID_HEADER, existingTraceId);

        AtomicReference<String> mdcTraceId = new AtomicReference<>();
        doAnswer(invocation -> {
            mdcTraceId.set(MDC.get(CorrelationIdFilter.TRACE_ID_MDC_KEY));
            return null;
        }).when(filterChain).doFilter(any(), any());

        filter.doFilterInternal(request, response, filterChain);

        assertEquals(existingTraceId, mdcTraceId.get());
        assertEquals(existingTraceId, response.getHeader(CorrelationIdFilter.REQUEST_ID_HEADER));
        assertNull(MDC.get(CorrelationIdFilter.TRACE_ID_MDC_KEY));
    }

    @Test
    @DisplayName("doFilterInternal extracts client IP from X-Forwarded-For header")
    void doFilterInternal_extractsClientIpFromXForwardedFor() throws ServletException, IOException {
        request.addHeader("X-Forwarded-For", "203.0.113.195, 70.41.3.18");

        AtomicReference<String> mdcIp = new AtomicReference<>();
        doAnswer(invocation -> {
            mdcIp.set(MDC.get(CorrelationIdFilter.CLIENT_IP_MDC_KEY));
            return null;
        }).when(filterChain).doFilter(any(), any());

        filter.doFilterInternal(request, response, filterChain);

        assertEquals("203.0.113.195", mdcIp.get());
    }

    @Test
    @DisplayName("doFilterInternal always clears MDC even if filter chain throws exception")
    void doFilterInternal_clearsMdcOnException() throws ServletException, IOException {
        doThrow(new RuntimeException("Simulated error in filter chain"))
                .when(filterChain).doFilter(any(), any());

        assertThrows(RuntimeException.class, () ->
                filter.doFilterInternal(request, response, filterChain)
        );

        assertNull(MDC.get(CorrelationIdFilter.TRACE_ID_MDC_KEY));
        assertNull(MDC.get(CorrelationIdFilter.CLIENT_IP_MDC_KEY));
    }
}
