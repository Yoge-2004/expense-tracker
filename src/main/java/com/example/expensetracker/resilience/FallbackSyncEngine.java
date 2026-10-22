package com.example.expensetracker.resilience;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

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
 * <p>This class is plain JDBC and holds no state, so it can be used with any two connections.</p>
 */
public final class FallbackSyncEngine {

    private static final Logger log = LoggerFactory.getLogger(FallbackSyncEngine.class);

    public static final String BASELINE_TABLE = "fb_baseline";
    public static final String BASELINE_TABLES_TABLE = "fb_baseline_tables";
    public static final String CONFLICT_TABLE = "fb_conflicts";

    /** Ids created in the fallback start this far above the highest id mirrored from the primary. */
    public static final long ID_GAP = 1_000_000L;

    private static final Pattern SAFE_IDENTIFIER = Pattern.compile("^[a-zA-Z0-9_$]+$");
    private static final String SEP = "\u001f";
    private static final String NULL_MARK = "\u0000";
    private static final int MAX_KEY_LENGTH = 900;
    private static final int BATCH = 200;

    private static final Set<String> SUPPORT_TABLES = Set.of(BASELINE_TABLE, BASELINE_TABLES_TABLE, CONFLICT_TABLE);

    // ---------------------------------------------------------------- metadata model

    private record Col(String name, int type, String typeName, int size, int scale, boolean nullable, boolean auto) {
        String lower() {
            return name.toLowerCase(Locale.ROOT);
        }
    }

    private record Tbl(String name, List<Col> cols, List<String> pk) {
        Col col(String lowerName) {
            for (Col c : cols) {
                if (c.lower().equals(lowerName)) {
                    return c;
                }
            }
            return null;
        }
    }

    private static final class Change {
        final String key;
        final String hash;
        final boolean isNew;
        final Map<String, Object> values; // lower-case column name -> value read from the fallback

        Change(String key, String hash, boolean isNew, Map<String, Object> values) {
            this.key = key;
            this.hash = hash;
            this.isNew = isNew;
            this.values = values;
        }
    }

    private static final class TableDelta {
        final Tbl table;
        final List<Change> upserts = new ArrayList<>();
        final List<String> deletedKeys = new ArrayList<>();

        TableDelta(Tbl table) {
            this.table = table;
        }

        int size() {
            return upserts.size() + deletedKeys.size();
        }
    }

    private static final class Conflict {
        final String table;
        final String key;
        final String operation;
        final String reason;
        final String rowJson;

        Conflict(String table, String key, String operation, String reason, String rowJson) {
            this.table = table;
            this.key = key;
            this.operation = operation;
            this.reason = reason;
            this.rowJson = rowJson;
        }
    }

    // ---------------------------------------------------------------- support tables

    /** Creates the bookkeeping tables in the fallback database (idempotent). */
    public void ensureSupportTables(Connection h2) throws SQLException {
        try (Statement s = h2.createStatement()) {
            s.execute("CREATE TABLE IF NOT EXISTS \"" + BASELINE_TABLE + "\" ("
                    + "\"table_name\" VARCHAR(200) NOT NULL, \"row_key\" VARCHAR(1000) NOT NULL, "
                    + "\"row_hash\" VARCHAR(64) NOT NULL, PRIMARY KEY (\"table_name\", \"row_key\"))");
            s.execute("CREATE TABLE IF NOT EXISTS \"" + BASELINE_TABLES_TABLE + "\" ("
                    + "\"table_name\" VARCHAR(200) NOT NULL PRIMARY KEY, \"hashed_columns\" VARCHAR(4000) NOT NULL)");
            s.execute("CREATE TABLE IF NOT EXISTS \"" + CONFLICT_TABLE + "\" ("
                    + "\"id\" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, \"table_name\" VARCHAR(200), "
                    + "\"row_key\" VARCHAR(1000), \"operation\" VARCHAR(16), \"reason\" VARCHAR(1000), "
                    + "\"row_json\" VARCHAR(100000), \"recorded_at\" TIMESTAMP)");
        }
        repairSchema(h2);
        if (!h2.getAutoCommit()) {
            h2.commit();
        }
    }

