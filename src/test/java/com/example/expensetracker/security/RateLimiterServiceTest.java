package com.example.expensetracker.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("RateLimiterService Tests")
class RateLimiterServiceTest {

    private RateLimiterService rateLimiterService;

    @BeforeEach
    void setUp() {
        rateLimiterService = new RateLimiterService();
        rateLimiterService.setEnabled(true);
        rateLimiterService.clearAll();
    }

    @Test
    @DisplayName("Should allow requests within limit and track remaining attempts")
    void shouldAllowRequestsWithinLimit() {
        String key = "test-key-1";
        int limit = 3;
        Duration window = Duration.ofMinutes(1);

        assertThat(rateLimiterService.tryAcquire(key, limit, window)).isTrue();
        assertThat(rateLimiterService.getRemainingAttempts(key, limit, window)).isEqualTo(2);

        assertThat(rateLimiterService.tryAcquire(key, limit, window)).isTrue();
        assertThat(rateLimiterService.getRemainingAttempts(key, limit, window)).isEqualTo(1);

        assertThat(rateLimiterService.tryAcquire(key, limit, window)).isTrue();
        assertThat(rateLimiterService.getRemainingAttempts(key, limit, window)).isEqualTo(0);

        // 4th request should be blocked
        assertThat(rateLimiterService.tryAcquire(key, limit, window)).isFalse();
        assertThat(rateLimiterService.getSecondsUntilReset(key, window)).isGreaterThan(0);
    }

    @Test
    @DisplayName("Should allow all requests when rate limiting is disabled")
    void shouldAllowAllWhenDisabled() {
        rateLimiterService.setEnabled(false);
        String key = "test-disabled";

        for (int i = 0; i < 20; i++) {
            assertThat(rateLimiterService.tryAcquire(key, 2, Duration.ofMinutes(1))).isTrue();
        }
    }

    @Test
    @DisplayName("Should reset limit when requested for a key")
    void shouldResetKey() {
        String key = "test-reset";
        int limit = 1;
        Duration window = Duration.ofMinutes(1);

        assertThat(rateLimiterService.tryAcquire(key, limit, window)).isTrue();
        assertThat(rateLimiterService.tryAcquire(key, limit, window)).isFalse();

        rateLimiterService.reset(key);
        assertThat(rateLimiterService.tryAcquire(key, limit, window)).isTrue();
    }

    @Test
    @DisplayName("Should clear all keys when clearAll is called")
    void shouldClearAll() {
        String key1 = "k1";
        String key2 = "k2";
        rateLimiterService.tryAcquire(key1, 1, Duration.ofMinutes(1));
        rateLimiterService.tryAcquire(key2, 1, Duration.ofMinutes(1));

        rateLimiterService.clearAll();

        assertThat(rateLimiterService.tryAcquire(key1, 1, Duration.ofMinutes(1))).isTrue();
        assertThat(rateLimiterService.tryAcquire(key2, 1, Duration.ofMinutes(1))).isTrue();
    }

    @Test
    @DisplayName("Should be thread-safe under concurrent attempts")
    void shouldBeThreadSafe() throws InterruptedException {
        String key = "concurrent-key";
        int limit = 10;
        int threads = 30;
        Duration window = Duration.ofMinutes(1);

        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger allowedCount = new AtomicInteger(0);
        AtomicInteger rejectedCount = new AtomicInteger(0);

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    if (rateLimiterService.tryAcquire(key, limit, window)) {
                        allowedCount.incrementAndGet();
                    } else {
                        rejectedCount.incrementAndGet();
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await();
        executor.shutdown();

        assertThat(allowedCount.get()).isEqualTo(limit);
        assertThat(rejectedCount.get()).isEqualTo(threads - limit);
    }
}
