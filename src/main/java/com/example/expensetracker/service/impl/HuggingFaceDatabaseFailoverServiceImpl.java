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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileAttribute;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
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

    @Override
    @EventListener(ApplicationReadyEvent.class)
    public void initializeFailoverSnapshot() {
        if (isNotConfigured()) {
            log.warn("HF database failover is disabled until HF_TOKEN and DB_BACKUP_KEY are configured.");
            return;
        }
        try {
            Path encrypted = createSecureTempFile(".enc");
            Path sqlite = createSecureTempFile(".sqlite");
            try {
                if (HuggingFaceFileClient.download(space, path, encrypted, token)) {
                    DatabaseSnapshotService.decrypt(encrypted, sqlite, encryptionKey);
                    int rows = snapshotService.importIntoFallback(sqlite);
                    log.info("HF encrypted DB snapshot loaded into local failover store: {} rows.", rows);
                } else {
                    log.info("No HF database snapshot exists yet; emergency datastore will start empty.");
                }
            } finally {
                Files.deleteIfExists(encrypted);
                Files.deleteIfExists(sqlite);
            }
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
                DatabaseSnapshotService.encrypt(sqlite, encrypted, encryptionKey);
                HuggingFaceFileClient.upload(space, path, encrypted, token);
                log.info("Encrypted production database snapshot pushed to HF Space repository.");
                return true;
            } finally {
                Files.deleteIfExists(sqlite);
                Files.deleteIfExists(encrypted);
            }
        } catch (Exception e) {
            log.error("HF encrypted database backup failed", e);
            return false;
        }
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
            } catch (UnsupportedOperationException ignored) {
                Files.createDirectories(tempDir);
            }
        }
        try {
            FileAttribute<Set<PosixFilePermission>> fileAttr = PosixFilePermissions.asFileAttribute(
                    EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE)
            );
            return Files.createTempFile(tempDir, prefix, suffix, fileAttr);
        } catch (UnsupportedOperationException ignored) {
            Path temp = Files.createTempFile(tempDir, prefix, suffix);
            File file = temp.toFile();
            if (!file.setReadable(true, true) || !file.setWritable(true, true)) {
                log.debug("Notice: Operating system does not support full POSIX permission restriction on {}", temp);
            }
            return temp;
        }
    }

    private boolean isNotConfigured() {
        return token == null || token.isBlank() || encryptionKey == null || encryptionKey.isBlank();
    }
}
