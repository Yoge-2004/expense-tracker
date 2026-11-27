package com.example.expensetracker.infrastructure.resilience;

import com.example.expensetracker.infrastructure.resilience.FallbackBaselineStore.Change;
import com.example.expensetracker.infrastructure.resilience.FallbackBaselineStore.Conflict;
import com.example.expensetracker.infrastructure.resilience.FallbackBaselineStore.TableDelta;
import com.example.expensetracker.infrastructure.resilience.FallbackSchemaManager.Col;
import com.example.expensetracker.infrastructure.resilience.FallbackSchemaManager.Tbl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Keeps a local fallback database usable and carries its changes back to the primary database.
 *
 * <p>While the primary database (Neon) is healthy the fallback (H2) is a mirror of it: the same tables,
 * the same rows, and a <em>baseline</em> that records a hash of every row. While the primary is
 * unreachable the application keeps working against the fallback. When the primary returns, rows whose
 * hash differs from the baseline (created, edited or deleted in the fallback) are written back to the
 * primary. Rows the fallback never touched are left alone, so edits made in the primary just before it
 * went down are not overwritten.</p>
 *
 * <p>Identity columns in the fallback restart {@link #ID_GAP} above the highest mirrored id, so rows created
 * during an outage can never collide with rows the primary created after the last refresh.</p>
 *
 * <p>Schema management, baseline tracking, and row encoding are delegated to {@link FallbackSchemaManager},
 * {@link FallbackBaselineStore}, and {@link FallbackRowCodec}.</p>
 */
@SuppressWarnings("java:S2077") // Dynamic SQL uses strictly validated identifiers via FallbackSchemaManager.q
public final class FallbackSyncEngine {

    private static final Logger log = LoggerFactory.getLogger(FallbackSyncEngine.class);

    public static final String BASELINE_TABLE = "fb_baseline";
    public static final String BASELINE_TABLES_TABLE = "fb_baseline_tables";
    public static final String CONFLICT_TABLE = "fb_conflicts";

    /** Ids created in the fallback start this far above the highest id mirrored from the primary. */
    public static final long ID_GAP = 1_000_000L;

    private final FallbackSchemaManager schemaManager;
    private final FallbackBaselineStore baselineStore;

    public FallbackSyncEngine() {
        this.schemaManager = new FallbackSchemaManager();
        this.baselineStore = new FallbackBaselineStore(this.schemaManager);
    }

    /** Creates the bookkeeping tables in the fallback database (idempotent). */
    public void ensureSupportTables(Connection h2) throws SQLException {
        schemaManager.ensureSupportTables(h2);
    }

    /**
     * Makes sure the fallback has every table and column the primary has. Tables are created from the
     * primary's metadata, so this works even when nothing ever created the entity tables in the fallback.
     */
    public void ensureSchema(Connection primary, Connection h2) throws SQLException {
        schemaManager.ensureSchema(primary, h2);
    }

    /**
     * Restarts every identity column of the fallback {@link #ID_GAP} above its current maximum, so ids created
     * during an outage stay clear of ids the primary hands out in the meantime.
     */
    public int restartIdentities(Connection h2) throws SQLException {
        return schemaManager.restartIdentities(h2);
    }

    /** True when a baseline has been recorded, so changes can be detected. */
    public boolean hasBaseline(Connection h2) throws SQLException {
        return baselineStore.hasBaseline(h2);
    }

    /**
     * Forgets the baseline. Used right before a snapshot is restored: a baseline describes one particular copy of the
     * data, so keeping it across a restore would make every restored row look edited or deleted.
     */
    public void clearBaseline(Connection h2) throws SQLException {
        baselineStore.clearBaseline(h2);
    }

    /** Records the current state of every fallback table as the point later changes are measured against. */
    public int recordBaseline(Connection h2) throws SQLException {
        return baselineStore.recordBaseline(h2);
    }

    /** Number of rows that were created, edited or deleted in the fallback since the baseline. */
    public int pendingChanges(Connection h2) throws SQLException {
        return baselineStore.pendingChanges(h2);
    }

    /** Number of merge conflicts the fallback is holding for review. */
    public int conflictCount(Connection h2) throws SQLException {
        return baselineStore.conflictCount(h2);
    }

    static String canon(Object v) {
        return FallbackRowCodec.canon(v);
    }

    /**
     * Writes every change made in the fallback since the baseline into the primary database, in one transaction.
     * A row the primary rejects (for example a unique-key clash) is recorded in {@code fb_conflicts} and does not
     * stop the rest. The baseline then moves forward for exactly the rows that were handled, so a second call
     * only sees writes made after the first call read the fallback.
     */
    public SyncResult syncBack(Connection h2, Connection primary) throws SQLException {
        long startedNanos = System.nanoTime();
        schemaManager.ensureSupportTables(h2);
        if (!baselineStore.hasBaseline(h2)) {
            log.warn("Fallback sync: no baseline recorded; treating the current fallback state as unchanged.");
            baselineStore.recordBaseline(h2);
            return SyncResult.none();
        }
        Map<String, TableDelta> delta = baselineStore.computeDelta(h2);
        if (delta.isEmpty()) {
            return SyncResult.none();
        }

        Map<String, String> primaryNames = new HashMap<>();
        for (String name : schemaManager.tableNames(primary)) {
            primaryNames.put(name.toLowerCase(Locale.ROOT), name);
        }
        Map<String, Tbl> primaryTables = new LinkedHashMap<>();
        Map<String, TableDelta> byPrimary = new LinkedHashMap<>();
        for (Map.Entry<String, TableDelta> e : delta.entrySet()) {
            String pgName = primaryNames.get(e.getKey().toLowerCase(Locale.ROOT));
            if (pgName == null) {
                log.warn("Fallback sync: table {} does not exist in the primary database; {} change(s) skipped.",
                        e.getKey(), e.getValue().size());
                continue;
            }
            primaryTables.put(pgName, schemaManager.loadTable(primary, pgName));
            byPrimary.put(pgName, e.getValue());
        }
        List<String> order = schemaManager.dependencyOrder(primary, byPrimary.keySet());

        int inserted = 0;
        int updated = 0;
        int deleted = 0;
        int skipped = 0;
        List<Conflict> conflicts = new ArrayList<>();
        Set<String> tablesWithInserts = new LinkedHashSet<>();

        boolean previous = primary.getAutoCommit();
        primary.setAutoCommit(false);
        try {
            for (String pgName : order) {
                TableDelta d = byPrimary.get(pgName);
                Tbl target = primaryTables.get(pgName);
                for (Change change : d.upserts) {
                    Savepoint sp = primary.setSavepoint();
                    try {
                        int outcome = upsert(primary, target, change);
                        primary.releaseSavepoint(sp);
                        if (outcome == 1) {
                            inserted++;
                            tablesWithInserts.add(pgName);
                        } else if (outcome == 2) {
                            updated++;
                        } else {
                            skipped++;
                        }
                    } catch (SQLException ex) {
                        primary.rollback(sp);
                        conflicts.add(new Conflict(d.table.name(), change.key, change.isNew ? "INSERT" : "UPDATE",
                                FallbackRowCodec.reason(ex), FallbackRowCodec.json(change.values)));
                    }
                }
            }
            List<String> reversed = new ArrayList<>(order);
            Collections.reverse(reversed);
            for (String pgName : reversed) {
                TableDelta d = byPrimary.get(pgName);
                Tbl target = primaryTables.get(pgName);
                for (String key : d.deletedKeys) {
                    Savepoint sp = primary.setSavepoint();
                    try {
                        int count = deleteByKey(primary, target, key);
                        primary.releaseSavepoint(sp);
                        if (count > 0) {
                            deleted++;
                        } else {
                            skipped++;
                        }
                    } catch (SQLException ex) {
                        primary.rollback(sp);
                        conflicts.add(new Conflict(d.table.name(), key, "DELETE", FallbackRowCodec.reason(ex), null));
                    }
                }
            }
            if (!tablesWithInserts.isEmpty() && FallbackSchemaManager.isPostgres(primary)) {
                for (String pgName : tablesWithInserts) {
                    fixSequence(primary, primaryTables.get(pgName));
                }
            }
            primary.commit();
        } catch (SQLException | RuntimeException e) {
            primary.rollback();
            throw e;
        } finally {
            primary.setAutoCommit(previous);
        }

        baselineStore.advanceBaseline(h2, delta, conflicts);

        for (Conflict c : conflicts) {
            log.warn("Fallback sync conflict: {} {} on table {} was rejected by the primary database ({}); the row is kept in {}.",
                    c.operation, "row", c.table, c.reason.length() > 40 ? c.reason.substring(0, 40) : c.reason, CONFLICT_TABLE);
        }
        SyncResult result = new SyncResult(inserted, updated, deleted, skipped, conflicts.size(),
                (System.nanoTime() - startedNanos) / 1_000_000);
        log.info("Fallback sync finished: {} inserted, {} updated, {} deleted, {} already present, {} conflicts in {} ms.",
                inserted, updated, deleted, skipped, conflicts.size(), result.millis());
        return result;
    }

    /** Returns 1 when a row was inserted, 2 when it was updated, 0 when it was already present. */
    private int upsert(Connection primary, Tbl target, Change change) throws SQLException {
        List<Col> pkCols = new ArrayList<>();
        for (String p : target.pk()) {
            pkCols.add(target.col(p.toLowerCase(Locale.ROOT)));
        }
        boolean exists;
        try (PreparedStatement ps = primary.prepareStatement("SELECT 1 FROM "
                + FallbackSchemaManager.q(target.name()) + " WHERE " + whereClause(pkCols))) {
            int i = 1;
            for (Col c : pkCols) {
                bind(ps, i++, c, change.values.get(c.lower()));
            }
            try (ResultSet rs = ps.executeQuery()) {
                exists = rs.next();
            }
        }
        if (exists && change.isNew) {
            // Same key, not in the baseline: either an earlier attempt already wrote this very row, or the primary
            // reused the id for a different row. Only an identical row may be skipped; anything else is reported.
            if (sameRowInPrimary(primary, target, pkCols, change)) {
                return 0;
            }
            throw new SQLException("primary key already used by a different row in the primary database", "23505");
        }
        if (exists) {
            List<Col> sets = new ArrayList<>();
            for (Col c : target.cols()) {
                if (!target.pk().stream().anyMatch(p -> p.equalsIgnoreCase(c.name())) && change.values.containsKey(c.lower())) {
                    sets.add(c);
                }
            }
            if (sets.isEmpty()) {
                return 2;
            }
            List<String> assignments = sets.stream()
                    .map(c -> FallbackSchemaManager.q(c.name()) + " = ?")
                    .toList();
            try (PreparedStatement ps = primary.prepareStatement("UPDATE " + FallbackSchemaManager.q(target.name()) + " SET "
                    + String.join(", ", assignments) + " WHERE " + whereClause(pkCols))) {
                int i = 1;
                for (Col c : sets) {
                    bind(ps, i++, c, change.values.get(c.lower()));
                }
                for (Col c : pkCols) {
                    bind(ps, i++, c, change.values.get(c.lower()));
                }
                ps.executeUpdate();
            }
            return 2;
        }
        List<Col> cols = new ArrayList<>();
        for (Col c : target.cols()) {
            if (change.values.containsKey(c.lower())) {
                cols.add(c);
            }
        }
        List<String> names = new ArrayList<>();
        List<String> marks = new ArrayList<>();
        for (Col c : cols) {
            names.add(FallbackSchemaManager.q(c.name()));
            marks.add("?");
        }
        try (PreparedStatement ps = primary.prepareStatement("INSERT INTO " + FallbackSchemaManager.q(target.name()) + " ("
                + String.join(", ", names) + ") VALUES (" + String.join(", ", marks) + ")")) {
            int i = 1;
            for (Col c : cols) {
                bind(ps, i++, c, change.values.get(c.lower()));
            }
            ps.executeUpdate();
        }
        return 1;
    }

    private boolean sameRowInPrimary(Connection primary, Tbl target, List<Col> pkCols, Change change) throws SQLException {
        try (PreparedStatement ps = primary.prepareStatement("SELECT * FROM "
                + FallbackSchemaManager.q(target.name()) + " WHERE " + whereClause(pkCols))) {
            int i = 1;
            for (Col c : pkCols) {
                bind(ps, i++, c, change.values.get(c.lower()));
            }
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return false;
                }
                Map<String, Object> existing = FallbackRowCodec.readRow(rs, target);
                for (Map.Entry<String, Object> e : change.values.entrySet()) {
                    if (existing.containsKey(e.getKey())
                            && !FallbackRowCodec.canon(existing.get(e.getKey())).equals(FallbackRowCodec.canon(e.getValue()))) {
                        return false;
                    }
                }
                return true;
            }
        }
    }

    private int deleteByKey(Connection primary, Tbl target, String key) throws SQLException {
        if (key.startsWith("k:")) {
            log.warn("Fallback sync: cannot delete a row of {} whose key is too long to reconstruct.", target.name());
            return 0;
        }
        List<String> parts = new ArrayList<>();
        for (String p : target.pk()) {
            Col c = target.col(p.toLowerCase(Locale.ROOT));
            if (c != null) {
                parts.add("CAST(" + FallbackSchemaManager.q(c.name()) + " AS VARCHAR(1000))");
            }
        }
        String expression = String.join(" || CHR(31) || ", parts);
        try (PreparedStatement ps = primary.prepareStatement("DELETE FROM "
                + FallbackSchemaManager.q(target.name()) + " WHERE " + expression + " = ?")) {
            ps.setString(1, key);
            return ps.executeUpdate();
        }
    }

    private void fixSequence(Connection primary, Tbl t) {
        if (t.pk().size() != 1 || !FallbackSchemaManager.isAuto(t, t.pk().getFirst())) {
            return;
        }
        Col c = t.col(t.pk().getFirst().toLowerCase(Locale.ROOT));
        if (c == null) {
            return;
        }
        String column = c.name();
        try {
            Savepoint sp = primary.setSavepoint();
            try (PreparedStatement ps = primary.prepareStatement("SELECT setval(pg_get_serial_sequence(?, ?), "
                    + "(SELECT COALESCE(MAX(" + FallbackSchemaManager.q(column) + "), 1) FROM "
                    + FallbackSchemaManager.q(t.name()) + "))")) {
                ps.setString(1, FallbackSchemaManager.q(t.name()));
                ps.setString(2, column);
                ps.execute();
                primary.releaseSavepoint(sp);
            } catch (SQLException e) {
                primary.rollback(sp);
                log.warn("Fallback sync: savepoint query failed to advance id sequence of {}: {}", t.name(), e.getMessage());
            }
        } catch (SQLException e) {
            log.warn("Fallback sync: savepoint setup failed for id sequence of {}: {}", t.name(), e.getMessage());
        }
    }

    private static String whereClause(List<Col> pkCols) {
        return String.join(" AND ", pkCols.stream().map(c -> FallbackSchemaManager.q(c.name()) + " = ?").toList());
    }

    private static void bind(PreparedStatement ps, int index, Col column, Object value) throws SQLException {
        if (value == null) {
            ps.setNull(index, column.type());
        } else if (needsStringCast(column)) {
            ps.setObject(index, value.toString(), Types.OTHER);
        } else {
            ps.setObject(index, value);
        }
    }

    private static boolean needsStringCast(Col c) {
        if (c.type() != Types.OTHER) {
            return false;
        }
        String t = c.typeName() == null ? "" : c.typeName().toLowerCase(Locale.ROOT);
        return t.equals("uuid") || t.equals("json") || t.equals("jsonb") || t.equals("inet") || t.equals("cidr");
    }
}
