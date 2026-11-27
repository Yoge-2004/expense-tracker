package com.example.expensetracker.infrastructure.resilience;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.Set;
import java.util.Map;
import java.util.LinkedHashMap;

/**
 * Keeps the latest database snapshot in the Hugging Face Space repository.
 */
@Slf4j
@Service
public class HuggingFaceDatabaseFailoverServiceImpl implements HuggingFaceDatabaseFailoverService {

    private String token;

    private String space;

    private String path;

    /** space (default, matches existing deployments), dataset or model. */
    private String repoType;

    private String encryptionKey;

    /** Largest drop in row count, in percent, a routine backup may cause before it is refused. */
    private int maxShrinkPercent = 30;

    /** A changed snapshot is committed to the Space (which restarts it) at most this often; shutdown is exempt. */
    private int minCommitIntervalMinutes = 30;

    /** Tables whose rows change without user edits; they ride along in a snapshot but never trigger a commit alone. */
    private String volatileTablesCsv = "webauthn_challenges,password_reset_otp,platform_daily_metrics,app_notifications,admin_audit_logs,monthly_report_logs,device_tokens";

    private final DatabaseSnapshotService snapshotService;
    private final Clock clock;
    /** Order-independent hash of the data that matters, of the snapshot stored on HF (null = unknown). */
    private volatile String lastPushedContentHash = null;
    private volatile boolean shuttingDown = false;
    /** Rows in the snapshot currently stored on Hugging Face (restored at startup or last pushed); 0 = unknown. */
    private volatile int knownSnapshotRows = 0;
    private volatile boolean writePermissionWarned = false;
    private volatile boolean notConfiguredWarned = false;
    private volatile boolean repoEnsured = false;
    // Visible through getDiagnostics() / GET /api/sync/hf-status, so "why is there
    // no snapshot?" no longer needs access to the Space's container logs.
    private volatile Instant lastAttemptAt = null;
    private volatile Instant lastSuccessAt = null;
    private volatile Instant lastUploadAt = null;
    private volatile String lastError = null;
    private volatile String lastPushedChecksum = null;
    private volatile String lastMirroredChecksum = null;
    private volatile String tokenDiagnosis;

    /** Optional: absent when the app runs against a single database, as in unit tests. */
    private final FallbackRecoveryCoordinator fallbackCoordinator;
    private final PostRestoreHook postRestoreHook;

    @Autowired
    public HuggingFaceDatabaseFailoverServiceImpl(
            DatabaseSnapshotService snapshotService,
            @Autowired(required = false) FallbackRecoveryCoordinator fallbackCoordinator,
            @Autowired(required = false) PostRestoreHook postRestoreHook,
            @Autowired(required = false) HfDatabaseProperties hfProperties,
            @Autowired(required = false) Clock clock) {
        this.snapshotService = snapshotService;
        this.clock = clock != null ? clock : Clock.systemUTC();
        this.fallbackCoordinator = fallbackCoordinator;
        this.postRestoreHook = postRestoreHook;
        HfDatabaseProperties settings = hfProperties != null
                ? hfProperties
                : new HfDatabaseProperties(null, null, null, null, null, null, null, null);
        this.token = settings.token();
        this.space = settings.space();
        this.path = settings.path();
        this.repoType = settings.repoType();
        this.encryptionKey = settings.encryptionKey();
        this.maxShrinkPercent = settings.maxShrinkPercent();
        this.minCommitIntervalMinutes = settings.minCommitIntervalMinutes();
        this.volatileTablesCsv = settings.volatileTables();
    }

    public HuggingFaceDatabaseFailoverServiceImpl(
            DatabaseSnapshotService snapshotService,
            FallbackRecoveryCoordinator fallbackCoordinator,
            PostRestoreHook postRestoreHook,
            HfDatabaseProperties hfProperties) {
        this(snapshotService, fallbackCoordinator, postRestoreHook, hfProperties, null);
    }

    public HuggingFaceDatabaseFailoverServiceImpl(
            DatabaseSnapshotService snapshotService,
            FallbackRecoveryCoordinator fallbackCoordinator,
            PostRestoreHook postRestoreHook) {
        this(snapshotService, fallbackCoordinator, postRestoreHook, null);
    }

    public HuggingFaceDatabaseFailoverServiceImpl(DatabaseSnapshotService snapshotService) {
        this(snapshotService, null, null, null);
    }

