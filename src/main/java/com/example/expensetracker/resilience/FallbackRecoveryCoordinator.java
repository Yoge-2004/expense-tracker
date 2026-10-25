package com.example.expensetracker.resilience;

import com.example.expensetracker.service.DatabaseSnapshotService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Connects {@link FallbackSyncEngine} to the running application.
 *
 * <ul>
 *   <li>keeps the local fallback a faithful copy of the primary (schema, rows, baseline) while the primary is healthy;</li>
 *   <li>merges what was written to the fallback back into the primary when it recovers, before traffic moves over;</li>
 *   <li>protects the Hugging Face snapshot from being overwritten while unmerged fallback writes exist.</li>
 * </ul>
 *
 * <p>Everything here is a no-op when the application runs against a single database (for example H2 in tests),
 * because there is then no routing data source and nothing to merge.</p>
 */
@Component
public class FallbackRecoveryCoordinator implements ResilientRoutingDataSource.RecoveryHandler {

    private static final Logger log = LoggerFactory.getLogger(FallbackRecoveryCoordinator.class);

    private final ResilientRoutingDataSource routing;
    private final DatabaseSnapshotService snapshotService;
    private final FallbackSyncEngine engine = new FallbackSyncEngine();
    private final ReentrantLock lock = new ReentrantLock();

    private volatile SyncResult lastResult;
    private volatile Instant lastSyncAt;
    private volatile Instant lastRefreshAt;
    private volatile String lastError;

    public FallbackRecoveryCoordinator(DataSource dataSource, DatabaseSnapshotService snapshotService) {
        this.routing = dataSource instanceof ResilientRoutingDataSource r ? r : null;
        this.snapshotService = snapshotService;
        if (routing != null) {
            routing.setRecoveryHandler(this);
        }
    }

    public boolean isActive() {
        return routing != null;
    }

    public ResilientRoutingDataSource.Mode mode() {
        return routing == null ? ResilientRoutingDataSource.Mode.PRIMARY : routing.mode();
    }

    // ------------------------------------------------------------------ startup

    /**
     * Runs before the Hugging Face snapshot is restored into the fallback. Creates the bookkeeping tables, mirrors
     * the primary's schema, and deals with writes a previous run left unmerged.
     *
     * @return true when the snapshot restore must be skipped because the local fallback holds newer unmerged writes
     */
    public boolean prepareFallback() {
        if (routing == null) {
            return false;
        }
        lock.lock();
        try (Connection fallback = routing.fallbackDataSource().getConnection()) {
            engine.ensureSupportTables(fallback);
            boolean primaryUp = routing.mode() == ResilientRoutingDataSource.Mode.PRIMARY;
            if (primaryUp) {
                try (Connection primary = routing.primaryDataSource().getConnection()) {
                    repairPostgresSchema(primary);
                    engine.ensureSchema(primary, fallback);
                }
            }
            if (engine.hasBaseline(fallback)) {
                int pending = engine.pendingChanges(fallback);
                if (pending > 0) {
                    if (!primaryUp) {
                        log.warn("Fallback holds {} unmerged write(s) from an earlier outage and the primary is still down; "
                                + "keeping them instead of restoring the older snapshot.", pending);
                        return true;
                    }
                    try (Connection primary = routing.primaryDataSource().getConnection()) {
                        record(engine.syncBack(fallback, primary));
                    } catch (SQLException e) {
                        lastError = message(e);
                        log.warn("Could not merge {} unmerged fallback write(s) at startup ({}); keeping them for now.", pending, lastError);
                        return true;
                    }
                }
                // The snapshot restore brings its own baseline, or one is recorded right after it.
                engine.clearBaseline(fallback);
            }
            return false;
        } catch (Exception e) {
            lastError = message(e);
            log.warn("Could not prepare the emergency fallback database: {}", lastError);
            return false;
        } finally {
            lock.unlock();
        }
    }

