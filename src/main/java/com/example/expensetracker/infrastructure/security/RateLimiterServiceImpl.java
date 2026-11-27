package com.example.expensetracker.infrastructure.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * High-performance, thread-safe in-memory sliding window rate limiter implementation
 * backed by a bounded, auto-expiring Caffeine cache.
 */
@Slf4j
@Service
public class RateLimiterServiceImpl implements RateLimiterService {

    /**
     * Upper bound on tracked keys so caller-controlled identifiers cannot exhaust heap memory.
     */
    static final int MAX_TRACKED_KEYS = 50_000;

    @Value("${app.security.rate-limit.enabled:true}")
    private volatile boolean enabled = true;

    private final Clock clock;
    private final Cache<String, SlidingWindowBucket> buckets;

    public RateLimiterServiceImpl(@Autowired(required = false) Clock clock) {
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
        this.buckets = Caffeine.newBuilder()
                .maximumSize(MAX_TRACKED_KEYS)
                .expireAfterAccess(Duration.ofHours(1))
                .ticker(() -> {
                    Instant now = this.clock.instant();
                    return now.getEpochSecond() * 1_000_000_000L + now.getNano();
                })
                .executor(Runnable::run)
                .build();
    }

    public RateLimiterServiceImpl() {
        this(Clock.systemDefaultZone());
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
        SlidingWindowBucket bucket = buckets.get(
                key, _ -> new SlidingWindowBucket(maxRequests, window, clock)
        );
        return bucket != null && bucket.tryAcquire();
    }

    /** @return how many keys are currently tracked after synchronous Caffeine maintenance (exposed for tests). */
    int trackedKeys() {
        buckets.cleanUp();
        return (int) buckets.estimatedSize();
    }

    @Override
    public int getRemainingAttempts(String key, int maxRequests, Duration window) {
        if (!enabled) {
            return maxRequests;
        }
        SlidingWindowBucket bucket = buckets.getIfPresent(key);
        if (bucket == null) {
            return maxRequests;
        }
        return bucket.getRemainingAttempts();
    }

    @Override
    public long getSecondsUntilReset(String key, Duration window) {
        SlidingWindowBucket bucket = buckets.getIfPresent(key);
        if (bucket == null) {
            return 0;
        }
        return bucket.getSecondsUntilReset();
    }

    @Override
    public void reset(String key) {
        buckets.invalidate(key);
    }

    @Override
    public void clearAll() {
        buckets.invalidateAll();
    }

    @Override
    @Scheduled(fixedRate = 300000)
    public void cleanupExpiredBuckets() {
        long before = buckets.estimatedSize();
        buckets.asMap().entrySet().removeIf(entry -> {
            SlidingWindowBucket bucket = entry.getValue();
            synchronized (bucket) {
                return bucket.isExpired();
            }
        });
        buckets.cleanUp();
        long after = buckets.estimatedSize();
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
