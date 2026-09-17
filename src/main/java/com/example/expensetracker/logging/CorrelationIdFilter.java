package com.example.expensetracker.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Production-ready HTTP request filter that establishes a unique correlation / trace ID
 * and populates the SLF4J Mapped Diagnostic Context (MDC) for every request.
 *
 * <p>Key capabilities:
 * <ul>
 *   <li>Generates or propagates {@code X-Request-Id} / {@code X-Correlation-Id} across threads.</li>
 *   <li>Appends {@code X-Request-Id} header to HTTP responses for client-side tracing.</li>
 *   <li>Populates MDC keys: {@code traceId}, {@code clientIp}, {@code method}, {@code uri}.</li>
 *   <li>Monitors request duration and logs structured completion summaries.</li>
 *   <li>Detects and alerts on slow requests exceeding 1,000ms.</li>
 *   <li>Guarantees {@code MDC.clear()} execution to prevent context leakage across virtual/worker threads.</li>
 * </ul>
 * </p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(CorrelationIdFilter.class);

    public static final String TRACE_ID_MDC_KEY = "traceId";
    public static final String CLIENT_IP_MDC_KEY = "clientIp";
    public static final String METHOD_MDC_KEY = "method";
    public static final String URI_MDC_KEY = "uri";
    public static final String USER_MDC_KEY = "userEmail";

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";

    private static final long SLOW_REQUEST_THRESHOLD_MS = 1000L;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String traceId = resolveTraceId(request);
        String clientIp = resolveClientIp(request);
        String method = request.getMethod();
        String uri = request.getRequestURI();

        MDC.put(TRACE_ID_MDC_KEY, traceId);
        MDC.put(CLIENT_IP_MDC_KEY, clientIp);
        MDC.put(METHOD_MDC_KEY, method);
        MDC.put(URI_MDC_KEY, uri);

        response.setHeader(REQUEST_ID_HEADER, traceId);

        long startTime = System.currentTimeMillis();
        boolean isApiRequest = uri.startsWith("/api");

        if (isApiRequest && log.isDebugEnabled()) {
            String queryString = request.getQueryString();
            log.debug("Incoming HTTP {} {} (clientIp={}, params={})",
                    method, uri, clientIp, queryString != null ? queryString : "none");
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = System.currentTimeMillis() - startTime;
            int status = response.getStatus();

            if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
                log.warn("Slow HTTP request detected: {} {} completed with status {} in {}ms",
                        method, uri, status, durationMs);
            } else if (isApiRequest) {
                if (status >= 500) {
                    log.error("HTTP {} {} failed with status {} in {}ms", method, uri, status, durationMs);
                } else if (status >= 400) {
                    log.warn("HTTP {} {} completed with status {} in {}ms", method, uri, status, durationMs);
                } else {
                    log.info("HTTP {} {} completed with status {} in {}ms", method, uri, status, durationMs);
                }
            }

            MDC.clear();
        }
    }

    private String resolveTraceId(HttpServletRequest request) {
        String reqId = request.getHeader(REQUEST_ID_HEADER);
        if (reqId != null && !reqId.isBlank()) {
            return sanitize(reqId);
        }
        String corrId = request.getHeader(CORRELATION_ID_HEADER);
        if (corrId != null && !corrId.isBlank()) {
            return sanitize(corrId);
        }
        return UUID.randomUUID().toString();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            String[] ips = xForwardedFor.split(",");
            if (ips.length > 0 && !ips[0].trim().equalsIgnoreCase("unknown")) {
                return sanitize(ips[0].trim());
            }
        }
        String remoteAddr = request.getRemoteAddr();
        return remoteAddr != null ? sanitize(remoteAddr) : "unknown";
    }

    private String sanitize(String input) {
        if (input == null) {
            return "";
        }
        // Disallow CRLF or control characters in MDC values to prevent log injection
        return input.replaceAll("[\\r\\n\\t]", "").trim();
    }
}
