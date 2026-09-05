package com.example.expensetracker.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * High-performance, thread-safe in-memory sliding window rate limiter service.
 *
 * <p>Uses precise timestamp deques per rate limit key to track request volume within
 * a sliding window, preventing brute-force attacks and request flooding on sensitive
 * authentication, PIN, and password recovery endpoints without introducing external
 * service dependencies (e.g. Redis).</p>
 *
 * @author Yogeshwaran
 */
@Service
public class RateLimiterService {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterService.class);

    @Value("${app.security.rate-limit.enabled:true}")
    private boolean enabled = true;

    private final Map<String, SlidingWindowBucket> buckets = new ConcurrentHashMap<>();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    /**
     * Attempts to acquire permission for an execution under the specified key.
     *
     * @param key         the unique rate-limit identifier (e.g. action + IP + user)
     * @param maxRequests maximum allowed calls within the sliding window
     * @param window      duration of the sliding window
     * @return {@code true} if allowed, {@code false} if limit reached
     */
    public boolean tryAcquire(String key, int maxRequests, Duration window) {
        if (!enabled) {
            return true;
        }
        SlidingWindowBucket bucket = buckets.computeIfAbsent(
                key, k -> new SlidingWindowBucket(maxRequests, window)
        );
        return bucket.tryAcquire();
    }

    /**
     * Gets the remaining calls allowed for the given key in the current window.
     */
    public int getRemainingAttempts(String key, int maxRequests, Duration window) {
        if (!enabled) {
            return maxRequests;
        }
        SlidingWindowBucket bucket = buckets.get(key);
        if (bucket == null) {
            return maxRequests;
        }
        return bucket.getRemainingAttempts();
    }

    /**
     * Calculates the seconds remaining until at least one slot in the sliding window frees up.
     */
    public long getSecondsUntilReset(String key, Duration window) {
        SlidingWindowBucket bucket = buckets.get(key);
        if (bucket == null) {
            return 0;
        }
        return bucket.getSecondsUntilReset();
    }

    /**
     * Resets rate limit counters for a specific key.
     */
    public void reset(String key) {
        buckets.remove(key);
    }

    /**
     * Clears all active rate limit buckets. Used by test suites and administrative operations.
     */
    public void clearAll() {
        buckets.clear();
    }

    /**
     * Periodic cleanup of expired buckets every 5 minutes to prevent memory leaks over time.
     */
    @Scheduled(fixedRate = 300000)
    public void cleanupExpiredBuckets() {
        buckets.entrySet().removeIf(entry -> entry.getValue().isExpired());
    }

    /**
     * Sliding window bucket maintaining arrival timestamps of recent requests.
     */
    public static class SlidingWindowBucket {
        private final int capacity;
        private final long windowMillis;
        private final ConcurrentLinkedDeque<Long> timestamps = new ConcurrentLinkedDeque<>();

        public SlidingWindowBucket(int capacity, Duration window) {
            this.capacity = capacity;
            this.windowMillis = window.toMillis();
        }

        public synchronized boolean tryAcquire() {
            long now = System.currentTimeMillis();
            evictExpired(now);

            if (timestamps.size() < capacity) {
                timestamps.addLast(now);
                return true;
            }
            return false;
        }

        public synchronized int getRemainingAttempts() {
            long now = System.currentTimeMillis();
            evictExpired(now);
            return Math.max(0, capacity - timestamps.size());
        }

        public synchronized long getSecondsUntilReset() {
            long now = System.currentTimeMillis();
            evictExpired(now);
            if (timestamps.isEmpty()) {
                return 0;
            }
            Long oldest = timestamps.peekFirst();
            if (oldest == null) {
                return 0;
            }
            long resetTime = oldest + windowMillis;
            return Math.max(1, (resetTime - now + 999) / 1000);
        }

        public synchronized boolean isExpired() {
            long now = System.currentTimeMillis();
            evictExpired(now);
            return timestamps.isEmpty();
        }

        private void evictExpired(long now) {
            long windowStart = now - windowMillis;
            while (!timestamps.isEmpty() && timestamps.peekFirst() <= windowStart) {
                timestamps.pollFirst();
            }
        }
    }
}
