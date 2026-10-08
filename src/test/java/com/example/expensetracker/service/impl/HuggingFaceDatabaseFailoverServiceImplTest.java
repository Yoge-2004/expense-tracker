package com.example.expensetracker.service.impl;

import com.example.expensetracker.service.DatabaseSnapshotService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link HuggingFaceDatabaseFailoverServiceImpl}.
 *
 * <p><b>Known, intentional gap:</b> {@code backupCurrentDatabase()}'s and
 * {@code initializeFailoverSnapshot()}'s success paths call the static
 * {@link com.example.expensetracker.service.HuggingFaceFileClient}, which
 * has no test seam (no interface, a hardcoded {@code HttpClient} field) and
 * this codebase does not use {@code Mockito.mockStatic} anywhere else. Fully
 * exercising those success paths would mean either a real network call or
 * introducing a new mocking pattern with no precedent in this codebase — so
 * this suite covers what's cleanly and honestly testable: the
 * not-configured guard (which both public methods check first, before any
 * network access is attempted) and the two pure static helpers directly.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("HuggingFaceDatabaseFailoverServiceImpl")
class HuggingFaceDatabaseFailoverServiceImplTest {

    @Mock
    private DatabaseSnapshotService snapshotService;

    private HuggingFaceDatabaseFailoverServiceImpl newService(String token, String space, String encryptionKey) {
        HuggingFaceDatabaseFailoverServiceImpl service =
                new HuggingFaceDatabaseFailoverServiceImpl(snapshotService);
        ReflectionTestUtils.setField(service, "token", token);
        ReflectionTestUtils.setField(service, "space", space);
        ReflectionTestUtils.setField(service, "encryptionKey", encryptionKey);
        ReflectionTestUtils.setField(service, "path", "database/expense_tracker.sqlite.enc");
        return service;
    }

    @Nested
    @DisplayName("isNotConfigured guard (backupCurrentDatabase)")
    class NotConfiguredGuardTests {

        @Test
        @DisplayName("null token: returns false, never touches the snapshot service")
        void nullTokenGuarded() throws Exception {
            HuggingFaceDatabaseFailoverServiceImpl service = newService(null, "org/repo", "key123");
            assertFalse(service.backupCurrentDatabase());
            verifyNoInteractions(snapshotService);
        }

        @Test
        @DisplayName("empty string token (\"\"): guarded the same as null")
        void emptyStringTokenGuarded() throws Exception {
            HuggingFaceDatabaseFailoverServiceImpl service = newService("", "org/repo", "key123");
            assertFalse(service.backupCurrentDatabase());
            verifyNoInteractions(snapshotService);
        }

        @Test
        @DisplayName("whitespace-only token (\"   \"): isBlank() catches it, not just isEmpty()")
        void whitespaceOnlyTokenGuarded() throws Exception {
            HuggingFaceDatabaseFailoverServiceImpl service = newService("   ", "org/repo", "key123");
            assertFalse(service.backupCurrentDatabase());
            verifyNoInteractions(snapshotService);
        }

        @Test
        @DisplayName("a single tab character as token is still blank and guarded")
        void tabOnlyTokenGuarded() throws Exception {
            HuggingFaceDatabaseFailoverServiceImpl service = newService("\t", "org/repo", "key123");
            assertFalse(service.backupCurrentDatabase());
            verifyNoInteractions(snapshotService);
        }

        @Test
        @DisplayName("null space: guarded")
        void nullSpaceGuarded() throws Exception {
            HuggingFaceDatabaseFailoverServiceImpl service = newService("tok123", null, "key123");
            assertFalse(service.backupCurrentDatabase());
            verifyNoInteractions(snapshotService);
        }

        @Test
        @DisplayName("blank space: guarded")
        void blankSpaceGuarded() throws Exception {
            HuggingFaceDatabaseFailoverServiceImpl service = newService("tok123", "  ", "key123");
            assertFalse(service.backupCurrentDatabase());
            verifyNoInteractions(snapshotService);
        }

