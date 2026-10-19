package com.example.expensetracker.service.impl;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Dates and timestamps used to be written to the SQLite snapshot as epoch milliseconds, which H2 could not read
 * back into a DATE or TIMESTAMP column, so restoring any table with a date failed.
 */
@DisplayName("DatabaseSnapshotServiceImpl date round trip")
class DatabaseSnapshotRoundTripTest {

    private static final String DDL = "CREATE TABLE ledger (id BIGINT PRIMARY KEY, spent_on DATE, created_at TIMESTAMP, "
            + "recurring BOOLEAN, amount NUMERIC(19,2), note VARCHAR(100))";

    @TempDir
    Path tmp;

    @Test
    @DisplayName("restores DATE, TIMESTAMP, BOOLEAN and NUMERIC values exactly")
    void restoresTemporalAndNumericValues() throws Exception {
        JdbcDataSource source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:snapshot_source_" + System.nanoTime() + ";DB_CLOSE_DELAY=-1");
        source.setUser("sa");
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) {
            s.execute(DDL);
            s.execute("INSERT INTO ledger VALUES (1, DATE '2026-10-01', TIMESTAMP '2026-10-01 12:30:00.123456', TRUE, 120.50, 'Lunch')");
            s.execute("INSERT INTO ledger VALUES (2, NULL, NULL, FALSE, 0.10, 'No dates')");
        }

        Path fallbackFile = tmp.resolve("fallback");
        DatabaseSnapshotServiceImpl service = new DatabaseSnapshotServiceImpl(source, fallbackFile.toString());
        Path snapshot = tmp.resolve("snapshot.sqlite");
        assertEquals(2, service.exportCurrentDatabase(snapshot));

        try (Connection f = java.sql.DriverManager.getConnection(
                "jdbc:h2:file:" + fallbackFile + ";MODE=PostgreSQL;AUTO_SERVER=TRUE", "sa", "")) {
            try (Statement s = f.createStatement()) {
                s.execute(DDL);
            }
            assertEquals(2, service.importIntoFallback(snapshot));

            try (Statement s = f.createStatement();
                 ResultSet rs = s.executeQuery("SELECT * FROM ledger ORDER BY id")) {
                assertTrue(rs.next());
                assertEquals(Date.valueOf("2026-10-01"), rs.getDate("spent_on"));
                assertEquals(Timestamp.valueOf("2026-10-01 12:30:00.123456"), rs.getTimestamp("created_at"));
                assertTrue(rs.getBoolean("recurring"));
                assertEquals(new BigDecimal("120.50"), rs.getBigDecimal("amount"));
                assertTrue(rs.next());
                assertEquals(null, rs.getDate("spent_on"));
                assertEquals(null, rs.getTimestamp("created_at"));
                assertEquals(new BigDecimal("0.10"), rs.getBigDecimal("amount"));
            }
        }
    }
}
