package com.example.expensetracker.security;

import com.example.expensetracker.exception.RateLimitExceededException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-account brake on password guessing, independent of the caller's IP address.
 *
 * <p>The IP-based limit alone is not enough: an address can be rotated. This guard counts wrong
 * passwords per account identifier and, after {@value #MAX_FAILURES} failures inside
 * {@code WINDOW}, refuses further attempts for that account until the window ends. A successful
 * sign-in clears the counter. State is in memory (like the IP limiter) and bounded in size.
 *
 * @author Yogeshwaran
 */
@Component
public class LoginAttemptGuard {

    static final int MAX_FAILURES = 8;
    static final Duration WINDOW = Duration.ofMinutes(15);
    static final int MAX_TRACKED = 20_000;

    private record Entry(int failures, Instant windowStart) {
    }

    private final Clock clock;
    private final ConcurrentHashMap<String, Entry> attempts = new ConcurrentHashMap<>();

    @Autowired
    public LoginAttemptGuard() {
        this(Clock.systemUTC());
    }

    LoginAttemptGuard(Clock clock) {
        this.clock = clock;
    }

    /** @throws RateLimitExceededException while the account is in its cool-down period */
    public void checkAllowed(String identifier) {
        String key = normalize(identifier);
        if (key.isEmpty()) {
            return;
        }
        Entry entry = attempts.get(key);
        if (entry == null) {
            return;
        }
        Instant now = clock.instant();
        Instant until = entry.windowStart().plus(WINDOW);
        if (!until.isAfter(now)) {
            attempts.remove(key, entry);
            return;
        }
        if (entry.failures() >= MAX_FAILURES) {
            long retryAfter = Math.max(1, Duration.between(now, until).toSeconds());
            throw new RateLimitExceededException(
                    "Too many failed sign-in attempts for this account. Please try again in " + retryAfter + " seconds.",
                    retryAfter);
        }
    }

    public void recordFailure(String identifier) {
        String key = normalize(identifier);
        if (key.isEmpty()) {
            return;
        }
        Instant now = clock.instant();
        if (attempts.size() >= MAX_TRACKED) {
            attempts.entrySet().removeIf(e -> !e.getValue().windowStart().plus(WINDOW).isAfter(now));
            if (attempts.size() >= MAX_TRACKED && !attempts.containsKey(key)) {
                return; // full of live entries: keep existing locks rather than evict them
            }
        }
        attempts.compute(key, (k, existing) -> {
            if (existing == null || !existing.windowStart().plus(WINDOW).isAfter(now)) {
                return new Entry(1, now);
            }
            return new Entry(existing.failures() + 1, existing.windowStart());
        });
    }

    public void recordSuccess(String identifier) {
        String key = normalize(identifier);
        if (!key.isEmpty()) {
            attempts.remove(key);
        }
    }

    private static String normalize(String identifier) {
        if (identifier == null) {
            return "";
        }
        String trimmed = identifier.trim().toLowerCase(Locale.ROOT);
        return trimmed.length() > 254 ? trimmed.substring(0, 254) : trimmed;
    }
}
