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
import java.util.Map;
import java.util.LinkedHashMap;

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

    /** space (default, matches existing deployments), dataset or model. */
    @Value("${hf.db.repo-type:${HF_REPO_TYPE:space}}")
    private String repoType;

    @Value("${hf.db.encryption-key:${DB_BACKUP_KEY:}}")
    private String encryptionKey;

    private final DatabaseSnapshotService snapshotService;
    private volatile boolean writePermissionWarned = false;
    private volatile boolean notConfiguredWarned = false;
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
                if (HuggingFaceFileClient.download(repoType, space, path, encrypted, token)) {
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
            if (!notConfiguredWarned) {
                notConfiguredWarned = true;
                log.warn("HF database backup is NOT running: {} Backups need HF_TOKEN, DB_BACKUP_KEY and "
                        + "HF_SPACE_REPO to all be set.", missingSettings());
            }
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
                HuggingFaceFileClient.upload(repoType, space, path, encrypted, token);
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

    /** Package-private (not private) so it's directly unit-testable without
     *  needing a full backupCurrentDatabase() round-trip through the network. */
    static String computeSha256(Path file) throws IOException, NoSuchAlgorithmException {
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

    /** Package-private (not private) so its file/directory permission
     *  behavior is directly unit-testable. */
    @SuppressWarnings({"java:S5443", "java:S899"})
    static Path createSecureTempFile(String suffix) throws IOException {
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

    /** Names the settings that are blank, so a silent no-op becomes a readable log line. */
    private String missingSettings() {
        StringBuilder missing = new StringBuilder();
        if (token == null || token.isBlank()) missing.append("HF_TOKEN ");
        if (encryptionKey == null || encryptionKey.isBlank()) missing.append("DB_BACKUP_KEY ");
        if (space == null || space.isBlank()) missing.append("HF_SPACE_REPO ");
        return missing.isEmpty() ? "" : "Missing: " + missing.toString().trim() + ".";
    }

    private boolean isNotConfigured() {
        return token == null || token.isBlank()
                || encryptionKey == null || encryptionKey.isBlank()
                || space == null || space.isBlank();
    }

    @Override
    public Map<String, Object> getDiagnostics() {
        Map<String, Object> diag = new LinkedHashMap<>();
        boolean tokenPresent = token != null && !token.isBlank();
        boolean keyPresent = encryptionKey != null && !encryptionKey.isBlank();
        boolean spacePresent = space != null && !space.isBlank();

        diag.put("space", space != null ? space : "unset");
        diag.put("repoType", repoType != null ? repoType : "space");
        diag.put("tokenConfigured", tokenPresent);
        diag.put("encryptionKeyConfigured", keyPresent);
        diag.put("isConfigured", !isNotConfigured());

        if (!tokenPresent) {
            diag.put("statusMessage", "HF_TOKEN is missing or blank. Please set HF_TOKEN environment variable.");
        } else if (!keyPresent) {
            diag.put("statusMessage", "DB_BACKUP_KEY is missing. Database snapshots require an encryption key.");
        } else if (!spacePresent) {
            diag.put("statusMessage", "HF_SPACE_REPO is missing.");
        } else {
            String tokenDiagnosis = HuggingFaceFileClient.inspectToken(token);
            diag.put("tokenDiagnosis", tokenDiagnosis);
            diag.put("statusMessage", tokenDiagnosis);
        }
        return diag;
    }
}

