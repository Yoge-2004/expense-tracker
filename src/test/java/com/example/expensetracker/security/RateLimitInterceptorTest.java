package com.example.expensetracker.security;

import com.example.expensetracker.exception.RateLimitExceededException;
import com.example.expensetracker.model.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Method;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RateLimitInterceptorTest {

    @Mock
    private RateLimiterService rateLimiterService;

    private RateLimitInterceptor interceptor;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    // Test helper controller classes
    static class SampleController {
        @RateLimited(key = "sample-action", maxRequests = 5, windowSeconds = 30)
        public void rateLimitedEndpoint() {}

        public void unrestrictedEndpoint() {}
    }

    private HandlerMethod rateLimitedHandler;
    private HandlerMethod unrestrictedHandler;

    @BeforeEach
    void setUp() throws NoSuchMethodException {
        interceptor = new RateLimitInterceptor(rateLimiterService);
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        request.setRemoteAddr("192.168.1.100");

        SampleController controller = new SampleController();
        Method rateLimitedMethod = SampleController.class.getMethod("rateLimitedEndpoint");
        rateLimitedHandler = new HandlerMethod(controller, rateLimitedMethod);

        Method unrestrictedMethod = SampleController.class.getMethod("unrestrictedEndpoint");
        unrestrictedHandler = new HandlerMethod(controller, unrestrictedMethod);

        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("preHandle returns true immediately for non-HandlerMethod handlers (e.g. static resources)")
    void preHandle_nonHandlerMethod_returnsTrue() {
        boolean result = interceptor.preHandle(request, response, new Object());

        assertTrue(result);
        verifyNoInteractions(rateLimiterService);
    }

    @Test
    @DisplayName("preHandle returns true without rate check when handler has no RateLimited annotation")
    void preHandle_unrestrictedEndpoint_bypassesRateLimit() {
        boolean result = interceptor.preHandle(request, response, unrestrictedHandler);

        assertTrue(result);
        verifyNoInteractions(rateLimiterService);
    }

    @Test
    @DisplayName("preHandle returns true and sets rate-limit headers when acquire succeeds")
    void preHandle_permittedRequest_setsHeadersAndReturnsTrue() {
        when(rateLimiterService.isEnabled()).thenReturn(true);
        when(rateLimiterService.tryAcquire(anyString(), eq(5), any(Duration.class))).thenReturn(true);
        when(rateLimiterService.getRemainingAttempts(anyString(), eq(5), any(Duration.class))).thenReturn(4);

        boolean result = interceptor.preHandle(request, response, rateLimitedHandler);

        assertTrue(result);
        assertEquals("5", response.getHeader("X-RateLimit-Limit"));
        assertEquals("4", response.getHeader("X-RateLimit-Remaining"));
        verify(rateLimiterService).tryAcquire(
                eq("rate_limit:sample-action:192.168.1.100"), eq(5), eq(Duration.ofSeconds(30)));
    }

    @Test
    @DisplayName("preHandle appends user ID to key for authenticated requests")
    void preHandle_authenticatedUser_appendsUserIdToKey() {
        User user = new User();
        user.setId(88L);
        user.setEmail("user@example.com");
        CustomUserDetails cud = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(cud, null, cud.getAuthorities())
        );

        when(rateLimiterService.isEnabled()).thenReturn(true);
        when(rateLimiterService.tryAcquire(anyString(), eq(5), any(Duration.class))).thenReturn(true);
        when(rateLimiterService.getRemainingAttempts(anyString(), eq(5), any(Duration.class))).thenReturn(4);

        boolean result = interceptor.preHandle(request, response, rateLimitedHandler);

        assertTrue(result);
        verify(rateLimiterService).tryAcquire(
                eq("rate_limit:sample-action:192.168.1.100:user:88"), eq(5), eq(Duration.ofSeconds(30)));
    }

    @Test
    @DisplayName("preHandle ignores X-Forwarded-For by default, even from a proxy-shaped remoteAddr " +
                 "(trusted-proxy disabled is the safe default)")
    void preHandle_trustedProxyDisabled_ignoresForwardedHeader() {
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Forwarded-For", "203.0.113.7");

        when(rateLimiterService.isEnabled()).thenReturn(true);
        when(rateLimiterService.tryAcquire(anyString(), eq(5), any(Duration.class))).thenReturn(true);
        when(rateLimiterService.getRemainingAttempts(anyString(), eq(5), any(Duration.class))).thenReturn(4);

        interceptor.preHandle(request, response, rateLimitedHandler);

        verify(rateLimiterService).tryAcquire(
                eq("rate_limit:sample-action:127.0.0.1"), eq(5), eq(Duration.ofSeconds(30)));
    }

    @Test
    @DisplayName("preHandle uses X-Forwarded-For's leftmost entry when trusted-proxy is enabled and " +
                 "remoteAddr is inside the configured CIDR range")
    void preHandle_trustedProxyEnabledFromTrustedAddress_usesForwardedFor() {
        org.springframework.test.util.ReflectionTestUtils.setField(interceptor, "trustedProxyEnabled", true);
        org.springframework.test.util.ReflectionTestUtils.setField(
                interceptor, "trustedProxyCidrs", "127.0.0.1/32,::1/128");

        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Forwarded-For", "203.0.113.7, 127.0.0.1");

        when(rateLimiterService.isEnabled()).thenReturn(true);
        when(rateLimiterService.tryAcquire(anyString(), eq(5), any(Duration.class))).thenReturn(true);
        when(rateLimiterService.getRemainingAttempts(anyString(), eq(5), any(Duration.class))).thenReturn(4);

        interceptor.preHandle(request, response, rateLimitedHandler);

        verify(rateLimiterService).tryAcquire(
                eq("rate_limit:sample-action:203.0.113.7"), eq(5), eq(Duration.ofSeconds(30)));
    }

    @Test
    @DisplayName("preHandle still ignores X-Forwarded-For when trusted-proxy is enabled but remoteAddr " +
                 "is outside the configured CIDR range (spoofing from an untrusted source stays blocked)")
    void preHandle_trustedProxyEnabledFromUntrustedAddress_ignoresForwardedFor() {
        org.springframework.test.util.ReflectionTestUtils.setField(interceptor, "trustedProxyEnabled", true);
        org.springframework.test.util.ReflectionTestUtils.setField(
                interceptor, "trustedProxyCidrs", "127.0.0.1/32,::1/128");

        request.setRemoteAddr("198.51.100.23");
        request.addHeader("X-Forwarded-For", "203.0.113.7");

        when(rateLimiterService.isEnabled()).thenReturn(true);
        when(rateLimiterService.tryAcquire(anyString(), eq(5), any(Duration.class))).thenReturn(true);
        when(rateLimiterService.getRemainingAttempts(anyString(), eq(5), any(Duration.class))).thenReturn(4);

        interceptor.preHandle(request, response, rateLimitedHandler);

        verify(rateLimiterService).tryAcquire(
                eq("rate_limit:sample-action:198.51.100.23"), eq(5), eq(Duration.ofSeconds(30)));
    }
}