    @Override
    @EventListener(ApplicationReadyEvent.class)
    public void initializeFailoverSnapshot() {
        if (isNotConfigured()) {
            log.warn("HF database failover is disabled. {} Both HF_TOKEN and DB_BACKUP_KEY must be set as "
                    + "runtime secrets on the Space (the GitHub Actions secret is a different thing).",
                    missingSettings());
            return;
        }
        tokenDiagnosis = HuggingFaceFileClient.inspectToken(token);
        log.info("HF failover token scope check: {}", tokenDiagnosis);
        // Mirrors the primary's schema into the local fallback and merges or protects any writes an earlier run left behind.
        boolean keepLocalFallback = fallbackCoordinator != null && fallbackCoordinator.prepareFallback();
        boolean snapshotFound = false;
        boolean restoreSkipped = false;
        try {
            Path encrypted = createSecureTempFile(".enc");
            Path sqlite = createSecureTempFile(".sqlite");
            try {
                if (keepLocalFallback) {
                    // The local fallback holds writes Neon has not accepted yet. Restoring would DELETE them.
                    restoreSkipped = true;
                    log.warn("Snapshot restore skipped: the local fallback holds unmerged writes that must not be overwritten.");
                } else if (HuggingFaceFileClient.download(repoType, space, path, encrypted, token)) {
                    DatabaseSnapshotService.decrypt(encrypted, sqlite, encryptionKey);
                    lastPushedChecksum = computeSha256(sqlite);
                    lastPushedContentHash = contentHash(sqlite, volatileTables());
                    snapshotFound = true;
                    int rows = snapshotService.importIntoFallback(sqlite);
                    knownSnapshotRows = rows;
                    lastMirroredChecksum = lastPushedChecksum;
                    log.info("HF encrypted DB snapshot loaded into local failover store: {} rows (SHA-256: {}).",
                            rows, lastPushedChecksum);
                } else {
                    log.info("No HF database snapshot exists yet; will replicate database to HF spaces immediately.");
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
        if (fallbackCoordinator != null) {
            fallbackCoordinator.afterSnapshotRestored();
        }
        if (postRestoreHook != null) {
            try {
                postRestoreHook.onDatabaseRestored();
                log.info("Post-restore hook completed after failover snapshot restore.");
            } catch (Exception e) {
                log.warn("Post-restore hook notice: {}", e.getMessage());
            }
        }
        // If snapshot does not exist on HF space, immediately replicate the current database first!
        if (restoreSkipped) {
            log.info("Initial backup skipped because the restore was skipped; scheduled backups continue.");
        } else if (!snapshotFound) {
            log.info("Snapshot not found on HF spaces; replicating database to HF spaces immediately...");
            backupCurrentDatabase();
        } else {
            Thread.ofVirtual().name("hf-initial-backup").start(this::backupCurrentDatabase);
        }
    }

    /** Snapshot the currently active database on schedule (default hourly). */
    @Override
    @Scheduled(cron = "${hf.db.backup-cron:0 0 * * * *}")
    public void scheduledBackup() {
        backupCurrentDatabase();
    }

    @Override
    public synchronized boolean backupCurrentDatabase() {
        return backupCurrentDatabase(false);
    }

    @Override
    public synchronized boolean forceBackupCurrentDatabase() {
        log.info("Forcefully initiating Hugging Face database snapshot backup, overriding fallback lock guards.");
        return backupCurrentDatabase(true);
    }

    public synchronized boolean backupCurrentDatabase(boolean force) {
        if (isNotConfigured()) {
            if (!notConfiguredWarned) {
                notConfiguredWarned = true;
                log.warn("HF database backup is NOT running: {} Backups need HF_TOKEN, DB_BACKUP_KEY and "
                        + "HF_SPACE_REPO to all be set.", missingSettings());
            }
            return false;
        }
        lastAttemptAt = Instant.now(clock);
        if (!force && fallbackCoordinator != null && !fallbackCoordinator.safeToOverwriteSnapshot()) {
            // The fallback holds writes the primary has not accepted yet, and the stored snapshot is the only other copy.
            lastError = "Skipped: unmerged fallback writes exist, so the stored snapshot was kept.";
            log.warn("HF database backup skipped: unmerged fallback writes exist; keeping the existing snapshot.");
            return false;
        }
        try {
            Path sqlite = createSecureTempFile(".sqlite");
            Path encrypted = createSecureTempFile(".enc");
            try {
                int rows = snapshotService.exportCurrentDatabase(sqlite);
                if (rows <= 0) {
                    // An empty export (fresh database, or the app started while Neon was
                    // unreachable and fell back to an empty local store) must never replace
                    // a good snapshot that is already in the repository.
                    lastError = "Skipped: the database export had 0 rows, so the stored snapshot was not replaced.";
                    log.warn("HF database backup skipped: the export contained 0 rows; keeping the existing snapshot.");
                    return false;
                }
                if (!force && SnapshotShrinkGuard.isSuspiciousShrink(knownSnapshotRows, rows, maxShrinkPercent)) {
                    lastError = "Skipped: the export has " + rows + " rows but the stored snapshot has "
                            + knownSnapshotRows + ", so replacing it could lose data. Run a forced backup if this is intended.";
                    log.error("HF database backup REFUSED: export has {} rows, stored snapshot has {} (more than {}% smaller). "
                            + "Keeping the stored snapshot; a forced backup overrides this.",
                            rows, knownSnapshotRows, maxShrinkPercent);
                    return false;
                }
                String currentChecksum = computeSha256(sqlite);
                if (fallbackCoordinator != null && !currentChecksum.equals(lastMirroredChecksum)
                        && fallbackCoordinator.refreshFallback(sqlite)) {
                    lastMirroredChecksum = currentChecksum;
                }
                String contentHash = contentHash(sqlite, volatileTables());
                if (currentChecksum.equals(lastPushedChecksum) || contentHash.equals(lastPushedContentHash)) {
                    log.info("Database snapshot unchanged (content hash {}); skipping redundant Hugging Face backup.",
                            contentHash);
                    lastSuccessAt = Instant.now(clock);
                    lastError = null;
                    return true;
                }
                // Every upload is a Space commit and restarts the app, so a changed snapshot is committed at most
                // every N minutes. A forced backup and the shutdown backup are exempt (nothing is left to wait for).
                if (!force && !shuttingDown && lastUploadAt != null && minCommitIntervalMinutes > 0
                        && Duration.between(lastUploadAt, Instant.now(clock)).toMinutes() < minCommitIntervalMinutes) {
                    log.info("Database changed but the last commit was under {} min ago; deferring the Hugging Face upload.",
                            minCommitIntervalMinutes);
                    return false;
                }
                DatabaseSnapshotService.encrypt(sqlite, encrypted, encryptionKey);
                if (!repoEnsured) {
                    HuggingFaceFileClient.ensureRepo(repoType, space, true, token);
                    repoEnsured = true;
                }
                HuggingFaceFileClient.upload(repoType, space, path, encrypted, token);
                lastPushedChecksum = currentChecksum;
                lastPushedContentHash = contentHash;
                knownSnapshotRows = rows;
                writePermissionWarned = false;
                lastUploadAt = Instant.now(clock);
                lastSuccessAt = lastUploadAt;
                lastError = null;
                log.info("Encrypted database snapshot pushed to HF {} repository {} (SHA-256: {}, {} rows).",
                        repoType == null ? "space" : repoType, space, currentChecksum, rows);
                return true;
            } finally {
                Files.deleteIfExists(sqlite);
                Files.deleteIfExists(encrypted);
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            lastError = "Backup interrupted.";
            log.error("HF database backup interrupted", ie);
            return false;
        } catch (IllegalStateException ise) {
            lastError = summarize(ise);
            if (ise.getMessage() != null && ise.getMessage().contains("HTTP 403")) {
                if (!writePermissionWarned) {
                    writePermissionWarned = true;
                    String tokenStatus = inspectToken();
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
            lastError = summarize(e);
            log.error("HF encrypted database backup failed", e);
            return false;
        }
    }

    /** One-line, length-bounded description of a failure for the status endpoint (no stack trace, no secrets). */
    private static String summarize(Exception e) {
        String message = e.getMessage() == null || e.getMessage().isBlank()
                ? e.getClass().getSimpleName() : e.getMessage();
        message = message.replaceAll("[\\r\\n]+", " ");
        return message.length() > 300 ? message.substring(0, 300) + "…" : message;
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
        return java.util.HexFormat.of().formatHex(digest.digest());
    }

    private Set<String> volatileTables() {
        Set<String> set = new HashSet<>();
        for (String t : (volatileTablesCsv == null ? "" : volatileTablesCsv).split(",")) {
            if (!t.isBlank()) {
                set.add(t.trim().toLowerCase(Locale.ROOT));
            }
        }
        return set;
    }

    /**
     * Hash of what a user would call "the data": every table except the excluded ones and the fallback's own
     * bookkeeping (fb_*), rows sorted so that export order cannot matter, table names lower-cased so a Neon export
     * and an H2 export of the same data agree. Unlike the file hash it does not change when only log-like tables did.
     */
    static String contentHash(Path sqliteFile, Set<String> excludedTables)
            throws IOException, SQLException, NoSuchAlgorithmException {
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("SQLite JDBC driver not available", e);
        }
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (Connection c = DriverManager.getConnection("jdbc:sqlite:" + sqliteFile.toAbsolutePath())) {
            List<String> tables = new ArrayList<>();
            try (Statement s = c.createStatement();
                 ResultSet rs = s.executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")) {
                while (rs.next()) {
                    tables.add(rs.getString(1));
                }
            }
            tables.sort(String.CASE_INSENSITIVE_ORDER);
            for (String table : tables) {
                String lower = table.toLowerCase(Locale.ROOT);
                if (excludedTables.contains(lower) || lower.startsWith("fb_") || !table.matches("^[a-zA-Z0-9_]+$")) {
                    continue;
                }

                List<String> columns = new ArrayList<>();
                try (Statement s = c.createStatement();
                     ResultSet rs = s.executeQuery("PRAGMA table_info(\"" + table + "\")")) {
                    while (rs.next()) columns.add(rs.getString("name"));
                }
                if (columns.isEmpty()) continue;

                digest.update((byte) 'T');
                updateHashField(digest, lower.getBytes(StandardCharsets.UTF_8));
                for (String column : columns) {
                    digest.update((byte) 'C');
                    updateHashField(digest, column.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
                }

                String orderBy = columns.stream().map(HuggingFaceDatabaseFailoverServiceImpl::quoteSqliteIdentifier)
                        .collect(java.util.stream.Collectors.joining(", "));
                try (Statement s = c.createStatement();
                     ResultSet rs = s.executeQuery("SELECT * FROM \"" + table + "\" ORDER BY " + orderBy)) {
                    while (rs.next()) {
                        digest.update((byte) 'R');
                        for (int i = 1; i <= columns.size(); i++) {
                            Object value = rs.getObject(i);
                            if (value == null) {
                                digest.update((byte) 0);
                            } else {
                                digest.update((byte) 1);
                                byte[] bytes = value instanceof byte[] binary
                                        ? binary : String.valueOf(value).getBytes(StandardCharsets.UTF_8);
                                updateHashField(digest, bytes);
                            }
                        }
                    }
                }
            }
        }
        return java.util.HexFormat.of().formatHex(digest.digest());
    }

    private static String quoteSqliteIdentifier(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    private static void updateHashField(MessageDigest digest, byte[] value) {
        int length = value.length;
        digest.update((byte) (length >>> 24));
        digest.update((byte) (length >>> 16));
        digest.update((byte) (length >>> 8));
        digest.update((byte) length);
        digest.update(value);
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
            } catch (UnsupportedOperationException _) {
                Files.createDirectories(tempDir);
                File dirFile = tempDir.toFile();
                boolean rOk = dirFile.setReadable(true, true);
                boolean wOk = dirFile.setWritable(true, true);
                boolean xOk = dirFile.setExecutable(true, true);
                if (!rOk || !wOk || !xOk) {
                    log.debug("Notice: strict directory permissions could not be fully enforced on temp dir");
                }
            }
        }

        try {
            FileAttribute<Set<PosixFilePermission>> fileAttr = PosixFilePermissions.asFileAttribute(
                    EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE)
            );
            return Files.createTempFile(tempDir, prefix, suffix, fileAttr);
        } catch (UnsupportedOperationException _) {
            Path file = Files.createTempFile(tempDir, prefix, suffix);
            File f = file.toFile();
            boolean rOk = f.setReadable(true, true);
            boolean wOk = f.setWritable(true, true);
            boolean xOk = f.setExecutable(false, false);
            if (!rOk || !wOk || !xOk) {
                log.debug("Notice: strict file permissions could not be fully enforced on temp file");
            }
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
        diag.put("snapshotPath", path);
        diag.put("lastAttemptAt", lastAttemptAt != null ? lastAttemptAt.toString() : "never");
        diag.put("lastSuccessAt", lastSuccessAt != null ? lastSuccessAt.toString() : "never");
        diag.put("lastUploadAt", lastUploadAt != null ? lastUploadAt.toString() : "never");
        diag.put("lastError", lastError != null ? lastError : "none");

        if (!tokenPresent) {
            diag.put("statusMessage", "HF_TOKEN is missing or blank. Please set HF_TOKEN environment variable.");
        } else if (!keyPresent) {
            diag.put("statusMessage", "DB_BACKUP_KEY is missing. Database snapshots require an encryption key.");
        } else if (!spacePresent) {
            diag.put("statusMessage", "HF_SPACE_REPO is missing.");
        } else {
            String diagnosis = inspectToken();
            diag.put("tokenDiagnosis", diagnosis);
            diag.put("statusMessage", diagnosis);
        }
        if (fallbackCoordinator != null) {
            diag.put("fallback", fallbackCoordinator.diagnostics());
        }
        return diag;
    }

    private String inspectToken() {
        String cached = tokenDiagnosis;
        if (cached != null) return cached;
        synchronized (this) {
            if (tokenDiagnosis == null) {
                tokenDiagnosis = HuggingFaceFileClient.inspectToken(token);
            }
            return tokenDiagnosis;
        }
    }

    @PreDestroy
    public void onShutdown() {
        shuttingDown = true;
        log.info("Application shutting down: attempting graceful database snapshot push to Hugging Face...");
        try {
            backupCurrentDatabase();
        } catch (Exception e) {
            log.warn("Graceful shutdown snapshot push could not complete: {}", e.getMessage());
        }
    }
}
