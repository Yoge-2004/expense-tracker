package com.example.expensetracker.service.impl;

import com.example.expensetracker.service.DatabaseSnapshotService;
import com.example.expensetracker.service.HuggingFaceDatabaseFailoverService;
import com.example.expensetracker.service.HuggingFaceFileClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileAttribute;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.EnumSet;
import java.util.Set;

/**
 * Keeps the latest database snapshot in the Hugging Face Space repository.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HuggingFaceDatabaseFailoverServiceImpl implements HuggingFaceDatabaseFailoverService {

    private static final String DEFAULT_SPACE = "Yoge-2004/expense-tracker-backend";
    private static final String DEFAULT_PATH = "database/expense_tracker.sqlite.enc";

    @Value("${hf.db.token:${HF_TOKEN:}}")
    private String token;

    @Value("${hf.db.space:${HF_SPACE_REPO:" + DEFAULT_SPACE + "}}")
    private String space;

    @Value("${hf.db.path:" + DEFAULT_PATH + "}")
    private String path;

    @Value("${hf.db.encryption-key:${DB_BACKUP_KEY:}}")
    private String encryptionKey;

    private final DatabaseSnapshotService snapshotService;
    private volatile boolean writePermissionWarned = false;
    private volatile String lastPushedChecksum = null;

    @Override
    @EventListener(ApplicationReadyEvent.class)
    public void initializeFailoverSnapshot() {
        if (isNotConfigured()) {
            log.warn("HF database failover is disabled until HF_TOKEN and DB_BACKUP_KEY are configured.");
            return;
        }
        log.info("HF failover token scope check: {}", HuggingFaceFileClient.inspectToken(token));
        try {
            Path encrypted = createSecureTempFile(".enc");
            Path sqlite = createSecureTempFile(".sqlite");
            try {
                if (HuggingFaceFileClient.download(space, path, encrypted, token)) {
                    DatabaseSnapshotService.decrypt(encrypted, sqlite, encryptionKey);
                    int rows = snapshotService.importIntoFallback(sqlite);
                    lastPushedChecksum = computeSha256(sqlite);
                    log.info("HF encrypted DB snapshot loaded into local failover store: {} rows (SHA-256: {}).",
                            rows, lastPushedChecksum);
                } else {
                    log.info("No HF database snapshot exists yet; emergency datastore will start empty.");
                }
            } finally {
                Files.deleteIfExists(encrypted);
                Files.deleteIfExists(sqlite);
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            log.error("HF database failover initialization interrupted", ie);
        } catch (Exception e) {
            log.error("Failed to initialize HF database failover", e);
        }
    }

    /** Snapshot the currently active database every 10 minutes. */
    @Override
    @Scheduled(cron = "0 */10 * * * *")
    public void scheduledBackup() {
        backupCurrentDatabase();
    }

    @Override
    public synchronized boolean backupCurrentDatabase() {
        if (isNotConfigured()) {
            return false;
        }
        try {
            Path sqlite = createSecureTempFile(".sqlite");
            Path encrypted = createSecureTempFile(".enc");
            try {
                snapshotService.exportCurrentDatabase(sqlite);
                String currentChecksum = computeSha256(sqlite);
                if (currentChecksum.equals(lastPushedChecksum)) {
                    log.info("Database snapshot unchanged (SHA-256: {}); skipping redundant Hugging Face backup.",
                            currentChecksum);
                    return true;
                }
                DatabaseSnapshotService.encrypt(sqlite, encrypted, encryptionKey);
                HuggingFaceFileClient.upload(space, path, encrypted, token);
                lastPushedChecksum = currentChecksum;
                writePermissionWarned = false;
                log.info("Encrypted production database snapshot pushed to HF Space repository (SHA-256: {}).",
                        currentChecksum);
                return true;
            } finally {
                Files.deleteIfExists(sqlite);
                Files.deleteIfExists(encrypted);
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            log.error("HF database backup interrupted", ie);
            return false;
        } catch (IllegalStateException ise) {
            if (ise.getMessage() != null && ise.getMessage().contains("HTTP 403")) {
                if (!writePermissionWarned) {
                    writePermissionWarned = true;
                    String tokenStatus = HuggingFaceFileClient.inspectToken(token);
                    log.warn("HF database failover backup skipped (HTTP 403): HF_TOKEN lacks repository write "
                            + "permissions to {}. Token diagnosis: [{}]. "
                            + "Generate an Access Token with 'Write' role at https://huggingface.co/settings/tokens.",
                            space, tokenStatus);
                }
                return false;
            }
            log.error("HF encrypted database backup failed", ise);
            return false;
        } catch (Exception e) {
            log.error("HF encrypted database backup failed", e);
            return false;
        }
    }

    private static String computeSha256(Path file) throws IOException, NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = Files.newInputStream(file)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        byte[] hash = digest.digest();
        StringBuilder sb = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    @SuppressWarnings({"java:S5443", "java:S899"})
    private static Path createSecureTempFile(String suffix) throws IOException {
        final String prefix = "expense-db-";
        Path tempDir = Path.of(System.getProperty("java.io.tmpdir"), "expense-tracker-failover");
        if (!Files.exists(tempDir)) {
            try {
                FileAttribute<Set<PosixFilePermission>> dirAttr = PosixFilePermissions.asFileAttribute(
                        EnumSet.of(PosixFilePermission.OWNER_READ,
                                PosixFilePermission.OWNER_WRITE,
                                PosixFilePermission.OWNER_EXECUTE)
                );
                Files.createDirectories(tempDir, dirAttr);
            } catch (UnsupportedOperationException e) {
                Files.createDirectories(tempDir);
                File dirFile = tempDir.toFile();
                dirFile.setReadable(true, true);
                dirFile.setWritable(true, true);
                dirFile.setExecutable(true, true);
            }
        }

        try {
            FileAttribute<Set<PosixFilePermission>> fileAttr = PosixFilePermissions.asFileAttribute(
                    EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE)
            );
            return Files.createTempFile(tempDir, prefix, suffix, fileAttr);
        } catch (UnsupportedOperationException e) {
            Path file = Files.createTempFile(tempDir, prefix, suffix);
            File f = file.toFile();
            f.setReadable(true, true);
            f.setWritable(true, true);
            f.setExecutable(false, false);
            return file;
        }
    }

    private boolean isNotConfigured() {
        return token == null || token.isBlank()
                || encryptionKey == null || encryptionKey.isBlank()
                || space == null || space.isBlank();
    }
}
