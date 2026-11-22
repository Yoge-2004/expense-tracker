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

/** Validates unsafe browser-cookie requests; bearer-only API clients are unaffected. */
@Component
@RequiredArgsConstructor
public class BrowserCsrfFilter extends OncePerRequestFilter {
    private final BrowserSessionCookieService browserSessionCookieService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        boolean bearerRequest = authorization != null && authorization.startsWith("Bearer ");
        String sessionToken = cookieValue(request, BrowserSessionCookieService.SESSION_COOKIE);

        if (!bearerRequest && sessionToken != null && isUnsafeMethod(request.getMethod())
                && !browserSessionCookieService.isCsrfTokenValid(
                        sessionToken,
                        request.getHeader(BrowserSessionCookieService.CSRF_HEADER),
                        cookieValue(request, BrowserSessionCookieService.CSRF_COOKIE))) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Browser request failed CSRF validation");
            return;
        }
        filterChain.doFilter(request, response);
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
