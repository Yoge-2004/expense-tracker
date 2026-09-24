package com.example.expensetracker.security.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class RateLimiterServiceImplTest {

    private RateLimiterServiceImpl rateLimiterService;

    @BeforeEach
    void setUp() {
        rateLimiterService = new RateLimiterServiceImpl();
        rateLimiterService.setEnabled(true);
        rateLimiterService.clearAll();
    }

    @Test
    @DisplayName("tryAcquire permits requests up to maxRequests and blocks subsequent attempts")
    void tryAcquire_enforcesLimit() {
        String key = "test:client-1";
        Duration window = Duration.ofSeconds(60);
        int limit = 3;

        assertTrue(rateLimiterService.tryAcquire(key, limit, window));
        assertEquals(2, rateLimiterService.getRemainingAttempts(key, limit, window));

        assertTrue(rateLimiterService.tryAcquire(key, limit, window));
        assertEquals(1, rateLimiterService.getRemainingAttempts(key, limit, window));

        assertTrue(rateLimiterService.tryAcquire(key, limit, window));
        assertEquals(0, rateLimiterService.getRemainingAttempts(key, limit, window));

        // 4th request must be rejected
        assertFalse(rateLimiterService.tryAcquire(key, limit, window));
        assertTrue(rateLimiterService.getSecondsUntilReset(key, window) > 0);
    }

    @Test
    @DisplayName("tryAcquire always allows requests when rate limiter is disabled")
    void tryAcquire_whenDisabled_alwaysAllows() {
        rateLimiterService.setEnabled(false);
        String key = "test:client-disabled";
        Duration window = Duration.ofSeconds(60);

        for (int i = 0; i < 20; i++) {
            assertTrue(rateLimiterService.tryAcquire(key, 2, window));
        }
    }

    @Test
    @DisplayName("reset clears rate limit for the specified key")
    void reset_clearsKey() {
        String key = "test:client-reset";
        Duration window = Duration.ofSeconds(60);

        rateLimiterService.tryAcquire(key, 1, window);
        assertFalse(rateLimiterService.tryAcquire(key, 1, window));

        rateLimiterService.reset(key);

        assertTrue(rateLimiterService.tryAcquire(key, 1, window));
    }

    @Test
    @DisplayName("cleanupExpiredBuckets purges expired sliding window buckets")
    void cleanupExpiredBuckets_purgesExpired() throws InterruptedException {
        String key = "test:expiring";
        // 50ms window
        Duration window = Duration.ofMillis(50);

        rateLimiterService.tryAcquire(key, 1, window);
        Thread.sleep(70);

        // Window has passed, bucket is now expired
        rateLimiterService.cleanupExpiredBuckets();

        // Fresh request should acquire successfully
        assertTrue(rateLimiterService.tryAcquire(key, 1, window));
    }
}
