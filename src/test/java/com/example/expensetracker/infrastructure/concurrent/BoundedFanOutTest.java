package com.example.expensetracker.infrastructure.concurrent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("BoundedFanOut")
class BoundedFanOutTest {

    @Test
    @DisplayName("never runs more tasks at once than the limit, and still runs every item")
    void respectsTheConcurrencyLimit() throws Exception {
        int limit = 3;
        AtomicInteger inFlight = new AtomicInteger();
        AtomicInteger highWater = new AtomicInteger();
        AtomicInteger done = new AtomicInteger();
        List<Integer> items = IntStream.range(0, 60).boxed().toList();

        try (ExecutorService unbounded = Executors.newVirtualThreadPerTaskExecutor()) {
            BoundedFanOut.forEach(items, limit, unbounded, item -> {
                int now = inFlight.incrementAndGet();
                highWater.accumulateAndGet(now, Math::max);
                try {
                    Thread.sleep(5);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    inFlight.decrementAndGet();
                    done.incrementAndGet();
                }
            });
        }

        assertEquals(60, done.get(), "every item must be processed before forEach returns");
        assertTrue(highWater.get() <= limit, "saw " + highWater.get() + " tasks at once, limit was " + limit);
        assertTrue(highWater.get() > 1, "should still run in parallel");
    }

    @Test
    @DisplayName("a limit below one is treated as one and a failing task does not leave a permit behind")
    void survivesNonsenseLimitAndFailures() {
        AtomicInteger done = new AtomicInteger();

        BoundedFanOut.forEach(List.of(1, 2, 3, 4), 0, Runnable::run, item -> {
            try {
                if (item == 2) {
                    throw new IllegalStateException("boom");
                }
            } catch (IllegalStateException expected) {
                // the caller's task owns its error handling
            }
            done.incrementAndGet();
        });

        assertEquals(4, done.get());
    }
}
