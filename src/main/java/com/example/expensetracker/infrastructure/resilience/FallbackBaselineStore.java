package com.example.expensetracker.infrastructure.resilience;

import com.example.expensetracker.infrastructure.resilience.FallbackSchemaManager.Tbl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Manages the fallback database's baseline hashes, delta detection, and conflict bookkeeping.
 */
@SuppressWarnings("java:S2077") // Table/column identifiers are validated via FallbackSchemaManager.q
final class FallbackBaselineStore {

    private static final Logger log = LoggerFactory.getLogger(FallbackBaselineStore.class);
    private static final int BATCH = 200;

    private final FallbackSchemaManager schemaManager;

    FallbackBaselineStore(FallbackSchemaManager schemaManager) {
        this.schemaManager = schemaManager;
    }

    static final class Change {
        final String key;
        final String hash;
        final boolean isNew;
        final Map<String, Object> values;

        Change(String key, String hash, boolean isNew, Map<String, Object> values) {
            this.key = key;
            this.hash = hash;
            this.isNew = isNew;
            this.values = values;
        }
    }

    static final class TableDelta {
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

    static final class Conflict {
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

    boolean hasBaseline(Connection h2) throws SQLException {
        schemaManager.ensureSupportTables(h2);
        try (Statement s = h2.createStatement();
             ResultSet rs = s.executeQuery("SELECT COUNT(*) FROM "
                     + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLES_TABLE))) {
            return rs.next() && rs.getLong(1) > 0;
        }
    }

    void clearBaseline(Connection h2) throws SQLException {
        schemaManager.ensureSupportTables(h2);
        try (Statement s = h2.createStatement()) {
            s.execute("DELETE FROM " + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLE));
            s.execute("DELETE FROM " + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLES_TABLE));
        }
        if (!h2.getAutoCommit()) {
            h2.commit();
        }
    }

    int recordBaseline(Connection h2) throws SQLException {
        schemaManager.ensureSupportTables(h2);
        boolean previous = h2.getAutoCommit();
        h2.setAutoCommit(false);
        int rows = 0;
        try {
            try (Statement s = h2.createStatement()) {
                s.execute("DELETE FROM " + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLE));
                s.execute("DELETE FROM " + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLES_TABLE));
            }
            try (PreparedStatement tables = h2.prepareStatement("INSERT INTO "
                    + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLES_TABLE)
                    + " (\"table_name\", \"hashed_columns\") VALUES (?, ?)");
                 PreparedStatement insert = h2.prepareStatement("INSERT INTO "
                         + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLE)
                         + " (\"table_name\", \"row_key\", \"row_hash\") VALUES (?, ?, ?)")) {
                for (String name : schemaManager.tableNames(h2)) {
                    Tbl t = schemaManager.loadTable(h2, name);
                    if (t.pk().isEmpty()) {
                        log.warn("Fallback sync: table {} has no primary key and is not synchronised.", name);
                        continue;
                    }
                    List<String> hashed = FallbackRowCodec.hashedColumns(t);
                    tables.setString(1, name);
                    tables.setString(2, String.join(",", hashed));
                    tables.addBatch();
                    int pending = 0;
                    try (Statement s = h2.createStatement();
                         ResultSet rs = s.executeQuery("SELECT * FROM " + FallbackSchemaManager.q(name))) {
                        while (rs.next()) {
                            Map<String, Object> values = FallbackRowCodec.readRow(rs, t);
                            insert.setString(1, name);
                            insert.setString(2, FallbackRowCodec.rowKey(t, values));
                            insert.setString(3, FallbackRowCodec.rowHash(hashed, values));
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

    int pendingChanges(Connection h2) throws SQLException {
        if (!hasBaseline(h2)) {
            return 0;
        }
        int total = 0;
        for (TableDelta d : computeDelta(h2).values()) {
            total += d.size();
        }
        return total;
    }

    Map<String, TableDelta> computeDelta(Connection h2) throws SQLException {
        Map<String, TableDelta> deltas = new LinkedHashMap<>();
        Map<String, List<String>> baselineColumns = new HashMap<>();
        try (Statement s = h2.createStatement();
             ResultSet rs = s.executeQuery("SELECT \"table_name\", \"hashed_columns\" FROM "
                     + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLES_TABLE))) {
            while (rs.next()) {
                String cols = rs.getString(2);
                baselineColumns.put(rs.getString(1), cols.isEmpty() ? List.of() : List.of(cols.split(",")));
            }
        }
        for (String name : schemaManager.tableNames(h2)) {
            Tbl t = schemaManager.loadTable(h2, name);
            if (t.pk().isEmpty()) {
                continue;
            }
            List<String> hashed = baselineColumns.get(name);
            if (hashed == null) {
                hashed = FallbackRowCodec.hashedColumns(t);
            }
            Map<String, String> baseline = new HashMap<>();
            try (PreparedStatement ps = h2.prepareStatement("SELECT \"row_key\", \"row_hash\" FROM "
                    + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLE) + " WHERE \"table_name\" = ?")) {
                ps.setString(1, name);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        baseline.put(rs.getString(1), rs.getString(2));
                    }
                }
            }
            TableDelta delta = new TableDelta(t);
            Set<String> seen = new HashSet<>();
            try (Statement s = h2.createStatement();
                 ResultSet rs = s.executeQuery("SELECT * FROM " + FallbackSchemaManager.q(name))) {
                while (rs.next()) {
                    Map<String, Object> values = FallbackRowCodec.readRow(rs, t);
                    String key = FallbackRowCodec.rowKey(t, values);
                    String hash = FallbackRowCodec.rowHash(hashed, values);
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

    void advanceBaseline(Connection h2, Map<String, TableDelta> delta, List<Conflict> conflicts) throws SQLException {
        boolean previous = h2.getAutoCommit();
        h2.setAutoCommit(false);
        try {
            try (PreparedStatement merge = h2.prepareStatement("MERGE INTO "
                    + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLE)
                    + " (\"table_name\", \"row_key\", \"row_hash\") KEY (\"table_name\", \"row_key\") VALUES (?, ?, ?)");
                 PreparedStatement remove = h2.prepareStatement("DELETE FROM "
                         + FallbackSchemaManager.q(FallbackSyncEngine.BASELINE_TABLE)
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
                try (PreparedStatement ps = h2.prepareStatement("INSERT INTO "
                        + FallbackSchemaManager.q(FallbackSyncEngine.CONFLICT_TABLE)
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

    int conflictCount(Connection h2) throws SQLException {
        schemaManager.ensureSupportTables(h2);
        try (Statement s = h2.createStatement();
             ResultSet rs = s.executeQuery("SELECT COUNT(*) FROM "
                     + FallbackSchemaManager.q(FallbackSyncEngine.CONFLICT_TABLE))) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }
}
