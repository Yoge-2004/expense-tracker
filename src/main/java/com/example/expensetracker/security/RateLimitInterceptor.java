package com.example.expensetracker.security;

import com.example.expensetracker.exception.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;

/**
 * Spring MVC {@link HandlerInterceptor} that inspects incoming requests targeted at
 * {@link RateLimited} controller actions and enforces rate limits.
 *
 * <p>Sets {@code X-RateLimit-Limit} and {@code X-RateLimit-Remaining} headers on permitted
 * requests, and throws {@link RateLimitExceededException} (mapping to HTTP 429) when
 * thresholds are breached.</p>
 *
 * @author Yogeshwaran
 */
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(RateLimitInterceptor.class);

    private final RateLimiterService rateLimiterService;

    public RateLimitInterceptor(@Autowired(required = false) RateLimiterService rateLimiterService) {
        this.rateLimiterService = rateLimiterService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        RateLimited rateLimited = handlerMethod.getMethodAnnotation(RateLimited.class);
        if (rateLimited == null) {
            rateLimited = handlerMethod.getBeanType().getAnnotation(RateLimited.class);
        }

        if (rateLimited == null || rateLimiterService == null || !rateLimiterService.isEnabled()) {
            return true;
        }

        String clientIp = resolveClientIp(request);
        String actionKey = rateLimited.key().isBlank() ? handlerMethod.getMethod().getName() : rateLimited.key();

        StringBuilder keyBuilder = new StringBuilder("rate_limit:").append(actionKey).append(':').append(clientIp);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof CustomUserDetails cud) {
            keyBuilder.append(":user:").append(cud.getUser().getId());
        }

        String key = keyBuilder.toString();
        int maxRequests = rateLimited.maxRequests();
        Duration window = Duration.ofSeconds(rateLimited.windowSeconds());

        boolean allowed = rateLimiterService.tryAcquire(key, maxRequests, window);
        if (!allowed) {
            long retryAfter = rateLimiterService.getSecondsUntilReset(key, window);
            log.warn("Rate limit breached for key='{}'. Needs wait {}s", key, retryAfter);
            throw new RateLimitExceededException(
                    String.format(rateLimited.message(), retryAfter),
                    retryAfter
            );
        }

        int remaining = rateLimiterService.getRemainingAttempts(key, maxRequests, window);
        response.setHeader("X-RateLimit-Limit", String.valueOf(maxRequests));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));

        return true;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }
}
