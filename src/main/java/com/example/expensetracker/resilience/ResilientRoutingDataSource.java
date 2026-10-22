package com.example.expensetracker.resilience;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Serves the primary database (Neon) and, while it is unreachable, a local emergency database.
 *
 * <p>When the primary comes back, requests keep being served from the fallback until everything written to the
 * fallback during the outage has been merged into the primary: a first merge runs while the app keeps working,
 * then new connections are held for a moment so a final merge sees every last write, and only then does traffic
 * move back to the primary. If the merge fails the app stays on the fallback and tries again later, so
 * nothing written during an outage is abandoned.</p>
 */
public class ResilientRoutingDataSource implements DataSource {

    private static final Logger log = LoggerFactory.getLogger(ResilientRoutingDataSource.class);

    /** Where requests are currently served from. */
    public enum Mode {
        /** The primary database is healthy and serving requests. */
        PRIMARY,
        /** The primary is unreachable; the local emergency database is serving requests. */
        FALLBACK,
        /** The primary is back; fallback writes are being merged into it before traffic moves over. */
        RECOVERING
    }

    /** Carries the fallback's changes back to the primary. Implemented by the application. */
    public interface RecoveryHandler {
        /** Merges changes made in the fallback into the primary. May be called more than once per recovery. */
        SyncResult sync(Connection fallback, Connection primary) throws SQLException;

        /** Called after traffic has moved back to the primary, e.g. to re-mirror the fallback. */
        void afterRecovery(SyncResult lastResult);
    }

    private final DataSource primaryDs;
    private final DataSource fallbackDs;
    private final long retryIntervalMs;
    private final long failedRecoveryBackoffMs;
    private final long graceMs;
    private final long gateWaitMs;

    private final AtomicReference<Mode> mode = new AtomicReference<>(Mode.PRIMARY);
    private volatile RecoveryHandler recoveryHandler;
    private volatile CountDownLatch gate;
    private volatile long nextProbeAt = 0;
    private volatile Instant lastModeChange = Instant.now();
    private volatile String lastRecoveryError;

    public ResilientRoutingDataSource(DataSource primaryDs, DataSource fallbackDs) {
        this(primaryDs, fallbackDs, 15_000, 60_000, 2_000, 15_000);
    }

    /** Intervals are injectable so the state machine can be tested quickly. */
    public ResilientRoutingDataSource(DataSource primaryDs, DataSource fallbackDs, long retryIntervalMs,
                                      long failedRecoveryBackoffMs, long graceMs, long gateWaitMs) {
        this.primaryDs = primaryDs;
        this.fallbackDs = fallbackDs;
        this.retryIntervalMs = retryIntervalMs;
        this.failedRecoveryBackoffMs = failedRecoveryBackoffMs;
        this.graceMs = graceMs;
        this.gateWaitMs = gateWaitMs;
        if (primaryDs == null) {
            mode.set(Mode.FALLBACK);
        }
    }

    public void setRecoveryHandler(RecoveryHandler handler) {
        this.recoveryHandler = handler;
    }

    public Mode mode() {
        return mode.get();
    }

    public DataSource primaryDataSource() {
        return primaryDs;
    }

    public DataSource fallbackDataSource() {
        return fallbackDs;
    }

    public Instant lastModeChange() {
        return lastModeChange;
    }

    /** Why the last attempt to move back to the primary failed, or null. */
    public String lastRecoveryError() {
        return lastRecoveryError;
    }

    // ------------------------------------------------------------------ routing

    @Override
    public Connection getConnection() throws SQLException {
        return route(null, null, false);
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        return route(username, password, true);
    }

    private Connection route(String username, String password, boolean explicit) throws SQLException {
        Mode current = mode.get();
        if (current == Mode.PRIMARY) {
            Connection connection = tryPrimary(username, password, explicit);
            if (connection != null) {
                return connection;
            }
        } else if (current == Mode.FALLBACK && primaryDs != null && System.currentTimeMillis() >= nextProbeAt) {
            nextProbeAt = System.currentTimeMillis() + retryIntervalMs;
            Thread.ofVirtual().name("neon-primary-probe").start(this::probePrimary);
        }
        awaitGate();
        log.debug("Serving the emergency local datastore. This is only a recovery store and may be stale.");
        return explicit ? fallbackDs.getConnection(username, password) : fallbackDs.getConnection();
    }

    private Connection tryPrimary(String username, String password, boolean explicit) {
        if (primaryDs == null) {
            return null;
        }
        Connection connection = null;
        try {
            connection = explicit ? primaryDs.getConnection(username, password) : primaryDs.getConnection();
            if (connection != null && connection.isValid(5)) {
                return connection;
            }
            closeQuietly(connection);
            throw new SQLException("Primary database returned an invalid connection");
        } catch (Exception e) {
            closeQuietly(connection);
            enterFallback(e.getMessage());
            return null;
        }
    }

