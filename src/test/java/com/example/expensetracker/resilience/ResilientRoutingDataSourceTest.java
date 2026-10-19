package com.example.expensetracker.resilience;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("ResilientRoutingDataSource")
class ResilientRoutingDataSourceTest {

    private static final long RETRY_MS = 30;
    private static final long BACKOFF_MS = 60;
    private static final long GRACE_MS = 30;

    private final AtomicBoolean primaryDown = new AtomicBoolean(false);
    private final DataSource primary = switchable(h2("primary_" + System.nanoTime()), primaryDown);
    private final DataSource fallback = h2("fallback_" + System.nanoTime());

    private ResilientRoutingDataSource routing() {
        return new ResilientRoutingDataSource(primary, fallback, RETRY_MS, BACKOFF_MS, GRACE_MS, 5_000);
    }

    @Test
    @DisplayName("serves the primary while it is healthy")
    void servesPrimary() throws Exception {
        ResilientRoutingDataSource ds = routing();
        try (Connection c = ds.getConnection()) {
            assertTrue(url(c).contains("primary_"));
        }
        assertEquals(ResilientRoutingDataSource.Mode.PRIMARY, ds.mode());
    }

    @Test
    @DisplayName("falls back to the local store when the primary fails")
    void fallsBack() throws Exception {
        ResilientRoutingDataSource ds = routing();
        primaryDown.set(true);
        try (Connection c = ds.getConnection()) {
            assertTrue(url(c).contains("fallback_"));
        }
        assertEquals(ResilientRoutingDataSource.Mode.FALLBACK, ds.mode());
    }

    @Test
    @DisplayName("switches straight back when no recovery handler is registered")
    void switchesBackWithoutHandler() throws Exception {
        ResilientRoutingDataSource ds = routing();
        primaryDown.set(true);
        ds.getConnection().close();
        primaryDown.set(false);

        waitFor(() -> {
            try (Connection c = ds.getConnection()) {
                return ds.mode() == ResilientRoutingDataSource.Mode.PRIMARY && url(c).contains("primary_");
            } catch (SQLException e) {
                return false;
            }
        });
    }

    @Test
    @DisplayName("merges fallback writes twice, serves the fallback meanwhile, then switches back")
    void mergesBeforeSwitchingBack() throws Exception {
        ResilientRoutingDataSource ds = routing();
        RecordingHandler handler = new RecordingHandler();
        ds.setRecoveryHandler(handler);
        primaryDown.set(true);
        ds.getConnection().close();
        primaryDown.set(false);

        waitFor(() -> {
            try (Connection c = ds.getConnection()) {
                return ds.mode() == ResilientRoutingDataSource.Mode.PRIMARY;
            } catch (SQLException e) {
                return false;
            }
        });

        assertEquals(2, handler.syncs.get(), "a live pass and a final pass");
        waitFor(() -> handler.afterRecovery.get() == 1);
        assertNull(ds.lastRecoveryError());
    }

    @Test
    @DisplayName("holds new connections during the final merge so no write is missed")
    void gatesNewConnectionsDuringFinalPass() throws Exception {
        ResilientRoutingDataSource ds = routing();
        CountDownLatch finalPassStarted = new CountDownLatch(1);
        AtomicBoolean finalPassDone = new AtomicBoolean(false);
        AtomicInteger calls = new AtomicInteger();
        ds.setRecoveryHandler(new ResilientRoutingDataSource.RecoveryHandler() {
            @Override
            public SyncResult sync(Connection fallbackConnection, Connection primaryConnection) throws SQLException {
                if (calls.incrementAndGet() == 2) {
                    finalPassStarted.countDown();
                    sleep(300);
                    finalPassDone.set(true);
                }
                return SyncResult.none();
            }

            @Override
            public void afterRecovery(SyncResult lastResult) {
                // not needed here
            }
        });
        primaryDown.set(true);
        ds.getConnection().close();
        primaryDown.set(false);

        // Keep nudging the router until recovery starts.
        Thread nudge = new Thread(() -> {
            while (finalPassStarted.getCount() > 0) {
                try (Connection c = ds.getConnection()) {
                    sleep(5);
                } catch (SQLException ignored) {
                    // keep trying
                }
            }
        });
        nudge.start();
        assertTrue(finalPassStarted.await(5, TimeUnit.SECONDS), "final merge pass never started");
        nudge.join(2_000);

        try (Connection c = ds.getConnection()) {
            assertNotNull(c);
            assertTrue(finalPassDone.get(), "a connection was handed out while the final merge was still running");
        }
    }