    /** Runs after the snapshot restore (whether or not it found a snapshot). Safe to call repeatedly. */
    public void afterSnapshotRestored() {
        if (routing == null) {
            return;
        }
        lock.lock();
        try (Connection fallback = routing.fallbackDataSource().getConnection()) {
            engine.ensureSupportTables(fallback);
            if (!engine.hasBaseline(fallback)) {
                int rows = engine.recordBaseline(fallback);
                log.info("Recorded the fallback baseline ({} rows).", rows);
            }
            engine.restartIdentities(fallback);
            if (routing.mode() == ResilientRoutingDataSource.Mode.PRIMARY && engine.pendingChanges(fallback) > 0) {
                try (Connection primary = routing.primaryDataSource().getConnection()) {
                    record(engine.syncBack(fallback, primary));
                }
            }
        } catch (Exception e) {
            lastError = message(e);
            log.warn("Could not finish preparing the emergency fallback database: {}", lastError);
        } finally {
            lock.unlock();
        }
    }

    // ------------------------------------------------------------------ backups

    /**
     * Called before a backup exports the primary. Returns false when the fallback still holds writes that could not
     * be merged, in which case the existing snapshot (which contains them) must not be replaced.
     */
    public boolean safeToOverwriteSnapshot() {
        if (routing == null || routing.mode() != ResilientRoutingDataSource.Mode.PRIMARY) {
            return true; // while on the fallback, the export comes from the fallback itself
        }
        lock.lock();
        try (Connection fallback = routing.fallbackDataSource().getConnection()) {
            int pending;
            try {
                pending = engine.pendingChanges(fallback);
            } catch (Exception e) {
                log.error("Could not check the fallback for unmerged writes; continuing with the backup: {}", message(e));
                return true;
            }
            if (pending == 0) {
                return true;
            }
            log.warn("{} unmerged fallback write(s) found while the primary is healthy; merging before the next backup.", pending);
            try (Connection primary = routing.primaryDataSource().getConnection()) {
                record(engine.syncBack(fallback, primary));
                return engine.pendingChanges(fallback) == 0;
            } catch (Exception e) {
                lastError = message(e);
                log.warn("Merge failed ({}); the existing snapshot is kept so the unmerged writes are not lost.", lastError);
                return false;
            }
        } catch (Exception e) {
            log.error("Could not open the fallback database; continuing with the backup: {}", message(e));
            return true;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Mirrors a fresh export of the primary into the fallback: schema, rows, baseline and identity gap.
     *
     * @return true when the fallback is now a current mirror (or there is nothing to mirror)
     */
    public boolean refreshFallback(Path sqliteSnapshot) {
        if (routing == null) {
            return true;
        }
        if (routing.mode() != ResilientRoutingDataSource.Mode.PRIMARY) {
            return false;
        }
        lock.lock();
        try (Connection primary = routing.primaryDataSource().getConnection();
             Connection fallback = routing.fallbackDataSource().getConnection()) {
            if (engine.pendingChanges(fallback) > 0) {
                record(engine.syncBack(fallback, primary));
                if (engine.pendingChanges(fallback) > 0) {
                    log.warn("Skipping the fallback refresh: unmerged writes remain.");
                    return false;
                }
            }
            engine.ensureSchema(primary, fallback);
            int rows = snapshotService.importIntoFallback(sqliteSnapshot);
            engine.recordBaseline(fallback);
            engine.restartIdentities(fallback);
            lastRefreshAt = Instant.now();
            log.info("Emergency fallback refreshed from the primary: {} rows.", rows);
            return true;
        } catch (Exception e) {
            lastError = message(e);
            log.warn("Could not refresh the emergency fallback database: {}", lastError);
            return false;
        } finally {
            lock.unlock();
        }
    }

    // ------------------------------------------------------------------ recovery (called by the routing data source)

    @Override
    public SyncResult sync(Connection fallback, Connection primary) throws SQLException {
        lock.lock();
        try {
            SyncResult result = engine.syncBack(fallback, primary);
            record(result);
            return result;
        } finally {
            lock.unlock();
        }
    }

    @Override
    @SuppressWarnings("java:S5443") // Temp file is created with owner-only POSIX permissions (rw-------) with permission fallback
    public void afterRecovery(SyncResult lastResult) {
        Path export = null;
        try {
            try {
                java.nio.file.attribute.FileAttribute<java.util.Set<java.nio.file.attribute.PosixFilePermission>> attr =
                        java.nio.file.attribute.PosixFilePermissions.asFileAttribute(
                                java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                export = Files.createTempFile("fallback-refresh-", ".sqlite", attr);
            } catch (UnsupportedOperationException | SecurityException e) {
                export = Files.createTempFile("fallback-refresh-", ".sqlite");
                java.io.File f = export.toFile();
                f.setReadable(true, true);
                f.setWritable(true, true);
            }
            int rows = snapshotService.exportCurrentDatabase(export);
            if (rows > 0) {
                refreshFallback(export);
            }
        } catch (Exception e) {
            log.warn("Could not re-mirror the fallback right after recovery: {}", message(e));
        } finally {
            if (export != null) {
                try {
                    Files.deleteIfExists(export);
                } catch (Exception ignored) {
                    // temp file; the OS cleans it up eventually
                }
            }
        }
    }

    // ------------------------------------------------------------------ status

    /** Operator-facing view for the sync status endpoint. */
    public Map<String, Object> diagnostics() {
        Map<String, Object> info = new LinkedHashMap<>();
        if (routing == null) {
            info.put("mode", "SINGLE_DATABASE");
            return info;
        }
        info.put("mode", routing.mode().name());
        info.put("lastModeChange", routing.lastModeChange().toString());
        info.put("lastRecoveryError", routing.lastRecoveryError() != null ? routing.lastRecoveryError() : "none");
        info.put("lastRefreshAt", lastRefreshAt != null ? lastRefreshAt.toString() : "never");
        info.put("lastSyncAt", lastSyncAt != null ? lastSyncAt.toString() : "never");
        SyncResult r = lastResult;
        if (r != null) {
            info.put("lastSync", Map.of("inserted", r.inserted(), "updated", r.updated(), "deleted", r.deleted(),
                    "alreadyPresent", r.skipped(), "conflicts", r.conflicts()));
        }
        info.put("lastError", lastError != null ? lastError : "none");
        if (lock.tryLock()) {
            try (Connection fallback = routing.fallbackDataSource().getConnection()) {
                info.put("pendingFallbackChanges", engine.pendingChanges(fallback));
                info.put("conflictsAwaitingReview", engine.conflictCount(fallback));
            } catch (Exception e) {
                info.put("pendingFallbackChanges", "unknown");
            } finally {
                lock.unlock();
            }
        }
        return info;
    }

    private void record(SyncResult result) {
        lastResult = result;
        lastSyncAt = Instant.now();
        if (result.conflicts() > 0) {
            log.warn("{} fallback row(s) could not be merged into the primary and are held in fb_conflicts for review.", result.conflicts());
        }
    }

    private static String message(Exception e) {
        String m = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage().replaceAll("[\\r\\n]+", " ");
        return m.length() > 300 ? m.substring(0, 300) : m;
    }

    private void repairPostgresSchema(Connection pg) {
        try {
            java.sql.DatabaseMetaData md = pg.getMetaData();
            repairPgColumn(pg, md, "webauthn_challenges", "request_json", true);
            repairPgColumn(pg, md, "webauthn_credentials", "public_key_cose", false);
        } catch (Exception e) {
            log.debug("PostgreSQL WebAuthn schema check skipped: {}", e.getMessage());
        }
    }

    @SuppressWarnings("java:S2077")
    private void repairPgColumn(Connection pg, java.sql.DatabaseMetaData md, String table, String col, boolean clearEphemeral) {
        if (table == null || !table.matches("^[a-zA-Z0-9_]+$") || col == null || !col.matches("^[a-zA-Z0-9_]+$")) {
            throw new IllegalArgumentException("Invalid SQL identifier for column repair: " + table + "." + col);
        }
        try (java.sql.ResultSet rs = md.getColumns(pg.getCatalog(), pg.getSchema(), table, col)) {
            if (rs.next()) {
                String typeName = rs.getString("TYPE_NAME");
                if ("oid".equalsIgnoreCase(typeName)) {
                    try (java.sql.Statement s = pg.createStatement()) {
                        if (clearEphemeral) {
                            s.execute("DELETE FROM \"" + table + "\"");
                        }
                        s.execute("ALTER TABLE \"" + table + "\" ALTER COLUMN \"" + col + "\" TYPE TEXT USING \"" + col + "\"::text");
                        log.info("Migrated PostgreSQL column {}.{} from oid to TEXT", table, col);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Could not alter PostgreSQL column {}.{}: {}", table, col, e.getMessage());
        }
    }
}
