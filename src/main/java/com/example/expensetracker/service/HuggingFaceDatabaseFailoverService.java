package com.example.expensetracker.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;

/** Keeps the latest database snapshot in the Hugging Face Space repository. */
@Service
public class HuggingFaceDatabaseFailoverService {
    private static final Logger log = LoggerFactory.getLogger(HuggingFaceDatabaseFailoverService.class);
    private static final String DEFAULT_SPACE = "Yoge-2004/expense-tracker-backend";
    private static final String DEFAULT_PATH = "database/expense_tracker.sqlite.enc";

    @Value("${hf.db.token:${HF_TOKEN:}}") private String token;
    @Value("${hf.db.space:${HF_SPACE_REPO:" + DEFAULT_SPACE + "}}") private String space;
    @Value("${hf.db.path:" + DEFAULT_PATH + "}") private String path;
    @Value("${hf.db.encryption-key:${DB_BACKUP_KEY:}}") private String encryptionKey;

    private final DataSource dataSource;
    private final DatabaseSnapshotService snapshotService;

    public HuggingFaceDatabaseFailoverService(DataSource dataSource, DatabaseSnapshotService snapshotService) {
        this.dataSource = dataSource;
        this.snapshotService = snapshotService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initializeFailoverSnapshot() {
        if (!configured()) {
            log.warn("HF database failover is disabled until HF_TOKEN and DB_BACKUP_KEY are configured.");
            return;
        }
        try {
            Path encrypted = Files.createTempFile("expense-db-", ".enc");
            Path sqlite = Files.createTempFile("expense-db-", ".sqlite");
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
    @Scheduled(cron = "0 */10 * * * *")
    public void scheduledBackup() { backupCurrentDatabase(); }

    public synchronized boolean backupCurrentDatabase() {
        if (!configured()) return false;
        try {
            Path sqlite = Files.createTempFile("expense-db-", ".sqlite");
            Path encrypted = Files.createTempFile("expense-db-", ".enc");
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

    private boolean configured() {
        return token != null && !token.isBlank() && encryptionKey != null && !encryptionKey.isBlank();
    }
}
