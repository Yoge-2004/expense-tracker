package com.example.expensetracker.security;

import java.time.Duration;

/**
 * Service interface for sliding window request rate limiting.
 */
public interface RateLimiterService {

    /**
     * Checks if rate limiting is globally active.
     */
    boolean isEnabled();

    /**
     * Sets whether rate limiting is enabled.
     */
    void setEnabled(boolean enabled);

    /**
     * Attempts to acquire permission for an execution under the specified key.
     *
     * @param key unique rate-limit key
     * @param maxRequests maximum calls allowed within sliding window
     * @param window duration of the sliding window
     * @return true if permitted, false if rate limit exceeded
     */
    boolean tryAcquire(String key, int maxRequests, Duration window);

    /**
     * Gets the remaining calls allowed for the given key in the current window.
     */
    int getRemainingAttempts(String key, int maxRequests, Duration window);

    /**
     * Calculates the seconds remaining until at least one slot in the sliding window frees up.
     */
    long getSecondsUntilReset(String key, Duration window);

    /**
     * Resets rate limit counters for a specific key.
     */
    void reset(String key);

    /**
     * Clears all active rate limit buckets.
     */
    void clearAll();

    /**
     * Periodic cleanup of expired rate limit buckets.
     */
    void cleanupExpiredBuckets();
}