    private void enterFallback(String reason) {
        if (mode.compareAndSet(Mode.PRIMARY, Mode.FALLBACK)) {
            nextProbeAt = System.currentTimeMillis() + retryIntervalMs;
            lastModeChange = Instant.now();
            log.warn("Primary database unavailable; entering emergency fallback mode: {}", reason);
        }
    }

    private void probePrimary() {
        try (Connection probe = primaryDs.getConnection()) {
            if (probe == null || !probe.isValid(5)) {
                return;
            }
        } catch (Exception e) {
            return;
        }
        beginRecovery();
    }

    private void beginRecovery() {
        if (!mode.compareAndSet(Mode.FALLBACK, Mode.RECOVERING)) {
            return;
        }
        lastModeChange = Instant.now();
        RecoveryHandler handler = recoveryHandler;
        if (handler == null) {
            log.info("Primary database restored; switching back from the emergency fallback.");
            mode.set(Mode.PRIMARY);
            return;
        }
        Thread worker = new Thread(() -> runRecovery(handler), "fallback-recovery");
        worker.setDaemon(true);
        worker.start();
    }

    private void runRecovery(RecoveryHandler handler) {
        SyncResult last = SyncResult.none();
        boolean success = false;
        try (Connection primary = primaryDs.getConnection(); Connection fallback = fallbackDs.getConnection()) {
            log.info("Primary database restored; merging changes made in the emergency fallback before switching back.");
            SyncResult first = handler.sync(fallback, primary);

            gate = new CountDownLatch(1);
            Thread.sleep(graceMs);
            last = handler.sync(fallback, primary);

            lastRecoveryError = null;
            mode.set(Mode.PRIMARY);
            lastModeChange = Instant.now();
            success = true;
            log.info("Switched back to the primary database. Merged during recovery: {} then {}.", first, last);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            lastRecoveryError = "interrupted";
            fail("interrupted");
        } catch (Exception e) {
            lastRecoveryError = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            fail(lastRecoveryError);
        } finally {
            CountDownLatch g = gate;
            gate = null;
            if (g != null) {
                g.countDown();
            }
        }
        if (success) {
            try {
                handler.afterRecovery(last);
            } catch (RuntimeException e) {
                log.warn("Post-recovery step failed: {}", e.getMessage());
            }
        }
    }

    private void fail(String reason) {
        log.error("Could not merge the fallback into the primary database ({}); staying on the fallback and retrying later.", reason);
        mode.set(Mode.FALLBACK);
        lastModeChange = Instant.now();
        nextProbeAt = System.currentTimeMillis() + failedRecoveryBackoffMs;
    }

    private void awaitGate() {
        CountDownLatch g = gate;
        if (g == null) {
            return;
        }
        try {
            if (!g.await(gateWaitMs, TimeUnit.MILLISECONDS)) {
                log.warn("Gave up waiting for the fallback merge to finish; serving the fallback anyway.");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static void closeQuietly(Connection connection) {
        if (connection != null) {
            try {
                connection.close();
            } catch (SQLException ignored) {
                // nothing useful to do with a connection that will not close
            }
        }
    }

    /** Closes both pools when the application shuts down (Spring calls this as the inferred destroy method). */
    public void close() {
        closePool(primaryDs);
        closePool(fallbackDs);
    }

    private static void closePool(DataSource ds) {
        if (ds instanceof AutoCloseable closeable) {
            try {
                closeable.close();
            } catch (Exception e) {
                log.debug("Could not close a database pool cleanly: {}", e.getMessage());
            }
        }
    }

    // ------------------------------------------------------------------ DataSource plumbing

    @Override
    public PrintWriter getLogWriter() {
        throw new UnsupportedOperationException("getLogWriter");
    }

    @Override
    public void setLogWriter(PrintWriter out) {
        throw new UnsupportedOperationException("setLogWriter");
    }

    @Override
    public void setLoginTimeout(int seconds) {
        throw new UnsupportedOperationException("setLoginTimeout");
    }

    @Override
    public int getLoginTimeout() {
        return 0;
    }

    @Override
    public java.util.logging.Logger getParentLogger() throws SQLFeatureNotSupportedException {
        throw new SQLFeatureNotSupportedException();
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> T unwrap(Class<T> iface) throws SQLException {
        if (iface.isInstance(this)) {
            return (T) this;
        }
        throw new SQLException("DataSource of type [" + getClass().getName() + "] cannot be unwrapped as [" + iface.getName() + "]");
    }

    @Override
    public boolean isWrapperFor(Class<?> iface) {
        return iface.isInstance(this);
    }
}
