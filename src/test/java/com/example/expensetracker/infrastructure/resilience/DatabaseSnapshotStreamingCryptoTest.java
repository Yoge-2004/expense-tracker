package com.example.expensetracker.infrastructure.resilience;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@DisplayName("Snapshot encryption is streamed but keeps its file format")
class DatabaseSnapshotStreamingCryptoTest {

    @TempDir
    Path dir;

    private static byte[] randomBytes(int n) {
        byte[] b = new byte[n];
        new SecureRandom().nextBytes(b);
        return b;
    }

    /** The format snapshots were written in before streaming: MAGIC | salt(16) | iv(12) | ciphertext+tag. */
    private static byte[] legacyEncrypt(byte[] plain, String password) throws Exception {
        byte[] salt = randomBytes(16);
        byte[] iv = randomBytes(12);
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 600_000, 256);
        SecretKeySpec key = new SecretKeySpec(
                SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(), "AES");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(new byte[] {'E', 'T', 'D', 'B', '1'});
        out.write(salt);
        out.write(iv);
        out.write(cipher.doFinal(plain));
        return out.toByteArray();
    }

    @Test
    @DisplayName("a multi-megabyte file survives an encrypt/decrypt round trip")
    void largeRoundTrip() throws Exception {
        byte[] plain = randomBytes(5 * 1024 * 1024 + 123);
        Path in = dir.resolve("db.sqlite");
        Path enc = dir.resolve("db.enc");
        Path out = dir.resolve("db.out");
        Files.write(in, plain);

        DatabaseSnapshotServiceImpl.encrypt(in, enc, "S3cret-pass");
        DatabaseSnapshotServiceImpl.decrypt(enc, out, "S3cret-pass");

        assertArrayEquals(plain, Files.readAllBytes(out));
    }

    @Test
    @DisplayName("a snapshot written by the previous, non-streaming implementation still decrypts")
    void legacyFilesStillDecrypt() throws Exception {
        byte[] plain = randomBytes(300_000);
        Path enc = dir.resolve("legacy.enc");
        Path out = dir.resolve("legacy.out");
        Files.write(enc, legacyEncrypt(plain, "old-password"));

        DatabaseSnapshotServiceImpl.decrypt(enc, out, "old-password");

        assertArrayEquals(plain, Files.readAllBytes(out));
    }

    @Test
    @DisplayName("a file written by the streaming encrypt is readable with the legacy algorithm")
    void streamedFilesUseTheSameLayout() throws Exception {
        byte[] plain = randomBytes(100_000);
        Path in = dir.resolve("plain.bin");
        Path enc = dir.resolve("streamed.enc");
        Files.write(in, plain);

        DatabaseSnapshotServiceImpl.encrypt(in, enc, "pw-123456");

        byte[] all = Files.readAllBytes(enc);
        byte[] salt = java.util.Arrays.copyOfRange(all, 5, 21);
        byte[] iv = java.util.Arrays.copyOfRange(all, 21, 33);
        PBEKeySpec spec = new PBEKeySpec("pw-123456".toCharArray(), salt, 600_000, 256);
        SecretKeySpec key = new SecretKeySpec(
                SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(), "AES");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
        assertArrayEquals(plain, cipher.doFinal(java.util.Arrays.copyOfRange(all, 33, all.length)));
    }

    @Test
    @DisplayName("a wrong password fails with a security exception and leaves no partial output behind")
    void wrongPasswordLeavesNoOutput() throws Exception {
        Path in = dir.resolve("p.bin");
        Path enc = dir.resolve("p.enc");
        Path out = dir.resolve("p.out");
        Files.write(in, randomBytes(50_000));
        DatabaseSnapshotServiceImpl.encrypt(in, enc, "right-password");

        assertThrows(GeneralSecurityException.class,
                () -> DatabaseSnapshotServiceImpl.decrypt(enc, out, "wrong-password"));
        assertFalse(Files.exists(out), "unauthenticated plaintext must not be left on disk");
    }
}
