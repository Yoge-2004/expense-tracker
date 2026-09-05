package com.example.expensetracker.exception;

/**
 * Thrown when an endpoint or user action has exceeded its configured rate limit.
 *
 * <p>Carries the {@code retryAfterSeconds} parameter indicating how long the client
 * must wait before a retry is permitted.</p>
 *
 * @author Yogeshwaran
 */
public class RateLimitExceededException extends RuntimeException {

    private final long retryAfterSeconds;

    public RateLimitExceededException(String message, long retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
