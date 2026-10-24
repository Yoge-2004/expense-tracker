package com.example.expensetracker.security;

import com.example.expensetracker.exception.RateLimitExceededException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

class LoginAttemptGuardTest {

    /** Clock the test can move forward. */
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-10-23T10:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private MutableClock clock;
    private LoginAttemptGuard guard;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        guard = new LoginAttemptGuard(clock);
    }

    private void fail(String id, int times) {
        for (int i = 0; i < times; i++) {
            guard.checkAllowed(id);
            guard.recordFailure(id);
        }
    }

    @Test
    void attemptsBelowTheLimitAreAllowed() {
        fail("jane@example.com", LoginAttemptGuard.MAX_FAILURES - 1);
        assertDoesNotThrow(() -> guard.checkAllowed("jane@example.com"));
    }

    @Test
    void accountIsBlockedAfterTooManyFailures() {
        fail("jane@example.com", LoginAttemptGuard.MAX_FAILURES);

        RateLimitExceededException ex = assertThrows(RateLimitExceededException.class,
                () -> guard.checkAllowed("jane@example.com"));
        assertTrue(ex.getMessage().contains("seconds"));
    }

    @Test
    void identifierIsCaseAndWhitespaceInsensitive() {
        fail("Jane@Example.com", LoginAttemptGuard.MAX_FAILURES);

        assertThrows(RateLimitExceededException.class, () -> guard.checkAllowed("  jane@example.com "));
    }

    @Test
    void otherAccountsAreUnaffected() {
        fail("jane@example.com", LoginAttemptGuard.MAX_FAILURES);

        assertDoesNotThrow(() -> guard.checkAllowed("john@example.com"));
    }

    @Test
    void successfulLoginClearsTheCounter() {
        fail("jane@example.com", LoginAttemptGuard.MAX_FAILURES - 1);
        guard.recordSuccess("jane@example.com");
        fail("jane@example.com", LoginAttemptGuard.MAX_FAILURES - 1);

        assertDoesNotThrow(() -> guard.checkAllowed("jane@example.com"));
    }

    @Test
    void blockEndsWhenTheWindowPasses() {
        fail("jane@example.com", LoginAttemptGuard.MAX_FAILURES);
        assertThrows(RateLimitExceededException.class, () -> guard.checkAllowed("jane@example.com"));

        clock.advance(LoginAttemptGuard.WINDOW.plusSeconds(1));

        assertDoesNotThrow(() -> guard.checkAllowed("jane@example.com"));
        guard.recordFailure("jane@example.com"); // starts a fresh window
        assertDoesNotThrow(() -> guard.checkAllowed("jane@example.com"));
    }

    @Test
    void blankIdentifiersAreIgnored() {
        assertDoesNotThrow(() -> {
            guard.checkAllowed(null);
            guard.recordFailure("  ");
            guard.recordSuccess(null);
        });
    }
}
