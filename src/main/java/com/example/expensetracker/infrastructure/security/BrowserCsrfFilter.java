package com.example.expensetracker.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Validates unsafe browser-cookie requests using double-submit CSRF tokens.
 *
 * <p>Bearer-only API clients and unauthenticated login/registration/recovery endpoints are exempted
 * so a stale {@code ET_SESSION} cookie from an expired session does not block signing back in.</p>
 */
@Component
@RequiredArgsConstructor
public class BrowserCsrfFilter extends OncePerRequestFilter {

    private static final Set<String> CSRF_EXEMPT_EXACT_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/oauth/google",
            "/api/auth/signup/send-otp",
            "/api/auth/forgot-password",
            "/api/auth/reset-password"
    );

    private final BrowserSessionCookieService browserSessionCookieService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        boolean bearerRequest = authorization != null && authorization.startsWith("Bearer ");
        String sessionToken = cookieValue(request, BrowserSessionCookieService.SESSION_COOKIE);

        if (!bearerRequest && sessionToken != null && isUnsafeMethod(request.getMethod())
                && !isCsrfExemptAuthEntrypoint(request)
                && !browserSessionCookieService.isCsrfTokenValid(
                        sessionToken,
                        request.getHeader(BrowserSessionCookieService.CSRF_HEADER),
                        cookieValue(request, BrowserSessionCookieService.CSRF_COOKIE))) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Browser request failed CSRF validation");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isCsrfExemptAuthEntrypoint(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null) {
            return false;
        }
        return CSRF_EXEMPT_EXACT_PATHS.contains(uri)
                || uri.startsWith("/api/webauthn/login/")
                || uri.startsWith("/api/webauthn/recovery/");
    }

    private String cookieValue(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    private boolean isUnsafeMethod(String method) {
        return !"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)
                && !"OPTIONS".equalsIgnoreCase(method) && !"TRACE".equalsIgnoreCase(method);
    }
}
