package com.example.expensetracker.service.impl;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/** The content hash decides whether a Space commit (and restart) happens, so its invariants are pinned here. */
class SnapshotContentHashTest {

    private static final Set<String> VOLATILE = Set.of("app_notifications");

    @TempDir
    Path dir;

    private Path db(String name, List<String> statements) throws Exception {
        Path file = dir.resolve(name);
        Class.forName("org.sqlite.JDBC");
        try (Connection c = DriverManager.getConnection("jdbc:sqlite:" + file.toAbsolutePath());
             Statement s = c.createStatement()) {
            for (String sql : statements) {
                s.execute(sql);
            }
        }
        return file;
    }

    @Test
    void insertOrderDoesNotMatterEvenWithoutPrimaryKey() throws Exception {
        Path a = db("a.sqlite", List.of("CREATE TABLE tags (name TEXT)",
                "INSERT INTO tags VALUES ('x')", "INSERT INTO tags VALUES ('y')"));
        Path b = db("b.sqlite", List.of("CREATE TABLE tags (name TEXT)",
                "INSERT INTO tags VALUES ('y')", "INSERT INTO tags VALUES ('x')"));
        assertEquals(HuggingFaceDatabaseFailoverServiceImpl.contentHash(a, VOLATILE),
                HuggingFaceDatabaseFailoverServiceImpl.contentHash(b, VOLATILE));
    }

    @Test
    void changesOnlyInVolatileOrBookkeepingTablesDoNotChangeTheHash() throws Exception {
        List<String> base = List.of("CREATE TABLE expenses (id INTEGER PRIMARY KEY, amount NUMERIC)",
                "INSERT INTO expenses VALUES (1, 10)", "CREATE TABLE app_notifications (id INTEGER PRIMARY KEY, msg TEXT)",
                "CREATE TABLE fb_baseline (k TEXT)");
        Path quiet = db("quiet.sqlite", base);
        Path noisy = db("noisy.sqlite", List.of("CREATE TABLE expenses (id INTEGER PRIMARY KEY, amount NUMERIC)",
                "INSERT INTO expenses VALUES (1, 10)", "CREATE TABLE app_notifications (id INTEGER PRIMARY KEY, msg TEXT)",
                "INSERT INTO app_notifications VALUES (1, 'hello')", "CREATE TABLE fb_baseline (k TEXT)",
                "INSERT INTO fb_baseline VALUES ('z')"));
        assertEquals(HuggingFaceDatabaseFailoverServiceImpl.contentHash(quiet, VOLATILE),
                HuggingFaceDatabaseFailoverServiceImpl.contentHash(noisy, VOLATILE));
    }

    @Test
    void anyRealDataChangeChangesTheHash() throws Exception {
        Path before = db("before.sqlite", List.of("CREATE TABLE expenses (id INTEGER PRIMARY KEY, amount NUMERIC)",
                "INSERT INTO expenses VALUES (1, 10)"));
        Path edited = db("edited.sqlite", List.of("CREATE TABLE expenses (id INTEGER PRIMARY KEY, amount NUMERIC)",
                "INSERT INTO expenses VALUES (1, 11)"));
        Path deleted = db("deleted.sqlite", List.of("CREATE TABLE expenses (id INTEGER PRIMARY KEY, amount NUMERIC)"));
        String h = HuggingFaceDatabaseFailoverServiceImpl.contentHash(before, VOLATILE);
        assertNotEquals(h, HuggingFaceDatabaseFailoverServiceImpl.contentHash(edited, VOLATILE));
        assertNotEquals(h, HuggingFaceDatabaseFailoverServiceImpl.contentHash(deleted, VOLATILE));
    }

    @Test
    void tableNameCaseDoesNotMatter() throws Exception {
        Path lower = db("l.sqlite", List.of("CREATE TABLE expenses (id INTEGER PRIMARY KEY)", "INSERT INTO expenses VALUES (1)"));
        Path upper = db("u.sqlite", List.of("CREATE TABLE EXPENSES (id INTEGER PRIMARY KEY)", "INSERT INTO EXPENSES VALUES (1)"));
        assertEquals(HuggingFaceDatabaseFailoverServiceImpl.contentHash(lower, VOLATILE),
                HuggingFaceDatabaseFailoverServiceImpl.contentHash(upper, VOLATILE));
    }
}
