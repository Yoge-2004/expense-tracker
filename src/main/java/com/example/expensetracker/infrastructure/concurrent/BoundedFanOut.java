package com.example.expensetracker.infrastructure.concurrent;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Semaphore;
import java.util.function.Consumer;

/**
 * Runs a task for every item on an executor, but never more than {@code maxConcurrent} at once.
 *
 * <p>The application's async executor hands out a virtual thread per task and has no limit of its own, while the
 * database pool holds only 5 to 10 connections. Dispatching a page of 200 users at it let 200 tasks queue for those
 * connections at the same moment, so the scheduled batch and live user requests timed out together. Capping the
 * fan-out below the pool size keeps connections free for requests.</p>
 *
 * <p>The caller blocks until every task has finished, so work still completes one page at a time.</p>
 */
public final class BoundedFanOut {

    private BoundedFanOut() {
    }

    /**
     * @param items         what to process
     * @param maxConcurrent the most tasks allowed in flight; values below 1 are treated as 1
     * @param executor      where tasks run
     * @param task          the work for one item; it should handle its own failures, because one failing item
     *                      must not stop the rest
     */
    public static <T> void forEach(Collection<T> items, int maxConcurrent, Executor executor, Consumer<T> task) {
        Semaphore permits = new Semaphore(Math.max(1, maxConcurrent));
        List<CompletableFuture<Void>> futures = new ArrayList<>(items.size());
        for (T item : items) {
            permits.acquireUninterruptibly();
            try {
                futures.add(CompletableFuture.runAsync(() -> {
                    try {
                        task.accept(item);
                    } finally {
                        permits.release();
                    }
                }, executor));
            } catch (RuntimeException rejected) {
                permits.release();
                throw rejected;
            }
        }
        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
    }
}