        @Test
        @DisplayName("null encryptionKey: guarded")
        void nullEncryptionKeyGuarded() throws Exception {
            HuggingFaceDatabaseFailoverServiceImpl service = newService("tok123", "org/repo", null);
            assertFalse(service.backupCurrentDatabase());
            verifyNoInteractions(snapshotService);
        }

        @Test
        @DisplayName("blank encryptionKey: guarded")
        void blankEncryptionKeyGuarded() throws Exception {
            HuggingFaceDatabaseFailoverServiceImpl service = newService("tok123", "org/repo", "");
            assertFalse(service.backupCurrentDatabase());
            verifyNoInteractions(snapshotService);
        }

        @Test
        @DisplayName(
                "a single non-blank character in every one of the three fields IS considered configured "
                + "(the guard only rejects null/blank, not 'too short' — this pins that boundary down "
                + "explicitly, since it means no minimum-length check exists here at all)")
        void singleCharacterInEveryFieldCountsAsConfigured() throws Exception {
            HuggingFaceDatabaseFailoverServiceImpl service = newService("a", "b/c", "d");
            // Configured, so it proceeds past the guard and DOES call the mock —
            // proving the guard itself did not fire here (it will still fail
            // later at the real HuggingFaceFileClient network call, hence the
            // broad catch — we only care that the guard let it through).
            when(snapshotService.exportCurrentDatabase(any(Path.class))).thenReturn(0);
            service.backupCurrentDatabase();
            verify(snapshotService, times(1)).exportCurrentDatabase(any(Path.class));
        }

        @Test
        @DisplayName("initializeFailoverSnapshot(): also guarded the same way, never touches the snapshot service")
        void initializeAlsoGuarded() {
            HuggingFaceDatabaseFailoverServiceImpl service = newService(null, "org/repo", "key123");
            assertDoesNotThrow(service::initializeFailoverSnapshot);
            verifyNoInteractions(snapshotService);
        }
    }

    @Nested
    @DisplayName("computeSha256 — exact hex encoding")
    class ComputeSha256Tests {

        @org.junit.jupiter.api.io.TempDir
        Path tempDir;

        @Test
        @DisplayName("SHA-256 of an empty file matches the well-known published test vector")
        void emptyFileMatchesKnownVector() throws IOException, NoSuchAlgorithmException {
            Path file = tempDir.resolve("empty.bin");
            Files.write(file, new byte[0]);
            // e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                    HuggingFaceDatabaseFailoverServiceImpl.computeSha256(file));
        }

        @Test
        @DisplayName("SHA-256 of the 3-byte ASCII string \"abc\" matches the well-known published test vector")
        void abcMatchesKnownVector() throws IOException, NoSuchAlgorithmException {
            Path file = tempDir.resolve("abc.bin");
            Files.write(file, "abc".getBytes(StandardCharsets.US_ASCII));
            assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                    HuggingFaceDatabaseFailoverServiceImpl.computeSha256(file));
        }

        @Test
        @DisplayName(
                "a file exactly one read-buffer's worth (8192 bytes) is hashed correctly — the boundary "
                + "where the read loop's single-buffer-fill case sits")
        void exactlyOneBufferSizeFile() throws IOException, NoSuchAlgorithmException {
            byte[] data = new byte[8192];
            for (int i = 0; i < data.length; i++) data[i] = (byte) (i % 256);
            Path file = tempDir.resolve("exact-buffer.bin");
            Files.write(file, data);
            assertEquals(sha256Hex(data), HuggingFaceDatabaseFailoverServiceImpl.computeSha256(file));
        }

