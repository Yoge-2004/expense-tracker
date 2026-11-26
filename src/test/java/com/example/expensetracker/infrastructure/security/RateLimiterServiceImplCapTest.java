package com.example.expensetracker.infrastructure.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("RateLimiterServiceImpl memory bound")
class RateLimiterServiceImplCapTest {

    @Test
    @DisplayName("a flood of distinct keys cannot grow the map past its ceiling")
    void floodOfDistinctKeysIsBounded() {
        RateLimiterServiceImpl limiter = new RateLimiterServiceImpl();

        for (int i = 0; i < RateLimiterServiceImpl.MAX_TRACKED_KEYS + 5_000; i++) {
            limiter.tryAcquire("ip:" + i, 5, Duration.ofMinutes(10));
        }

        assertTrue(limiter.trackedKeys() <= RateLimiterServiceImpl.MAX_TRACKED_KEYS,
                "tracked " + limiter.trackedKeys() + " keys");
    }

    @Test
    @DisplayName("limits still apply to a key while the map is being trimmed")
    void limitStillEnforcedForNormalTraffic() {
        RateLimiterServiceImpl limiter = new RateLimiterServiceImpl();

        assertTrue(limiter.tryAcquire("login:alice", 2, Duration.ofMinutes(1)));
        assertTrue(limiter.tryAcquire("login:alice", 2, Duration.ofMinutes(1)));
        assertFalse(limiter.tryAcquire("login:alice", 2, Duration.ofMinutes(1)));
    }
}
