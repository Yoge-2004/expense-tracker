package com.example.expensetracker.service.impl;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("DatabaseSnapshotServiceImpl Unit Tests")
class DatabaseSnapshotServiceImplTest {

    private DatabaseSnapshotServiceImpl snapshotService;
    private DataSource dataSource;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() throws Exception {
        JdbcDataSource ds = new JdbcDataSource();
        String dbUrl = "jdbc:h2:mem:test_snapshot_" + System.currentTimeMillis() + ";DB_CLOSE_DELAY=-1;MODE=PostgreSQL";
        ds.setURL(dbUrl);
        ds.setUser("sa");
        ds.setPassword("");
        this.dataSource = ds;

        try (Connection conn = ds.getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE TABLE users (id BIGINT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255))");
            stmt.execute("INSERT INTO users VALUES (1, 'Test User', 'test@example.com')");
            stmt.execute("INSERT INTO users VALUES (2, 'Second User', 'second@example.com')");
        }

        Path fallbackPath = tempDir.resolve("fallback_db");
        snapshotService = new DatabaseSnapshotServiceImpl(dataSource, fallbackPath.toString());
    }

    @Test
    @DisplayName("encrypt and decrypt: roundtrip preserves identical file payload")
    void encryptAndDecrypt_roundTrip_success() throws Exception {
        Path plainFile = tempDir.resolve("source.txt");
        Path encFile = tempDir.resolve("source.txt.enc");
        Path decFile = tempDir.resolve("recovered.txt");

        String secretText = "Confidential Financial Records Snapshot 2026";
        Files.writeString(plainFile, secretText, StandardCharsets.UTF_8);

        String password = "UltraSecurePassword@2026!";
        DatabaseSnapshotServiceImpl.encrypt(plainFile, encFile, password);

        assertTrue(Files.exists(encFile));
        assertNotEquals(secretText, Files.readString(encFile, StandardCharsets.ISO_8859_1));

        DatabaseSnapshotServiceImpl.decrypt(encFile, decFile, password);

        assertTrue(Files.exists(decFile));
        assertEquals(secretText, Files.readString(decFile, StandardCharsets.UTF_8));
    }

    @Test
    @DisplayName("decrypt: fails with wrong password (AEAD authentication tag mismatch)")
    void decrypt_wrongPassword_throwsException() throws Exception {
        Path plainFile = tempDir.resolve("source_fail.txt");
        Path encFile = tempDir.resolve("source_fail.enc");
        Path decFile = tempDir.resolve("should_fail.txt");

        Files.writeString(plainFile, "Secret Data", StandardCharsets.UTF_8);
        DatabaseSnapshotServiceImpl.encrypt(plainFile, encFile, "CorrectPassword123");

        assertThrows(Exception.class, () ->
                DatabaseSnapshotServiceImpl.decrypt(encFile, decFile, "WrongPassword456"));
    }

    @Test
    @DisplayName("decrypt: throws SecurityException on invalid magic header")
    void decrypt_corruptedHeader_throwsSecurityException() throws Exception {
        Path badHeaderFile = tempDir.resolve("bad_header.enc");
        byte[] corrupted = new byte[100];
        corrupted[0] = 'X'; // Incorrect magic
        corrupted[1] = 'X';
        Files.write(badHeaderFile, corrupted);

        SecurityException ex = assertThrows(SecurityException.class, () ->
                DatabaseSnapshotServiceImpl.decrypt(badHeaderFile, tempDir.resolve("out.txt"), "Password"));
        assertTrue(ex.getMessage().contains("header"));
    }

    @Test
    @DisplayName("decrypt: throws SecurityException on truncated file size")
    void decrypt_truncatedFile_throwsSecurityException() throws Exception {
        Path truncatedFile = tempDir.resolve("truncated.enc");
        Files.write(truncatedFile, new byte[]{ 'E', 'T' }); // shorter than min length

        SecurityException ex = assertThrows(SecurityException.class, () ->
                DatabaseSnapshotServiceImpl.decrypt(truncatedFile, tempDir.resolve("out.txt"), "Password"));
        assertTrue(ex.getMessage().contains("Invalid encrypted database snapshot"));
    }

    @Test
    @DisplayName("exportCurrentDatabase: exports relational tables to SQLite file")
    void exportCurrentDatabase_success() throws Exception {
        Path sqlitePath = tempDir.resolve("snapshot.sqlite");

        int rows = snapshotService.exportCurrentDatabase(sqlitePath);

        assertTrue(rows >= 2);
        assertTrue(Files.exists(sqlitePath));
        assertTrue(Files.size(sqlitePath) > 0);
    }

    @Test
    @DisplayName("exportCurrentDatabase: null path throws IllegalArgumentException")
    void exportCurrentDatabase_nullPath_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> snapshotService.exportCurrentDatabase(null));
    }

    @Test
    @DisplayName("importIntoFallback: null or non-existent path throws IllegalArgumentException")
    void importIntoFallback_invalidPath_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> snapshotService.importIntoFallback(null));
        Path nonExistent = tempDir.resolve("does_not_exist.sqlite");
        assertThrows(IllegalArgumentException.class, () -> snapshotService.importIntoFallback(nonExistent));
    }

    @Test
    @DisplayName("encrypt: null, non-existent, or blank password arguments throw IllegalArgumentException")
    void encrypt_invalidArgs_throwsException() {
        Path existing = tempDir.resolve("test_file.txt");
        Path nonExistent = tempDir.resolve("non_existent.txt");
        Path out = tempDir.resolve("out.enc");
        assertThrows(IllegalArgumentException.class, () -> DatabaseSnapshotServiceImpl.encrypt(null, out, "pass"));
        assertThrows(IllegalArgumentException.class, () -> DatabaseSnapshotServiceImpl.encrypt(existing, null, "pass"));
        assertThrows(IllegalArgumentException.class, () -> DatabaseSnapshotServiceImpl.encrypt(nonExistent, out, "pass"));
        assertThrows(IllegalArgumentException.class, () -> DatabaseSnapshotServiceImpl.encrypt(existing, out, "   "));
    }

    @Test
    @DisplayName("decrypt: null, non-existent, or blank password arguments throw IllegalArgumentException")
    void decrypt_invalidArgs_throwsException() {
        Path existing = tempDir.resolve("test_file.txt");
        Path nonExistent = tempDir.resolve("non_existent.enc");
        Path out = tempDir.resolve("out.txt");
        assertThrows(IllegalArgumentException.class, () -> DatabaseSnapshotServiceImpl.decrypt(null, out, "pass"));
        assertThrows(IllegalArgumentException.class, () -> DatabaseSnapshotServiceImpl.decrypt(existing, null, "pass"));
        assertThrows(IllegalArgumentException.class, () -> DatabaseSnapshotServiceImpl.decrypt(nonExistent, out, "pass"));
        assertThrows(IllegalArgumentException.class, () -> DatabaseSnapshotServiceImpl.decrypt(existing, out, "   "));
    }
}