        @Test
        @DisplayName(
                "a file one byte LARGER than the read buffer (8193 bytes) forces a second, partial read — "
                + "the exact off-by-one boundary most likely to break a hand-rolled read loop")
        void oneByteOverBufferSizeFile() throws IOException, NoSuchAlgorithmException {
            byte[] data = new byte[8193];
            for (int i = 0; i < data.length; i++) data[i] = (byte) (i % 256);
            Path file = tempDir.resolve("over-buffer.bin");
            Files.write(file, data);
            assertEquals(sha256Hex(data), HuggingFaceDatabaseFailoverServiceImpl.computeSha256(file));
        }

        @Test
        @DisplayName("a multi-buffer file (20000 bytes, spanning 3 reads) is hashed correctly end to end")
        void multiBufferFile() throws IOException, NoSuchAlgorithmException {
            byte[] data = new byte[20000];
            new java.util.Random(42).nextBytes(data);
            Path file = tempDir.resolve("multi-buffer.bin");
            Files.write(file, data);
            assertEquals(sha256Hex(data), HuggingFaceDatabaseFailoverServiceImpl.computeSha256(file));
        }

        @Test
        @DisplayName(
                "output is always exactly 64 lowercase hex characters — every byte renders as exactly 2 "
                + "digits (a hash byte like 0x05 must render as \"05\", never a bare \"5\")")
        void outputIsAlways64LowercaseHexChars() throws IOException, NoSuchAlgorithmException {
            Path file = tempDir.resolve("random.bin");
            Files.write(file, new byte[]{1, 2, 3});
            String hex = HuggingFaceDatabaseFailoverServiceImpl.computeSha256(file);
            assertEquals(64, hex.length());
            assertTrue(hex.matches("[0-9a-f]{64}"), "expected exactly 64 lowercase hex chars, got: " + hex);
        }

        @Test
        @DisplayName("two files with identical content produce identical checksums")
        void identicalContentProducesIdenticalChecksum() throws IOException, NoSuchAlgorithmException {
            byte[] data = "identical content for both files".getBytes(StandardCharsets.UTF_8);
            Path file1 = tempDir.resolve("a.bin");
            Path file2 = tempDir.resolve("b.bin");
            Files.write(file1, data);
            Files.write(file2, data);
            assertEquals(HuggingFaceDatabaseFailoverServiceImpl.computeSha256(file1),
                    HuggingFaceDatabaseFailoverServiceImpl.computeSha256(file2));
        }

        @Test
        @DisplayName("a single differing byte anywhere in the file produces a completely different checksum")
        void singleByteDifferenceChangesChecksum() throws IOException, NoSuchAlgorithmException {
            byte[] data1 = "identical except one byte X".getBytes(StandardCharsets.UTF_8);
            byte[] data2 = data1.clone();
            data2[data2.length - 1] = 'Y';
            Path file1 = tempDir.resolve("a.bin");
            Path file2 = tempDir.resolve("b.bin");
            Files.write(file1, data1);
            Files.write(file2, data2);
            assertNotEquals(HuggingFaceDatabaseFailoverServiceImpl.computeSha256(file1),
                    HuggingFaceDatabaseFailoverServiceImpl.computeSha256(file2));
        }