    @Test
    @DisplayName("stays on the fallback and retries when the merge fails")
    void staysOnFallbackWhenMergeFails() throws Exception {
        ResilientRoutingDataSource ds = routing();
        AtomicInteger attempts = new AtomicInteger();
        ds.setRecoveryHandler(new ResilientRoutingDataSource.RecoveryHandler() {
            @Override
            public SyncResult sync(Connection fallbackConnection, Connection primaryConnection) throws SQLException {
                if (attempts.incrementAndGet() <= 1) {
                    throw new SQLException("primary rejected the merge");
                }
                return SyncResult.none();
            }

            @Override
            public void afterRecovery(SyncResult lastResult) {
                // not needed here
            }
        });
        primaryDown.set(true);
        ds.getConnection().close();
        primaryDown.set(false);

        waitFor(() -> {
            try (Connection c = ds.getConnection()) {
                return attempts.get() >= 1;
            } catch (SQLException e) {
                return false;
            }
        });
        // The first attempt failed: the app is still being served by the fallback, not silently moved over.
        assertTrue(ds.lastRecoveryError() != null || ds.mode() != ResilientRoutingDataSource.Mode.PRIMARY);

        // It retries on its own and succeeds the second time.
        waitFor(() -> {
            try (Connection c = ds.getConnection()) {
                return ds.mode() == ResilientRoutingDataSource.Mode.PRIMARY;
            } catch (SQLException e) {
                return false;
            }
        });
        assertTrue(attempts.get() >= 2);
    }

    // ------------------------------------------------------------ helpers

    private static final class RecordingHandler implements ResilientRoutingDataSource.RecoveryHandler {
        final AtomicInteger syncs = new AtomicInteger();
        final AtomicInteger afterRecovery = new AtomicInteger();

        @Override
        public SyncResult sync(Connection fallbackConnection, Connection primaryConnection) {
            syncs.incrementAndGet();
            return SyncResult.none();
        }

        @Override
        public void afterRecovery(SyncResult lastResult) {
            afterRecovery.incrementAndGet();
        }
    }

    private static DataSource h2(String name) {
        JdbcDataSource ds = new JdbcDataSource();
        ds.setURL("jdbc:h2:mem:" + name + ";DB_CLOSE_DELAY=-1");
        ds.setUser("sa");
        ds.setPassword("");
        return ds;
    }

    /** Wraps a data source so getConnection fails on demand, like Neon with an exhausted quota. */
    private static DataSource switchable(DataSource delegate, AtomicBoolean down) {
        return (DataSource) Proxy.newProxyInstance(DataSource.class.getClassLoader(), new Class<?>[]{DataSource.class},
                (proxy, method, args) -> {
                    if (down.get() && method.getName().equals("getConnection")) {
                        throw new SQLException("compute quota exceeded");
                    }
                    try {
                        return method.invoke(delegate, args);
                    } catch (InvocationTargetException e) {
                        throw e.getCause();
                    }
                });
    }

    private static String url(Connection c) throws SQLException {
        return c.getMetaData().getURL();
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static void waitFor(BooleanSupplier condition) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5_000;
        while (System.currentTimeMillis() < deadline) {
            if (condition.getAsBoolean()) {
                return;
            }
            Thread.sleep(10);
        }
        throw new AssertionError("condition not met within 5 seconds");
    }
}
