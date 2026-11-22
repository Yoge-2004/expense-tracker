package com.example.expensetracker.infrastructure.resilience;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import javax.sql.DataSource;
import java.io.PrintWriter;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.sql.SQLTransientConnectionException;
import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.StampedLock;



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
    private final Clock clock;

    private final AtomicReference<Mode> mode = new AtomicReference<>(Mode.PRIMARY);
    /** Tracks fallback connections until close, so the final merge waits for active transactions to finish. */
    private final StampedLock fallbackLeaseLock = new StampedLock();
    private volatile RecoveryHandler recoveryHandler;
    private volatile CountDownLatch gate;
    private final AtomicLong nextProbeNanos = new AtomicLong();
    private volatile Instant lastModeChange;
    private volatile String lastRecoveryError;

    public ResilientRoutingDataSource(DataSource primaryDs, DataSource fallbackDs) {
        this(primaryDs, fallbackDs, 15_000, 60_000, 2_000, 15_000, Clock.systemUTC());
    }

    public ResilientRoutingDataSource(DataSource primaryDs, DataSource fallbackDs, Clock clock) {
        this(primaryDs, fallbackDs, 15_000, 60_000, 2_000, 15_000, clock);
    }

    /** Intervals are injectable so the state machine can be tested quickly. */
    public ResilientRoutingDataSource(DataSource primaryDs, DataSource fallbackDs, long retryIntervalMs,
                                      long failedRecoveryBackoffMs, long graceMs, long gateWaitMs) {
        this(primaryDs, fallbackDs, retryIntervalMs, failedRecoveryBackoffMs, graceMs, gateWaitMs, Clock.systemUTC());
    }

    public ResilientRoutingDataSource(DataSource primaryDs, DataSource fallbackDs, long retryIntervalMs,
                                      long failedRecoveryBackoffMs, long graceMs, long gateWaitMs, Clock clock) {
        this.primaryDs = primaryDs;
        this.fallbackDs = fallbackDs;
        this.retryIntervalMs = retryIntervalMs;
        this.failedRecoveryBackoffMs = failedRecoveryBackoffMs;
        this.graceMs = graceMs;
        this.gateWaitMs = gateWaitMs;
        this.clock = clock != null ? clock : Clock.systemUTC();
        this.lastModeChange = Instant.now(this.clock);
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
        while (true) {
            Mode current = mode.get();
            if (current == Mode.PRIMARY) {
                Connection connection = tryPrimary(username, password, explicit);
                if (connection != null) {
                    return connection;
                }
                continue;
            }

            if (current == Mode.FALLBACK) {
                probePrimaryIfDue();
                Connection connection = leasedFallbackConnection(username, password, explicit);
                if (connection != null) return connection;
                continue;
            }

            CountDownLatch recoveryGate = gate;
            if (recoveryGate == null) {
                // Recovery is doing its first merge while requests continue to use the fallback.
                Connection connection = leasedFallbackConnection(username, password, explicit);
                if (connection != null) return connection;
                continue;
            }
            if (!awaitGate(recoveryGate)) {
                throw new SQLTransientConnectionException(
                        "Fallback recovery is still merging writes; retry the database operation.", "08001");
            }
            // The state may now be PRIMARY or FALLBACK. Choose again so a request that
            // waited for a successful recovery cannot accidentally return to the old store.
        }
    }

    private void probePrimaryIfDue() {
        long now = System.nanoTime();
        long nextProbe = nextProbeNanos.get();
        if (primaryDs != null && now >= nextProbe
                && nextProbeNanos.compareAndSet(nextProbe, now + TimeUnit.MILLISECONDS.toNanos(failedRecoveryBackoffMs))) {
            Thread.ofVirtual().name("neon-primary-probe").start(this::probePrimary);
        }
    }

    private Connection leasedFallbackConnection(String username, String password, boolean explicit) throws SQLException {
        long lease = fallbackLeaseLock.readLock();
        try {
            Mode current = mode.get();
            if (current == Mode.PRIMARY || current == Mode.RECOVERING && gate != null) {
                fallbackLeaseLock.unlockRead(lease);
                return null;
            }

            log.debug("Serving the emergency local datastore. This is only a recovery store and may be stale.");
            Connection connection = explicit
                    ? fallbackDs.getConnection(username, password)
                    : fallbackDs.getConnection();
            return trackFallbackLease(connection, lease);
        } catch (SQLException | RuntimeException e) {
            fallbackLeaseLock.unlockRead(lease);
            throw e;
        }
    }

    private Connection trackFallbackLease(Connection connection, long lease) {
        AtomicBoolean closed = new AtomicBoolean();
        return (Connection) Proxy.newProxyInstance(
                Connection.class.getClassLoader(),
                new Class<?>[]{Connection.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("close") && method.getParameterCount() == 0) {
                        if (closed.compareAndSet(false, true)) {
                            try {
                                return method.invoke(connection, args);
                            } catch (InvocationTargetException e) {
                                throw e.getCause();
                            } finally {
                                fallbackLeaseLock.unlockRead(lease);
                            }
                        }
                        return null;
                    }
                    try {
                        return method.invoke(connection, args);
                    } catch (InvocationTargetException e) {
                        throw e.getCause();
                    }
                });
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
            nextProbeNanos.set(System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(retryIntervalMs));
            lastModeChange = Instant.now(clock);
            log.warn("Primary database unavailable; entering emergency fallback mode: {}", reason);
        }
    }

    private void probePrimary() {
        try (Connection probe = primaryDs.getConnection()) {
            if (probe == null || !probe.isValid(5)) {
                nextProbeNanos.set(System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(failedRecoveryBackoffMs));
                return;
            }
        } catch (Exception _) {
            nextProbeNanos.set(System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(failedRecoveryBackoffMs));
            return;
        }
        beginRecovery();
    }

    private void beginRecovery() {
        if (!mode.compareAndSet(Mode.FALLBACK, Mode.RECOVERING)) {
            return;
        }
        lastModeChange = Instant.now(clock);
        RecoveryHandler handler = recoveryHandler;
        if (handler == null) {
            log.info("Primary database restored; switching back from the emergency fallback.");
            mode.set(Mode.PRIMARY);
            return;
        }
        Thread.ofVirtual().name("fallback-recovery").start(() -> runRecovery(handler));
    }

    private void runRecovery(RecoveryHandler handler) {
        SyncResult last = SyncResult.none();
        boolean success = false;
        try (Connection primary = primaryDs.getConnection(); Connection fallback = fallbackDs.getConnection()) {
            log.info("Primary database restored; merging changes made in the emergency fallback before switching back.");
            SyncResult first = handler.sync(fallback, primary);

            CountDownLatch recoveryGate = new CountDownLatch(1);
            gate = recoveryGate;
            long writeStamp = fallbackLeaseLock.tryWriteLock(graceMs, TimeUnit.MILLISECONDS);
            if (writeStamp == 0) {
                throw new SQLException("Fallback connections remained open when the final merge started.");
            }
            try {
                last = handler.sync(fallback, primary);

                lastRecoveryError = null;
                mode.set(Mode.PRIMARY);
                lastModeChange = Instant.now(clock);
                success = true;
                log.info("Switched back to the primary database. Merged during recovery: {} then {}.", first, last);
            } finally {
                fallbackLeaseLock.unlockWrite(writeStamp);
            }
        } catch (InterruptedException _) {
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
        lastModeChange = Instant.now(clock);
        nextProbeNanos.set(System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(failedRecoveryBackoffMs));
    }

    private boolean awaitGate(CountDownLatch g) {
        try {
            if (!g.await(gateWaitMs, TimeUnit.MILLISECONDS)) {
                log.warn("Fallback merge did not finish before the connection wait limit; refusing a fallback "
                        + "connection so writes cannot arrive after the final merge.");
                return false;
            }
        } catch (InterruptedException _) {
            Thread.currentThread().interrupt();
            log.warn("Interrupted while waiting for the fallback merge; refusing a database connection.");
            return false;
        }
        return true;
    }

    private static void closeQuietly(Connection connection) {
        if (connection != null) {
            try {
                connection.close();
            } catch (SQLException _) {
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
