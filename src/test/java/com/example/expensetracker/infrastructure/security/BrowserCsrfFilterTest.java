package com.example.expensetracker.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class BrowserCsrfFilterTest {

    private BrowserSessionCookieService cookieService;
    private BrowserCsrfFilter filter;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        cookieService = mock(BrowserSessionCookieService.class);
        filter = new BrowserCsrfFilter(cookieService);
        chain = mock(FilterChain.class);
    }

    @Test
    void blocksUnsafeCookieRequestWhenCsrfValidationFails() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/expenses/user/1");
        req.setCookies(new Cookie(BrowserSessionCookieService.SESSION_COOKIE, "session-jwt"));
        MockHttpServletResponse res = new MockHttpServletResponse();

        when(cookieService.isCsrfTokenValid("session-jwt", null, null)).thenReturn(false);

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(403);
        verifyNoInteractions(chain);
    }

    @Test
    void allowsUnsafeCookieRequestWithValidDoubleSubmitCsrfToken() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/expenses/user/1");
        req.setCookies(
                new Cookie(BrowserSessionCookieService.SESSION_COOKIE, "session-jwt"),
                new Cookie(BrowserSessionCookieService.CSRF_COOKIE, "csrf-secret"));
        req.addHeader(BrowserSessionCookieService.CSRF_HEADER, "csrf-secret");
        MockHttpServletResponse res = new MockHttpServletResponse();

        when(cookieService.isCsrfTokenValid("session-jwt", "csrf-secret", "csrf-secret")).thenReturn(true);

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(200);
        verify(chain).doFilter(req, res);
    }

    @Test
    void exemptsPublicAuthAndWebAuthnLoginOrRecoveryEntrypointsEvenWithStaleSessionCookie() throws Exception {
        for (String path : new String[]{
                "/api/auth/login",
                "/api/auth/register",
                "/api/auth/reset-password",
                "/api/webauthn/login/finish",
                "/api/webauthn/recovery/finish"}) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", path);
            req.setCookies(new Cookie(BrowserSessionCookieService.SESSION_COOKIE, "stale-session-jwt"));
            MockHttpServletResponse res = new MockHttpServletResponse();

            filter.doFilter(req, res, chain);
            assertThat(res.getStatus()).isEqualTo(200);
        }
        verify(chain, times(5)).doFilter(any(), any());
        verifyNoInteractions(cookieService);
    }

    @Test
    void skipsCsrfCheckForBearerTokenAndSafeGetRequests() throws Exception {
        MockHttpServletRequest bearerReq = new MockHttpServletRequest("POST", "/api/expenses/user/1");
        bearerReq.addHeader("Authorization", "Bearer api-jwt");
        bearerReq.setCookies(new Cookie(BrowserSessionCookieService.SESSION_COOKIE, "session-jwt"));
        MockHttpServletResponse bearerRes = new MockHttpServletResponse();

        filter.doFilter(bearerReq, bearerRes, chain);

        MockHttpServletRequest getReq = new MockHttpServletRequest("GET", "/api/expenses/user/1");
        getReq.setCookies(new Cookie(BrowserSessionCookieService.SESSION_COOKIE, "session-jwt"));
        MockHttpServletResponse getRes = new MockHttpServletResponse();

        filter.doFilter(getReq, getRes, chain);

        verify(chain, times(2)).doFilter(any(), any());
        verifyNoInteractions(cookieService);
    }
}
