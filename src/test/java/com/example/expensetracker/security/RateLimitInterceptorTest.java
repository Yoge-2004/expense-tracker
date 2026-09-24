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
    @DisplayName("preHandle throws RateLimitExceededException when acquire is rejected")
    void preHandle_rateLimitExceeded_throwsException() {
        when(rateLimiterService.isEnabled()).thenReturn(true);
        when(rateLimiterService.tryAcquire(anyString(), eq(5), any(Duration.class))).thenReturn(false);
        when(rateLimiterService.getSecondsUntilReset(anyString(), any(Duration.class))).thenReturn(25L);

        RateLimitExceededException ex = assertThrows(RateLimitExceededException.class, () ->
                interceptor.preHandle(request, response, rateLimitedHandler)
        );

        assertEquals(25L, ex.getRetryAfterSeconds());
        assertTrue(ex.getMessage().contains("25"));
    }
}