    private void repairSchema(Connection h2) {
        repairColumnType(h2, "WEBAUTHN_CHALLENGES", "REQUEST_JSON");
        repairColumnType(h2, "webauthn_challenges", "request_json");
        repairColumnType(h2, "WEBAUTHN_CREDENTIALS", "PUBLIC_KEY_COSE");
        repairColumnType(h2, "webauthn_credentials", "public_key_cose");
    }

    private void repairColumnType(Connection h2, String table, String col) {
        try {
            DatabaseMetaData md = h2.getMetaData();
            try (ResultSet rs = md.getColumns(h2.getCatalog(), h2.getSchema(), table, col)) {
                if (rs.next()) {
                    int dataType = rs.getInt("DATA_TYPE");
                    if (dataType != Types.VARCHAR && dataType != Types.CLOB && dataType != Types.LONGVARCHAR) {
                        try (Statement s = h2.createStatement()) {
                            s.execute("ALTER TABLE " + q(rs.getString("TABLE_NAME")) + " ALTER COLUMN " + q(rs.getString("COLUMN_NAME")) + " SET DATA TYPE TEXT");
                            log.info("Repaired fallback column {}.{} from type {} to TEXT", rs.getString("TABLE_NAME"), rs.getString("COLUMN_NAME"), dataType);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not repair fallback column {}.{}: {}", table, col, e.getMessage());
        }
    }

    // ---------------------------------------------------------------- schema mirroring

    /**
     * Makes sure the fallback has every table and column the primary has. Tables are created from the
     * primary's metadata, so this works even when nothing ever created the entity tables in the fallback.
     */
    public void ensureSchema(Connection primary, Connection h2) throws SQLException {
        ensureSupportTables(h2);
        Map<String, String> existing = new HashMap<>();
        for (String name : tableNames(h2)) {
            existing.put(name.toLowerCase(Locale.ROOT), name);
        }
        for (String name : tableNames(primary)) {
            Tbl source = loadTable(primary, name);
            String actual = existing.get(name.toLowerCase(Locale.ROOT));
            if (actual == null) {
                createTable(h2, source);
                log.info("Fallback schema: created table {}", name);
            } else {
                Tbl target = loadTable(h2, actual);
                for (Col col : source.cols()) {
                    if (target.col(col.lower()) == null) {
                        try (Statement s = h2.createStatement()) {
                            s.execute("ALTER TABLE " + q(actual) + " ADD COLUMN IF NOT EXISTS " + q(upper(col.name()))
                                    + " " + h2Type(col, false));
                        }
                        log.info("Fallback schema: added column {}.{}", actual, col.name());
                    }
                }
            }
        }
        if (!h2.getAutoCommit()) {
            h2.commit();
        }
    }

    private void createTable(Connection h2, Tbl t) throws SQLException {
        List<String> defs = new ArrayList<>();
        boolean singleAutoPk = t.pk().size() == 1 && isAuto(t, t.pk().get(0));
        for (Col c : t.cols()) {
            boolean identity = singleAutoPk && c.lower().equals(t.pk().get(0).toLowerCase(Locale.ROOT));
            String def = q(upper(c.name())) + " " + h2Type(c, identity);
            if (!c.nullable() && !identity) {
                def += " NOT NULL";
            }
            defs.add(def);
        }
        if (!t.pk().isEmpty()) {
            List<String> pk = new ArrayList<>();
            for (String p : t.pk()) {
                pk.add(q(upper(p)));
            }
            defs.add("PRIMARY KEY (" + String.join(", ", pk) + ")");
        }
        try (Statement s = h2.createStatement()) {
            s.execute("CREATE TABLE " + q(upper(t.name())) + " (" + String.join(", ", defs) + ")");
        }
    }

    /**
     * H2 folds unquoted identifiers to upper case, even in PostgreSQL mode, and the application's SQL is unquoted.
     * Mirrored tables and columns are therefore created upper case, exactly as Hibernate creates them in H2.
     */
    private static String upper(String identifier) {
        return identifier.toUpperCase(Locale.ROOT);
    }

    private static boolean isAuto(Tbl t, String pkColumn) {
        Col c = t.col(pkColumn.toLowerCase(Locale.ROOT));
        return c != null && c.auto() && (c.type() == Types.BIGINT || c.type() == Types.INTEGER || c.type() == Types.SMALLINT);
    }

    private static String h2Type(Col c, boolean identity) {
        String base;
        switch (c.type()) {
            case Types.BIGINT -> base = "oid".equalsIgnoreCase(c.typeName()) ? "TEXT" : "BIGINT";
            case Types.INTEGER -> base = "oid".equalsIgnoreCase(c.typeName()) ? "TEXT" : "INTEGER";
            case Types.SMALLINT -> base = "SMALLINT";
            case Types.TINYINT -> base = "TINYINT";
            case Types.BIT, Types.BOOLEAN -> base = "BOOLEAN";
            case Types.NUMERIC, Types.DECIMAL -> {
                boolean unconstrained = c.size() <= 0 || c.size() > 100;
                int precision = unconstrained ? 38 : c.size();
                int scale = unconstrained ? 10 : Math.max(0, Math.min(c.scale(), precision));
                base = "NUMERIC(" + precision + "," + scale + ")";
            }
            case Types.FLOAT, Types.DOUBLE -> base = "DOUBLE PRECISION";
            case Types.REAL -> base = "REAL";
            case Types.DATE -> base = "DATE";
            case Types.TIME, Types.TIME_WITH_TIMEZONE -> base = "TIME";
            case Types.TIMESTAMP -> base = "TIMESTAMP";
            case Types.TIMESTAMP_WITH_TIMEZONE -> base = "TIMESTAMP WITH TIME ZONE";
            case Types.CLOB, Types.NCLOB, Types.LONGVARCHAR, Types.LONGNVARCHAR -> base = "TEXT";
            case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY, Types.BLOB -> base = "VARBINARY";
            case Types.VARCHAR, Types.CHAR, Types.NVARCHAR, Types.NCHAR -> {
                if ("text".equalsIgnoreCase(c.typeName())) {
                    base = "TEXT";
                } else {
                    boolean bounded = c.size() > 0 && c.size() < 100_000_000;
                    base = bounded ? "VARCHAR(" + c.size() + ")" : "VARCHAR";
                }
            }
            default -> {
                if ("uuid".equalsIgnoreCase(c.typeName())) {
                    base = "UUID";
                } else if ("oid".equalsIgnoreCase(c.typeName()) || "text".equalsIgnoreCase(c.typeName())
                        || "json".equalsIgnoreCase(c.typeName()) || "jsonb".equalsIgnoreCase(c.typeName())) {
                    base = "TEXT";
                } else {
                    base = "VARCHAR";
                }
            }
        }
        return identity ? base + " GENERATED BY DEFAULT AS IDENTITY" : base;
    }

    // ---------------------------------------------------------------- identities

    /**
     * Restarts every identity column of the fallback {@link #ID_GAP} above its current maximum, so ids created
     * during an outage stay clear of ids the primary hands out in the meantime.
     */
    public int restartIdentities(Connection h2) throws SQLException {
        int restarted = 0;
        for (String name : tableNames(h2)) {
            Tbl t = loadTable(h2, name);
            if (t.pk().size() != 1 || !isAuto(t, t.pk().get(0))) {
                continue;
            }
            String column = t.col(t.pk().get(0).toLowerCase(Locale.ROOT)).name();
            long max = 0;
            try (Statement s = h2.createStatement();
                 ResultSet rs = s.executeQuery("SELECT COALESCE(MAX(" + q(column) + "), 0) FROM " + q(name))) {
                if (rs.next()) {
                    max = rs.getLong(1);
                }
            }
            try (Statement s = h2.createStatement()) {
                s.execute("ALTER TABLE " + q(name) + " ALTER COLUMN " + q(column)
                        + " RESTART WITH " + (max + ID_GAP + 1));
                restarted++;
            }
        }
        if (!h2.getAutoCommit()) {
            h2.commit();
        }
        return restarted;
    }

    // ---------------------------------------------------------------- baseline

    /** True when a baseline has been recorded, so changes can be detected. */
    public boolean hasBaseline(Connection h2) throws SQLException {
        ensureSupportTables(h2);
        try (Statement s = h2.createStatement();
             ResultSet rs = s.executeQuery("SELECT COUNT(*) FROM " + q(BASELINE_TABLES_TABLE))) {
            return rs.next() && rs.getLong(1) > 0;
        }
    }

    /**
     * Forgets the baseline. Used right before a snapshot is restored: a baseline describes one particular copy of the
     * data, so keeping it across a restore would make every restored row look edited or deleted.
     */
    public void clearBaseline(Connection h2) throws SQLException {
        ensureSupportTables(h2);
        try (Statement s = h2.createStatement()) {
            s.execute("DELETE FROM " + q(BASELINE_TABLE));
            s.execute("DELETE FROM " + q(BASELINE_TABLES_TABLE));
        }
        if (!h2.getAutoCommit()) {
            h2.commit();
        }
    }

    /** Records the current state of every fallback table as the point later changes are measured against. */
    public int recordBaseline(Connection h2) throws SQLException {
        ensureSupportTables(h2);
        boolean previous = h2.getAutoCommit();
        h2.setAutoCommit(false);
        int rows = 0;
        try {
            try (Statement s = h2.createStatement()) {
                s.execute("DELETE FROM " + q(BASELINE_TABLE));
                s.execute("DELETE FROM " + q(BASELINE_TABLES_TABLE));
            }
            try (PreparedStatement tables = h2.prepareStatement("INSERT INTO " + q(BASELINE_TABLES_TABLE)
                    + " (\"table_name\", \"hashed_columns\") VALUES (?, ?)");
                 PreparedStatement insert = h2.prepareStatement("INSERT INTO " + q(BASELINE_TABLE)
                         + " (\"table_name\", \"row_key\", \"row_hash\") VALUES (?, ?, ?)")) {
                for (String name : tableNames(h2)) {
                    Tbl t = loadTable(h2, name);
                    if (t.pk().isEmpty()) {
                        log.warn("Fallback sync: table {} has no primary key and is not synchronised.", name);
                        continue;
                    }
                    List<String> hashed = hashedColumns(t);
                    tables.setString(1, name);
                    tables.setString(2, String.join(",", hashed));
                    tables.addBatch();
                    int pending = 0;
                    try (Statement s = h2.createStatement();
                         ResultSet rs = s.executeQuery("SELECT * FROM " + q(name))) {
                        while (rs.next()) {
                            Map<String, Object> values = readRow(rs, t);
                            insert.setString(1, name);
                            insert.setString(2, rowKey(t, values));
                            insert.setString(3, rowHash(hashed, values));
                            insert.addBatch();
                            rows++;
                            if (++pending % BATCH == 0) {
                                insert.executeBatch();
                            }
                        }
                    }
                    insert.executeBatch();
                }
                tables.executeBatch();
            }
            h2.commit();
        } catch (SQLException | RuntimeException e) {
            h2.rollback();
            throw e;
        } finally {
            h2.setAutoCommit(previous);
        }
        return rows;
    }

    // ---------------------------------------------------------------- delta

    /** Number of rows that were created, edited or deleted in the fallback since the baseline. */
    public int pendingChanges(Connection h2) throws SQLException {
        if (!hasBaseline(h2)) {
            return 0;
        }
        int total = 0;
        for (TableDelta d : computeDelta(h2).values()) {
            total += d.size();
        }
        return total;
    }

    private Map<String, TableDelta> computeDelta(Connection h2) throws SQLException {
        Map<String, TableDelta> deltas = new LinkedHashMap<>();
        Map<String, List<String>> baselineColumns = new HashMap<>();
        try (Statement s = h2.createStatement();
             ResultSet rs = s.executeQuery("SELECT \"table_name\", \"hashed_columns\" FROM " + q(BASELINE_TABLES_TABLE))) {
            while (rs.next()) {
                String cols = rs.getString(2);
                baselineColumns.put(rs.getString(1), cols.isEmpty() ? List.of() : List.of(cols.split(",")));
            }
        }
        for (String name : tableNames(h2)) {
            Tbl t = loadTable(h2, name);
            if (t.pk().isEmpty()) {
                continue;
            }
            List<String> hashed = baselineColumns.get(name);
            if (hashed == null) {
                hashed = hashedColumns(t); // table created after the baseline: every row is new
            }
            Map<String, String> baseline = new HashMap<>();
            try (PreparedStatement ps = h2.prepareStatement("SELECT \"row_key\", \"row_hash\" FROM "
                    + q(BASELINE_TABLE) + " WHERE \"table_name\" = ?")) {
                ps.setString(1, name);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        baseline.put(rs.getString(1), rs.getString(2));
                    }
                }
            }
            TableDelta delta = new TableDelta(t);
            Set<String> seen = new HashSet<>();
            try (Statement s = h2.createStatement(); ResultSet rs = s.executeQuery("SELECT * FROM " + q(name))) {
                while (rs.next()) {
                    Map<String, Object> values = readRow(rs, t);
                    String key = rowKey(t, values);
                    String hash = rowHash(hashed, values);
                    seen.add(key);
                    String before = baseline.get(key);
                    if (before == null) {
                        delta.upserts.add(new Change(key, hash, true, values));
                    } else if (!before.equals(hash)) {
                        delta.upserts.add(new Change(key, hash, false, values));
                    }
                }
            }
            for (String key : baseline.keySet()) {
                if (!seen.contains(key)) {
                    delta.deletedKeys.add(key);
                }
            }
            if (delta.size() > 0) {
                deltas.put(name, delta);
            }
        }
        return deltas;
    }

    // ---------------------------------------------------------------- merge

    /**
     * Writes every change made in the fallback since the baseline into the primary database, in one transaction.
     * A row the primary rejects (for example a unique-key clash) is recorded in {@code fb_conflicts} and does not
     * stop the rest. The baseline then moves forward for exactly the rows that were handled, so a second call
     * only sees writes made after the first call read the fallback.
     */
    public SyncResult syncBack(Connection h2, Connection primary) throws SQLException {
        long started = System.currentTimeMillis();
        ensureSupportTables(h2);
        if (!hasBaseline(h2)) {
            log.warn("Fallback sync: no baseline recorded; treating the current fallback state as unchanged.");
            recordBaseline(h2);
            return SyncResult.none();
        }
        Map<String, TableDelta> delta = computeDelta(h2);
        if (delta.isEmpty()) {
            return SyncResult.none();
        }

        Map<String, String> primaryNames = new HashMap<>();
        for (String name : tableNames(primary)) {
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
            primaryTables.put(pgName, loadTable(primary, pgName));
            byPrimary.put(pgName, e.getValue());
        }
        List<String> order = dependencyOrder(primary, byPrimary.keySet());

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
                                reason(ex), json(change.values)));
                    }
                }
            }
            List<String> reversed = new ArrayList<>(order);
            java.util.Collections.reverse(reversed);
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
                        conflicts.add(new Conflict(d.table.name(), key, "DELETE", reason(ex), null));
                    }
                }
            }
            if (!tablesWithInserts.isEmpty() && isPostgres(primary)) {
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

        advanceBaseline(h2, delta, conflicts);

        for (Conflict c : conflicts) {
            log.warn("Fallback sync conflict: {} {} on table {} was rejected by the primary database ({}); the row is kept in {}.",
                    c.operation, "row", c.table, c.reason.length() > 40 ? c.reason.substring(0, 40) : c.reason, CONFLICT_TABLE);
        }
        SyncResult result = new SyncResult(inserted, updated, deleted, skipped, conflicts.size(),
                System.currentTimeMillis() - started);
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
        try (PreparedStatement ps = primary.prepareStatement("SELECT 1 FROM " + q(target.name()) + " WHERE " + whereClause(pkCols))) {
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
            List<String> assignments = new ArrayList<>();
            for (Col c : sets) {
                assignments.add(q(c.name()) + " = ?");
            }
            try (PreparedStatement ps = primary.prepareStatement("UPDATE " + q(target.name()) + " SET "
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
            names.add(q(c.name()));
            marks.add("?");
        }
        try (PreparedStatement ps = primary.prepareStatement("INSERT INTO " + q(target.name()) + " ("
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
        try (PreparedStatement ps = primary.prepareStatement("SELECT * FROM " + q(target.name()) + " WHERE " + whereClause(pkCols))) {
            int i = 1;
            for (Col c : pkCols) {
                bind(ps, i++, c, change.values.get(c.lower()));
            }
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return false;
                }
                Map<String, Object> existing = readRow(rs, target);
                for (Map.Entry<String, Object> e : change.values.entrySet()) {
                    if (existing.containsKey(e.getKey()) && !canon(existing.get(e.getKey())).equals(canon(e.getValue()))) {
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
            parts.add("CAST(" + q(target.col(p.toLowerCase(Locale.ROOT)).name()) + " AS VARCHAR(1000))");
        }
        String expression = String.join(" || CHR(31) || ", parts);
        try (PreparedStatement ps = primary.prepareStatement("DELETE FROM " + q(target.name()) + " WHERE " + expression + " = ?")) {
            ps.setString(1, key);
            return ps.executeUpdate();
        }
    }

    private static String whereClause(List<Col> pkCols) {
        List<String> parts = new ArrayList<>();
        for (Col c : pkCols) {
            parts.add(q(c.name()) + " = ?");
        }
        return String.join(" AND ", parts);
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

    private static boolean isPostgres(Connection c) throws SQLException {
        return "PostgreSQL".equalsIgnoreCase(c.getMetaData().getDatabaseProductName());
    }

    private void fixSequence(Connection primary, Tbl t) {
        if (t.pk().size() != 1 || !isAuto(t, t.pk().get(0))) {
            return;
        }
        String column = t.col(t.pk().get(0).toLowerCase(Locale.ROOT)).name();
        try {
            Savepoint sp = primary.setSavepoint();
            try (PreparedStatement ps = primary.prepareStatement("SELECT setval(pg_get_serial_sequence(?, ?), "
                    + "(SELECT COALESCE(MAX(" + q(column) + "), 1) FROM " + q(t.name()) + "))")) {
                ps.setString(1, q(t.name()));
                ps.setString(2, column);
                ps.execute();
                primary.releaseSavepoint(sp);
            } catch (SQLException e) {
                primary.rollback(sp);
                log.warn("Fallback sync: could not advance the id sequence of {}.", t.name());
            }
        } catch (SQLException e) {
            log.warn("Fallback sync: could not advance the id sequence of {}.", t.name());
        }
    }

    private void advanceBaseline(Connection h2, Map<String, TableDelta> delta, List<Conflict> conflicts) throws SQLException {
        boolean previous = h2.getAutoCommit();
        h2.setAutoCommit(false);
        try {
            try (PreparedStatement merge = h2.prepareStatement("MERGE INTO " + q(BASELINE_TABLE)
                    + " (\"table_name\", \"row_key\", \"row_hash\") KEY (\"table_name\", \"row_key\") VALUES (?, ?, ?)");
                 PreparedStatement remove = h2.prepareStatement("DELETE FROM " + q(BASELINE_TABLE)
                         + " WHERE \"table_name\" = ? AND \"row_key\" = ?")) {
                for (Map.Entry<String, TableDelta> e : delta.entrySet()) {
                    for (Change c : e.getValue().upserts) {
                        merge.setString(1, e.getKey());
                        merge.setString(2, c.key);
                        merge.setString(3, c.hash);
                        merge.addBatch();
                    }
                    for (String key : e.getValue().deletedKeys) {
                        remove.setString(1, e.getKey());
                        remove.setString(2, key);
                        remove.addBatch();
                    }
                }
                merge.executeBatch();
                remove.executeBatch();
            }
            if (!conflicts.isEmpty()) {
                try (PreparedStatement ps = h2.prepareStatement("INSERT INTO " + q(CONFLICT_TABLE)
                        + " (\"table_name\", \"row_key\", \"operation\", \"reason\", \"row_json\", \"recorded_at\")"
                        + " VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)")) {
                    for (Conflict c : conflicts) {
                        ps.setString(1, c.table);
                        ps.setString(2, c.key.length() > 1000 ? c.key.substring(0, 1000) : c.key);
                        ps.setString(3, c.operation);
                        ps.setString(4, c.reason.length() > 1000 ? c.reason.substring(0, 1000) : c.reason);
                        ps.setString(5, c.rowJson);
                        ps.addBatch();
                    }
                    ps.executeBatch();
                }
            }
            h2.commit();
        } catch (SQLException | RuntimeException e) {
            h2.rollback();
            throw e;
        } finally {
            h2.setAutoCommit(previous);
        }
    }

    /** Number of merge conflicts the fallback is holding for review. */
    public int conflictCount(Connection h2) throws SQLException {
        ensureSupportTables(h2);
        try (Statement s = h2.createStatement(); ResultSet rs = s.executeQuery("SELECT COUNT(*) FROM " + q(CONFLICT_TABLE))) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    // ---------------------------------------------------------------- ordering

    private List<String> dependencyOrder(Connection primary, Set<String> tables) throws SQLException {
        Map<String, Set<String>> parentsOf = new LinkedHashMap<>();
        Map<String, String> lowerToName = new HashMap<>();
        for (String t : tables) {
            parentsOf.put(t, new LinkedHashSet<>());
            lowerToName.put(t.toLowerCase(Locale.ROOT), t);
        }
        DatabaseMetaData md = primary.getMetaData();
        for (String child : tables) {
            try (ResultSet rs = md.getImportedKeys(primary.getCatalog(), primary.getSchema(), child)) {
                while (rs.next()) {
                    String parent = lowerToName.get(rs.getString("PKTABLE_NAME").toLowerCase(Locale.ROOT));
                    if (parent != null && !parent.equals(child)) {
                        parentsOf.get(child).add(parent);
                    }
                }
            }
        }
        List<String> ordered = new ArrayList<>();
        Set<String> placed = new HashSet<>();
        Deque<String> queue = new ArrayDeque<>(tables);
        int stalled = 0;
        while (!queue.isEmpty() && stalled <= queue.size()) {
            String next = queue.poll();
            if (placed.containsAll(parentsOf.get(next))) {
                ordered.add(next);
                placed.add(next);
                stalled = 0;
            } else {
                queue.add(next);
                stalled++;
            }
        }
        ordered.addAll(queue); // cyclic references: keep the remaining tables in their original order
        return ordered;
    }

    // ---------------------------------------------------------------- hashing and rows

    private static List<String> hashedColumns(Tbl t) {
        List<String> names = new ArrayList<>();
        for (Col c : t.cols()) {
            names.add(c.lower());
        }
        names.sort(Comparator.naturalOrder());
        return names;
    }

    private static Map<String, Object> readRow(ResultSet rs, Tbl t) throws SQLException {
        Map<String, Object> values = new LinkedHashMap<>();
        for (Col c : t.cols()) {
            int idx = rs.findColumn(c.name());
            Object v;
            switch (c.type()) {
                case Types.CLOB, Types.NCLOB -> v = rs.getString(idx);
                case Types.BLOB, Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY -> v = rs.getBytes(idx);
                default -> v = rs.getObject(idx);
            }
            values.put(c.lower(), v);
        }
        return values;
    }

    private static String rowKey(Tbl t, Map<String, Object> values) {
        List<String> parts = new ArrayList<>();
        for (String p : t.pk()) {
            parts.add(canon(values.get(p.toLowerCase(Locale.ROOT))));
        }
        String key = String.join(SEP, parts);
        return key.length() > MAX_KEY_LENGTH ? "k:" + sha256(key) : key;
    }

    private static String rowHash(List<String> columns, Map<String, Object> values) {
        StringBuilder sb = new StringBuilder();
        for (String c : columns) {
            sb.append(canon(values.get(c))).append(SEP);
        }
        return sha256(sb.toString());
    }

    static String canon(Object v) {
        if (v == null) {
            return NULL_MARK;
        }
        if (v instanceof BigDecimal b) {
            return b.signum() == 0 ? "0" : b.stripTrailingZeros().toPlainString();
        }
        if (v instanceof byte[] bytes) {
            return "b:" + Base64.getEncoder().encodeToString(bytes);
        }
        if (v instanceof java.sql.Timestamp ts) {
            return ts.toLocalDateTime().toString();
        }
        return v.toString();
    }

    private static String sha256(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static String json(Map<String, Object> values) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> e : values.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(escape(e.getKey())).append("\":");
            Object v = e.getValue();
            if (v == null) {
                sb.append("null");
            } else {
                sb.append('"').append(escape(canon(v))).append('"');
            }
            if (sb.length() > 90_000) {
                break;
            }
        }
        return sb.append('}').toString();
    }

    private static String escape(String s) {
        StringBuilder sb = new StringBuilder();
        for (char ch : s.toCharArray()) {
            switch (ch) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (ch < 0x20) {
                        sb.append(String.format("\\u%04x", (int) ch));
                    } else {
                        sb.append(ch);
                    }
                }
            }
        }
        return sb.toString();
    }

    private static String reason(SQLException e) {
        String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage().replaceAll("[\\r\\n]+", " ");
        String state = e.getSQLState() == null ? "" : "[" + e.getSQLState() + "] ";
        return state + message;
    }

    // ---------------------------------------------------------------- metadata

    private static String q(String identifier) {
        if (identifier == null || !SAFE_IDENTIFIER.matcher(identifier).matches()) {
            throw new IllegalArgumentException("Unsafe SQL identifier: " + identifier);
        }
        return "\"" + identifier + "\"";
    }

    private List<String> tableNames(Connection c) throws SQLException {
        List<String> names = new ArrayList<>();
        DatabaseMetaData md = c.getMetaData();
        try (ResultSet rs = md.getTables(c.getCatalog(), c.getSchema(), "%", new String[]{"TABLE"})) {
            while (rs.next()) {
                String name = rs.getString("TABLE_NAME");
                String lower = name.toLowerCase(Locale.ROOT);
                if (lower.startsWith("flyway") || lower.startsWith("pg_") || lower.startsWith("sql_")
                        || SUPPORT_TABLES.contains(lower)) {
                    continue;
                }
                names.add(name);
            }
        }
        names.sort(String.CASE_INSENSITIVE_ORDER);
        return names;
    }

    private Tbl loadTable(Connection c, String name) throws SQLException {
        DatabaseMetaData md = c.getMetaData();
        String pattern = name.replace(md.getSearchStringEscape(), md.getSearchStringEscape() + md.getSearchStringEscape())
                .replace("_", md.getSearchStringEscape() + "_")
                .replace("%", md.getSearchStringEscape() + "%");
        List<Col> cols = new ArrayList<>();
        try (ResultSet rs = md.getColumns(c.getCatalog(), c.getSchema(), pattern, "%")) {
            Map<Integer, Col> byPosition = new java.util.TreeMap<>();
            while (rs.next()) {
                if (!name.equalsIgnoreCase(rs.getString("TABLE_NAME"))) {
                    continue;
                }
                String auto = rs.getString("IS_AUTOINCREMENT");
                byPosition.put(rs.getInt("ORDINAL_POSITION"), new Col(
                        rs.getString("COLUMN_NAME"), rs.getInt("DATA_TYPE"), rs.getString("TYPE_NAME"),
                        rs.getInt("COLUMN_SIZE"), rs.getInt("DECIMAL_DIGITS"),
                        rs.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls, "YES".equalsIgnoreCase(auto)));
            }
            cols.addAll(byPosition.values());
        }
        Map<Integer, String> pkBySeq = new java.util.TreeMap<>();
        try (ResultSet rs = md.getPrimaryKeys(c.getCatalog(), c.getSchema(), name)) {
            while (rs.next()) {
                pkBySeq.put(rs.getInt("KEY_SEQ"), rs.getString("COLUMN_NAME"));
            }
        }
        return new Tbl(name, cols, new ArrayList<>(pkBySeq.values()));
    }
}
