package com.example.expensetracker.security;

import com.example.expensetracker.exception.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.jspecify.annotations.NonNull;
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
@Slf4j
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RateLimiterService rateLimiterService;

    @Value("${app.trusted-proxy.enabled:false}")
    private boolean trustedProxyEnabled;

    @Value("${app.trusted-proxy.cidrs:127.0.0.1/32,::1/128}")
    private String trustedProxyCidrs;

    public RateLimitInterceptor(@Autowired(required = false) RateLimiterService rateLimiterService) {
        this.rateLimiterService = rateLimiterService;
    }

    @Override
    public boolean preHandle(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull Object handler) {
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

    /**
     * Resolves the client IP for rate-limit keying.
     * <p>
     * SECURITY FIX (original): previously this method trusted the {@code X-Forwarded-For} and
     * {@code X-Real-IP} headers directly. A malicious client could rotate these
     * values per request to bypass every {@link RateLimited} endpoint (login, OTP,
     * register, password reset, PIN verification). Since there was no trusted-proxy
     * allowlist at the time, it was changed to use only the socket-level
     * {@code request.getRemoteAddr()}.
     * </p>
     * <p>
     * FOLLOW-UP FIX: that alone breaks rate limiting once the app runs behind a
     * reverse proxy on the same host — e.g. the {@code docker/nginx.conf} deployment,
     * where Spring Boot binds to {@code 127.0.0.1:8080} and is only ever reached via
     * nginx. In that topology {@code remoteAddr} is <em>always</em> nginx's loopback
     * address for every request, regardless of which real-world client made it, so
     * every user collapsed into one shared rate-limit bucket (one bad actor could
     * exhaust the login rate limit for everyone at once, and distributed brute-force
     * attempts were throttled as if from a single source).
     * </p>
     * <p>
     * Now {@code X-Forwarded-For}/{@code X-Real-IP} is trusted only when the immediate
     * connection ({@code remoteAddr}) comes from an address in {@code
     * app.trusted-proxy.cidrs} <em>and</em> {@code app.trusted-proxy.enabled=true} —
     * both default to the safe "don't trust anything" behavior above unless explicitly
     * configured. The nginx deployment enables this (see {@code docker/supervisord.conf})
     * scoped to nginx's own loopback address, which is the only thing that can ever
     * connect to the Spring Boot process in that topology.
     * </p>
     */
    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (!trustedProxyEnabled || !isFromTrustedProxy(remoteAddr)) {
            return remoteAddr;
        }

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded == null || forwarded.isBlank()) {
            forwarded = request.getHeader("X-Real-IP");
        }
        if (forwarded == null || forwarded.isBlank()) {
            return remoteAddr;
        }

        // X-Forwarded-For may be a comma-separated chain; nginx's
        // $proxy_add_x_forwarded_for appends the immediate client to any
        // existing chain, so the leftmost entry is the original client.
        String clientIp = forwarded.split(",")[0].trim();
        return clientIp.isEmpty() ? remoteAddr : clientIp;
    }

    private boolean isFromTrustedProxy(String remoteAddr) {
        if (remoteAddr == null || remoteAddr.isBlank() || trustedProxyCidrs == null) {
            return false;
        }
        for (String cidr : trustedProxyCidrs.split(",")) {
            cidr = cidr.trim();
            if (!cidr.isEmpty() && isInCidr(remoteAddr, cidr)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks whether {@code ipStr} falls within {@code cidr} (e.g. {@code 10.0.0.0/8}).
     * Handles both IPv4 and IPv6; a family mismatch (IPv4 address against an IPv6
     * range or vice versa) never matches. {@code InetAddress.getByName} on a literal
     * IP address parses it directly with no DNS lookup / network I/O.
     */
    private boolean isInCidr(String ipStr, String cidr) {
        try {
            String[] parts = cidr.split("/", 2);
            java.net.InetAddress target = java.net.InetAddress.getByName(ipStr);
            java.net.InetAddress network = java.net.InetAddress.getByName(parts[0]);
            byte[] targetBytes = target.getAddress();
            byte[] networkBytes = network.getAddress();
            if (targetBytes.length != networkBytes.length) {
                return false;
            }
            int prefixLength = parts.length > 1 ? Integer.parseInt(parts[1]) : targetBytes.length * 8;
            int fullBytes = prefixLength / 8;
            int remainingBits = prefixLength % 8;
            for (int i = 0; i < fullBytes; i++) {
                if (targetBytes[i] != networkBytes[i]) {
                    return false;
                }
            }
            if (remainingBits > 0) {
                int mask = (0xFF << (8 - remainingBits)) & 0xFF;
                if ((targetBytes[fullBytes] & mask) != (networkBytes[fullBytes] & mask)) {
                    return false;
                }
            }
            return true;
        } catch (java.net.UnknownHostException | NumberFormatException | ArrayIndexOutOfBoundsException e) {
            return false;
        }
    }
}
