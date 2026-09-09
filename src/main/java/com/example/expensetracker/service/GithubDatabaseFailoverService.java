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
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Keeps the latest active database in an encrypted SQLite snapshot in the
 * public GitHub repository and hydrates the local emergency store from it.
 */
@Service
public class GithubDatabaseFailoverService {
    private static final Logger log = LoggerFactory.getLogger(GithubDatabaseFailoverService.class);
    private static final String DEFAULT_REPO = "Yoge-2004/expense-tracker";
    private static final String DEFAULT_PATH = "database/expense_tracker.sqlite.enc";

    @Value("${github.db.token:${GITHUB_DB_TOKEN:}}") private String token;
    @Value("${github.db.repo:${GITHUB_DB_REPO:" + DEFAULT_REPO + "}}") private String repo;
    @Value("${github.db.path:" + DEFAULT_PATH + "}") private String path;
    @Value("${github.db.encryption-password:${DB_BACKUP_PASSWORD:}}") private String password;

    private final DataSource dataSource;
    private final DatabaseSnapshotService snapshotService;

    public GithubDatabaseFailoverService(DataSource dataSource, DatabaseSnapshotService snapshotService) {
        this.dataSource = dataSource;
        this.snapshotService = snapshotService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initializeFailoverSnapshot() {
        if (!configured()) {
            log.warn("GitHub DB failover is disabled until GITHUB_DB_TOKEN and DB_BACKUP_PASSWORD are configured.");
            return;
        }
        try {
            Path encrypted = Files.createTempFile("expense-db-", ".enc");
            Path sqlite = Files.createTempFile("expense-db-", ".sqlite");
            try {
                if (download(encrypted)) {
                    DatabaseSnapshotService.decrypt(encrypted, sqlite, password);
                    int rows = snapshotService.importIntoFallback(sqlite);
                    log.info("GitHub encrypted DB snapshot loaded into local failover store: {} rows.", rows);
                } else {
                    log.info("No GitHub DB snapshot exists yet; the failover store will use its local Hibernate schema.");
                }
            } finally {
                Files.deleteIfExists(encrypted);
                Files.deleteIfExists(sqlite);
            }
        } catch (Exception e) {
            log.error("Failed to initialize GitHub database failover", e);
        }
    }

    /** Every 10 minutes: Neon when healthy, local failover DB when Neon is unavailable. */
    @Scheduled(cron = "0 */10 * * * *")
    public void scheduledBackup() { backupCurrentDatabase(); }

    public synchronized Map<String, Object> backupCurrentDatabase() {
        Map<String, Object> result = new LinkedHashMap<>();
        if (!configured()) {
            result.put("status", "skipped");
            result.put("message", "GITHUB_DB_TOKEN and DB_BACKUP_PASSWORD are required.");
            return result;
        }
        try {
            Path sqlite = Files.createTempFile("expense-db-", ".sqlite");
            Path encrypted = Files.createTempFile("expense-db-", ".enc");
            try {
                int rows = snapshotService.exportCurrentDatabase(sqlite);
                DatabaseSnapshotService.encrypt(sqlite, encrypted, password);
                GithubFileClient.CommitResult commit = GithubFileClient.upsert(repo, path, encrypted, token,
                        "chore(database): update encrypted database snapshot");
                result.put("status", commit.success() ? "success" : "error");
                result.put("rows", rows);
                result.put("httpStatus", commit.statusCode());
                result.put("commit", commit.commitSha());
                if (!commit.success()) result.put("message", commit.message());
                return result;
            } finally {
                Files.deleteIfExists(sqlite);
                Files.deleteIfExists(encrypted);
            }
        } catch (Exception e) {
            log.error("GitHub encrypted database backup failed", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
            return result;
        }
    }

    private boolean configured() {
        return token != null && !token.isBlank() && password != null && !password.isBlank();
    }

    private boolean download(Path destination) throws Exception {
        java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create("https://raw.githubusercontent.com/" + repo + "/main/" + path))
                .header("Authorization", "Bearer " + token).GET().build();
        java.net.http.HttpResponse<byte[]> response = java.net.http.HttpClient.newHttpClient()
                .send(request, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) return false;
        Files.write(destination, response.body());
        return true;
    }
}
