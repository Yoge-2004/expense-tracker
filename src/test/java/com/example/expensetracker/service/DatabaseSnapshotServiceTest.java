package com.example.expensetracker.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.*;

class DatabaseSnapshotServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void encryptAndDecrypt_roundTripPreservesExactBytes() throws Exception {
        Path input = tempDir.resolve("source.sqlite");
        Path encrypted = tempDir.resolve("snapshot.enc");
        Path decrypted = tempDir.resolve("restored.sqlite");
        byte[] payload = "expense-tracker snapshot test".getBytes(StandardCharsets.UTF_8);
        Files.write(input, payload);

        DatabaseSnapshotService.encrypt(input, encrypted, "test-backup-key");
        DatabaseSnapshotService.decrypt(encrypted, decrypted, "test-backup-key");

        assertArrayEquals(payload, Files.readAllBytes(decrypted));
        assertNotEquals(Files.readString(input), Files.readString(encrypted));
    }

    @Test
    void encryptingSamePayloadTwiceProducesDifferentCiphertext() throws Exception {
        Path input = tempDir.resolve("source.sqlite");
        Path first = tempDir.resolve("one.enc");
        Path second = tempDir.resolve("two.enc");
        Files.writeString(input, "same database bytes");

        DatabaseSnapshotService.encrypt(input, first, "test-backup-key");
        DatabaseSnapshotService.encrypt(input, second, "test-backup-key");

        assertFalse(java.util.Arrays.equals(Files.readAllBytes(first), Files.readAllBytes(second)));
    }

    @Test
    void decryptWithWrongKeyFailsAuthentication() throws Exception {
        Path input = tempDir.resolve("source.sqlite");
        Path encrypted = tempDir.resolve("snapshot.enc");
        Path output = tempDir.resolve("restored.sqlite");
        Files.writeString(input, "confidential database bytes");
        DatabaseSnapshotService.encrypt(input, encrypted, "correct-key");

        assertThrows(Exception.class, () -> DatabaseSnapshotService.decrypt(encrypted, output, "wrong-key"));
        assertFalse(Files.exists(output));
    }

    @Test
    void decryptRejectsTamperedSnapshot() throws Exception {
        Path input = tempDir.resolve("source.sqlite");
        Path encrypted = tempDir.resolve("snapshot.enc");
        Path output = tempDir.resolve("restored.sqlite");
        Files.writeString(input, "confidential database bytes");
        DatabaseSnapshotService.encrypt(input, encrypted, "correct-key");

        byte[] bytes = Files.readAllBytes(encrypted);
        bytes[bytes.length - 1] ^= 0x01;
        Files.write(encrypted, bytes);

        assertThrows(Exception.class, () -> DatabaseSnapshotService.decrypt(encrypted, output, "correct-key"));
        assertFalse(Files.exists(output));
    }

    @Test
    void decryptRejectsInvalidHeader() throws Exception {
        Path encrypted = tempDir.resolve("invalid.enc");
        Path output = tempDir.resolve("restored.sqlite");
        Files.write(encrypted, new byte[64]);

        assertThrows(SecurityException.class, () -> DatabaseSnapshotService.decrypt(encrypted, output, "test-backup-key"));
    }

    @Test
    void exportAndImportPreserveRowsAcrossCompatibleDatabases() throws Exception {
        Path sourceDb = tempDir.resolve("source.mv.db");
        Path fallbackDb = tempDir.resolve("fallback");
        DataSource source = h2("jdbc:h2:file:" + sourceDb.toAbsolutePath());
        try (Connection connection = source.getConnection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE users (id BIGINT PRIMARY KEY, name VARCHAR(100), amount DECIMAL(12,2))");
            statement.executeUpdate("INSERT INTO users VALUES (1, 'Alice', 123.45), (2, 'Bob', 67.89)");
        }

        DatabaseSnapshotService service = new DatabaseSnapshotService(source, fallbackDb.toString());
        Path sqlite = tempDir.resolve("snapshot.sqlite");
        assertEquals(2, service.exportCurrentDatabase(sqlite));

        DataSource fallback = h2("jdbc:h2:file:" + fallbackDb.toAbsolutePath() + ";MODE=PostgreSQL;AUTO_SERVER=TRUE");
        try (Connection connection = fallback.getConnection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE users (id BIGINT PRIMARY KEY, name VARCHAR(100), amount DECIMAL(12,2))");
        }

        assertEquals(2, service.importIntoFallback(sqlite));
        try (Connection connection = fallback.getConnection();
             ResultSet rs = connection.createStatement().executeQuery("SELECT COUNT(*) FROM users")) {
            assertTrue(rs.next());
            assertEquals(2, rs.getInt(1));
        }
    }

    private DataSource h2(String url) {
        DriverManagerDataSource ds = new DriverManagerDataSource();
        ds.setDriverClassName("org.h2.Driver");
        ds.setUrl(url);
        ds.setUsername("sa");
        ds.setPassword("");
        return ds;
    }
}
