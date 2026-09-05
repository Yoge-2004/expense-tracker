package com.example.expensetracker.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Enforces rate limiting on controller methods or classes.
 *
 * <p>Requests exceeding {@link #maxRequests()} within the specified {@link #windowSeconds()}
 * will be rejected with HTTP 429 Too Many Requests and a {@code Retry-After} header.</p>
 *
 * @author Yogeshwaran
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimited {

    /**
     * Unique identifier for the rate-limited action (e.g. "auth-login").
     * Defaults to the handler method name if empty.
     */
    String key() default "";

    /**
     * Maximum allowed requests within the given sliding window.
     */
    int maxRequests() default 10;

    /**
     * Sliding window duration in seconds.
     */
    int windowSeconds() default 60;

    /**
     * Error message template to return when rate limit is exceeded.
     * Supports a {@code %d} placeholder for the remaining retry-after seconds.
     */
    String message() default "Too many requests. Please try again in %d seconds.";
}