        private String sha256Hex(byte[] data) throws NoSuchAlgorithmException {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        }
    }

    @Nested
    @DisplayName("createSecureTempFile — filesystem permissions")
    @EnabledOnOs({OS.LINUX, OS.MAC})
    class CreateSecureTempFileTests {

        @Test
        @DisplayName("the created file actually exists")
        void fileExists() throws IOException {
            Path file = HuggingFaceDatabaseFailoverServiceImpl.createSecureTempFile(".sqlite");
            try {
                assertTrue(Files.exists(file));
            } finally {
                Files.deleteIfExists(file);
            }
        }

        @Test
        @DisplayName("the requested suffix is applied to the filename")
        void suffixApplied() throws IOException {
            Path file = HuggingFaceDatabaseFailoverServiceImpl.createSecureTempFile(".enc");
            try {
                assertTrue(file.getFileName().toString().endsWith(".enc"));
            } finally {
                Files.deleteIfExists(file);
            }
        }

        @Test
        @DisplayName("the file's POSIX permissions are exactly owner-read/owner-write, nothing else "
                + "(no group/other access, no execute bit) — this holds decrypted DB snapshots and keys")
        void filePermissionsAreOwnerReadWriteOnly() throws IOException {
            Path file = HuggingFaceDatabaseFailoverServiceImpl.createSecureTempFile(".sqlite");
            try {
                Set<PosixFilePermission> perms = Files.getPosixFilePermissions(file);
                assertEquals(Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE), perms,
                        "expected exactly rw------- but got " + PosixFilePermissions.toString(perms));
            } finally {
                Files.deleteIfExists(file);
            }
        }

        @Test
        @DisplayName("two consecutive calls produce two distinct files, never colliding")
        void consecutiveCallsProduceDistinctFiles() throws IOException {
            Path file1 = HuggingFaceDatabaseFailoverServiceImpl.createSecureTempFile(".sqlite");
            Path file2 = HuggingFaceDatabaseFailoverServiceImpl.createSecureTempFile(".sqlite");
            try {
                assertNotEquals(file1, file2);
            } finally {
                Files.deleteIfExists(file1);
                Files.deleteIfExists(file2);
            }
        }

        @Test
        @DisplayName("the parent directory itself is owner-only (rwx------), not merely the files inside it")
        void parentDirectoryIsOwnerOnly() throws IOException {
            Path file = HuggingFaceDatabaseFailoverServiceImpl.createSecureTempFile(".sqlite");
            try {
                Path dir = file.getParent();
                Set<PosixFilePermission> perms = Files.getPosixFilePermissions(dir);
                assertEquals(Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE,
                                PosixFilePermission.OWNER_EXECUTE), perms,
                        "expected exactly rwx------ but got " + PosixFilePermissions.toString(perms));
            } finally {
                Files.deleteIfExists(file);
            }
        }
    }

    @Nested
    @DisplayName("diagnostics expose backup status without needing container logs")
    class StatusDiagnostics {

        @Test
        @DisplayName("before any attempt: nothing has run yet, no error, and the snapshot path is reported")
        void freshServiceReportsNeverAndNoError() {
            // No token => getDiagnostics() returns before any network call (no whoami request).
            HuggingFaceDatabaseFailoverServiceImpl service = newService(null, "org/repo", "key123");
            var diag = service.getDiagnostics();
            assertEquals("never", diag.get("lastAttemptAt"));
            assertEquals("never", diag.get("lastSuccessAt"));
            assertEquals("never", diag.get("lastUploadAt"));
            assertEquals("none", diag.get("lastError"));
            assertEquals("database/expense_tracker.sqlite.enc", diag.get("snapshotPath"));
        }

        @Test
        @DisplayName("an empty export never replaces the stored snapshot and records why")
        void emptyExportIsRefusedAndExplained() throws Exception {
            HuggingFaceDatabaseFailoverServiceImpl service = newService("tok", "org/repo", "key123");
            when(snapshotService.exportCurrentDatabase(any(Path.class))).thenReturn(0);

            assertFalse(service.backupCurrentDatabase());

            // Diagnostics for a configured service call the network (whoami); read the field directly.
            String error = (String) ReflectionTestUtils.getField(service, "lastError");
            assertNotNull(error);
            assertTrue(error.contains("0 rows"), error);
            assertNotNull(ReflectionTestUtils.getField(service, "lastAttemptAt"));
            assertNull(ReflectionTestUtils.getField(service, "lastSuccessAt"));
        }

        @Test
        @DisplayName("a missing setting is named so the log line says what to fix")
        void missingSettingsAreNamed() {
            HuggingFaceDatabaseFailoverServiceImpl service = newService("tok", "org/repo", "");
            var diag = service.getDiagnostics();
            assertEquals(false, diag.get("isConfigured"));
            assertTrue(diag.get("statusMessage").toString().contains("DB_BACKUP_KEY"));
        }
    }
}
