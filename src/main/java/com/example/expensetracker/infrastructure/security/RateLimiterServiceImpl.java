package com.example.expensetracker.infrastructure.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;



/**
 * High-performance, thread-safe in-memory sliding window rate limiter implementation.
 */
@Slf4j
@Service
public class RateLimiterServiceImpl implements RateLimiterService {

    @Value("${app.security.rate-limit.enabled:true}")
    private volatile boolean enabled = true;

    private final java.time.Clock clock;
    private final Map<String, SlidingWindowBucket> buckets = new ConcurrentHashMap<>();

    public RateLimiterServiceImpl(@org.springframework.beans.factory.annotation.Autowired(required = false) java.time.Clock clock) {
        this.clock = clock != null ? clock : java.time.Clock.systemDefaultZone();
    }

    public RateLimiterServiceImpl() {
        this(java.time.Clock.systemDefaultZone());
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    public boolean tryAcquire(String key, int maxRequests, Duration window) {
        if (!enabled) {
            return true;
        }
        SlidingWindowBucket bucket = buckets.computeIfAbsent(
                key, _ -> new SlidingWindowBucket(maxRequests, window, clock)
        );
        return bucket.tryAcquire();
    }

    @Override
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

    @Override
    public long getSecondsUntilReset(String key, Duration window) {
        SlidingWindowBucket bucket = buckets.get(key);
        if (bucket == null) {
            return 0;
        }
        return bucket.getSecondsUntilReset();
    }

    @Override
    public void reset(String key) {
        buckets.remove(key);
    }

    @Override
    public void clearAll() {
        buckets.clear();
    }

    @Override
    @Scheduled(fixedRate = 300000)
    public void cleanupExpiredBuckets() {
        int before = buckets.size();
        buckets.entrySet().removeIf(entry -> {
            SlidingWindowBucket bucket = entry.getValue();
            synchronized (bucket) {
                return bucket.isExpired();
            }
        });
        int after = buckets.size();
        if (before != after) {
            log.debug("RateLimiter cleanupExpiredBuckets: purged {} empty/stale buckets (retained {})",
                    before - after, after);
        }
    }

    public static class SlidingWindowBucket {
        private final int capacity;
        private final long windowMillis;
        private final java.time.Clock clock;
        private final ConcurrentLinkedDeque<Long> timestamps = new ConcurrentLinkedDeque<>();

        public SlidingWindowBucket(int capacity, Duration window, java.time.Clock clock) {
            if (capacity <= 0) {
                throw new IllegalArgumentException("Rate limit capacity must be strictly greater than zero");
            }
            if (window == null || window.isNegative() || window.isZero()) {
                throw new IllegalArgumentException("Rate limit window must be positive");
            }
            this.capacity = capacity;
            this.windowMillis = window.toMillis();
            this.clock = clock != null ? clock : java.time.Clock.systemDefaultZone();
        }

        public SlidingWindowBucket(int capacity, Duration window) {
            this(capacity, window, java.time.Clock.systemDefaultZone());
        }

        public synchronized boolean tryAcquire() {
            long now = clock.millis();
            evictExpired(now);

            if (timestamps.size() < capacity) {
                timestamps.addLast(now);
                return true;
            }
            return false;
        }

        public synchronized int getRemainingAttempts() {
            long now = clock.millis();
            evictExpired(now);
            return Math.max(0, capacity - timestamps.size());
        }

        public synchronized long getSecondsUntilReset() {
            long now = clock.millis();
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
            long now = clock.millis();
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
