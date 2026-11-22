package com.example.expensetracker.infrastructure.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Issues a same-site, HttpOnly browser session without changing mobile bearer-token clients. */
@Component
public class BrowserSessionCookieService {
    public static final String SESSION_COOKIE = "ET_SESSION";
    public static final String CSRF_COOKIE = "ET_CSRF";
    public static final String BROWSER_HEADER = "X-Browser-Session";
    public static final String CSRF_HEADER = "X-XSRF-TOKEN";

    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${jwt.expiration:2592000000}")
    private long jwtExpirationMillis;

    @Value("${app.auth.cookie-secure:true}")
    private boolean secureCookies;

    public boolean isBrowserRequest(HttpServletRequest request) {
        return "1".equals(request.getHeader(BROWSER_HEADER));
    }

    public boolean issueIfBrowser(HttpServletRequest request, HttpServletResponse response, String token) {
        if (!isBrowserRequest(request)) return false;
        issue(request, response, token);
        return true;
    }

    public void issue(HttpServletRequest request, HttpServletResponse response, String token) {
        boolean secure = secureCookies || isSecureRequest(request);
        Duration maxAge = Duration.ofMillis(Math.max(jwtExpirationMillis, 1));
        response.addHeader("Set-Cookie", ResponseCookie.from(SESSION_COOKIE, token)
                .httpOnly(true).secure(secure).sameSite("Lax").path("/api").maxAge(maxAge).build().toString());
        response.addHeader("Set-Cookie", ResponseCookie.from(CSRF_COOKIE, createCsrfToken(token))
                .httpOnly(false).secure(secure).sameSite("Lax").path("/").maxAge(maxAge).build().toString());
    }

    public void clear(HttpServletRequest request, HttpServletResponse response) {
        boolean secure = secureCookies || isSecureRequest(request);
        response.addHeader("Set-Cookie", ResponseCookie.from(SESSION_COOKIE, "")
                .httpOnly(true).secure(secure).sameSite("Lax").path("/api").maxAge(Duration.ZERO).build().toString());
        response.addHeader("Set-Cookie", ResponseCookie.from(CSRF_COOKIE, "")
                .httpOnly(false).secure(secure).sameSite("Lax").path("/").maxAge(Duration.ZERO).build().toString());
    }

    private boolean isSecureRequest(HttpServletRequest request) {
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        if (forwardedProto != null && forwardedProto.equalsIgnoreCase("https")) return true;
        String host = request.getServerName();
        return request.isSecure() || "localhost".equalsIgnoreCase(host)
                || "127.0.0.1".equals(host) || "::1".equals(host);
    }

    public boolean isCsrfTokenValid(String sessionToken, String submittedToken, String cookieToken) {
        if (sessionToken == null || submittedToken == null || cookieToken == null
                || !constantTimeEquals(submittedToken, cookieToken)) return false;
        int separator = cookieToken.indexOf('.');
        if (separator <= 0 || separator == cookieToken.length() - 1) return false;
        String nonce = cookieToken.substring(0, separator);
        String suppliedMac = cookieToken.substring(separator + 1);
        return constantTimeEquals(suppliedMac, csrfMac(sessionToken, nonce));
    }

    private String createCsrfToken(String sessionToken) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        return nonce + "." + csrfMac(sessionToken, nonce);
    }

    private String csrfMac(String sessionToken, String nonce) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(sessionToken.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(nonce.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to generate browser CSRF token", exception);
        }
    }

    private boolean constantTimeEquals(String left, String right) {
        return java.security.MessageDigest.isEqual(
                left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
    }
}
