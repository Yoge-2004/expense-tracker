package com.example.expensetracker.service;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;

/**
 * Service that manages two-way data synchronisation between the running
 * database and a local JSON snapshot file ({@code expenses_sync.json}), and
 * optionally pushes/pulls that JSON backup to Hugging Face Hub persistent
 * storage so the data survives Hugging Face Spaces container restarts.
 *
 * <h3>Sync Responsibilities</h3>
 * <ol>
 *   <li><b>HF → Local File</b>: On startup, downloads {@code expenses_sync.json}
 *       from the HF Space git repository (if it exists and is non-empty) to
 *       seed the local file system before the first File → DB import.</li>
 *   <li><b>File → DB</b>: On startup and hourly, reads {@code expenses_sync.json}
 *       and imports any missing expense records into the active database.</li>
 *   <li><b>DB → File</b>: Exports all expense records from the DB back to the
 *       JSON snapshot, keeping the file as the source-of-truth replica.</li>
 *   <li><b>File → HF Spaces</b>: If {@code hf.sync.enabled=true},
 *       uploads {@code expenses_sync.json} to the HF Hub repository via the
 *       Hugging Face Hub REST API every 6 hours and on demand.</li>
 * </ol>
 *
 * <h3>Why JSON instead of SQLite?</h3>
 * <p>Production uses <b>Neon PostgreSQL</b> — no SQLite database file is ever
 * created on the container. The JSON export is a portable, database-agnostic
 * backup that works regardless of which RDBMS is active.</p>
 *
 * <h3>Configuration Properties</h3>
 * <ul>
 *   <li>{@code hf.token} — HF Access Token with write permissions (secret)</li>
 *   <li>{@code hf.space.repo} — HF repo ID, e.g. {@code user/space-name}</li>
 *   <li>{@code hf.sync.enabled} — Enables/disables the HF push/pull (default false)</li>
 * </ul>
 */
@Service
public class FileDbSyncService {

    private static final Logger logger = LoggerFactory.getLogger(FileDbSyncService.class);
    private static final String SYNC_FILE_PATH = "expenses_sync.json";

    /** HF Hub Commit API endpoint: POST /api/spaces/{repoId}/commit/main */
    private static final String HF_COMMIT_URL = "https://huggingface.co/api/spaces/%s/commit/main";

    /** HF Hub raw file download: GET /spaces/{repoId}/resolve/main/{filePath} */
    private static final String HF_DOWNLOAD_URL = "https://huggingface.co/spaces/%s/resolve/main/%s";

    @Value("${hf.token:}")
    private String hfToken;

    @Value("${hf.space.repo:yoge-2004/expense-tracker-backend}")
    private String hfSpaceRepo;

    @Value("${hf.sync.enabled:false}")
    private boolean hfSyncEnabled;

    private final ExpenseRepository expenseRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ObjectMapper objectMapper;

    public FileDbSyncService(ExpenseRepository expenseRepository,
                             UserRepository userRepository,
                             CategoryRepository categoryRepository) {
        this.expenseRepository = expenseRepository;
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
    }

    /**
     * Triggered when the Spring application context is fully ready.
     * <ol>
     *   <li>If HF sync is enabled, downloads the latest JSON backup from HF Spaces
     *       (restores data after container restart).</li>
     *   <li>Imports any records from the JSON file into the database.</li>
     *   <li>Exports the full database back to the JSON file.</li>
     *   <li>Pushes the updated JSON to HF Spaces for persistence.</li>
     * </ol>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        try {
            logger.info("Application ready — initialising File ↔ DB auto-sync…");
            if (hfSyncEnabled) {
                downloadJsonBackupFromHuggingFace();
            }
            syncFileToDb();
            syncDbToFile();
            if (hfSyncEnabled) {
                pushJsonBackupToHuggingFace();
            }
        } catch (Exception e) {
            logger.error("Error during startup sync: {}, continuing application boot.", e.getMessage(), e);
        }
    }

    /**
     * Scheduled hourly sync: File → DB and DB → File.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void scheduledSync() {
        logger.info("Running scheduled hourly File ↔ DB sync…");
        syncFileToDb();
        syncDbToFile();
    }

    /**
     * Scheduled HF Spaces JSON backup push every 6 hours.
     * Only executes when {@code hf.sync.enabled=true}.
     */
    @Scheduled(cron = "0 0 */6 * * *")
    public void scheduledHfPush() {
        if (hfSyncEnabled) {
            logger.info("Running scheduled Hugging Face Spaces JSON backup sync…");
            syncDbToFile();
            pushJsonBackupToHuggingFace();
        }
    }

    /**
     * Reads {@code expenses_sync.json} and imports any expense records not
     * already present in the database. Deduplication is based on description,
     * date, and amount triple.
     *
     * @return a result map with {@code status}, {@code importedCount} or {@code message}
     */
    @Transactional
    public synchronized Map<String, Object> syncFileToDb() {
        Map<String, Object> result = new HashMap<>();
        File syncFile = new File(SYNC_FILE_PATH);
        if (!syncFile.exists()) {
            result.put("status", "skipped");
            result.put("message", "Sync file " + SYNC_FILE_PATH + " does not exist.");
            return result;
        }

        int importedCount = 0;
        try {
            List<Map<String, Object>> records = objectMapper.readValue(syncFile, new TypeReference<List<Map<String, Object>>>() {});
            List<User> users = userRepository.findAll();
            if (users.isEmpty()) {
                result.put("status", "skipped");
                result.put("message", "No users found in database for sync.");
                return result;
            }
            User defaultUser = users.get(0);

            for (Map<String, Object> record : records) {
                String desc = (String) record.get("description");
                String dateStr = (String) record.get("date");
                Object amtObj = record.get("amount");
                String catName = (String) record.get("category");

                if (desc == null || dateStr == null || amtObj == null) continue;

                LocalDate date = LocalDate.parse(dateStr);
                BigDecimal amount = new BigDecimal(amtObj.toString());

                boolean exists = expenseRepository.findByUser(defaultUser).stream()
                        .anyMatch(e -> e.getDescription() != null && e.getDescription().equalsIgnoreCase(desc)
                                && e.getDate() != null && e.getDate().equals(date)
                                && e.getAmount() != null && e.getAmount().compareTo(amount) == 0);

                if (!exists) {
                    Category category = null;
                    if (catName != null && !catName.isBlank()) {
                        category = categoryRepository.findByNameIgnoreCase(catName).orElseGet(() -> {
                            Category newCat = new Category();
                            newCat.setName(catName);
                            return categoryRepository.save(newCat);
                        });
                    } else {
                        category = categoryRepository.findByNameIgnoreCase("Other").orElse(null);
                    }

                    Expense expense = new Expense();
                    expense.setUser(defaultUser);
                    expense.setCategory(category);
                    expense.setAmount(amount);
                    expense.setDescription(desc);
                    expense.setDate(date);
                    expense.setRecurring(Boolean.TRUE.equals(record.get("recurring")));

                    expenseRepository.save(expense);
                    importedCount++;
                }
            }

            result.put("status", "success");
            result.put("importedCount", importedCount);
            logger.info("File→DB sync completed. Imported {} expenses.", importedCount);
        } catch (Exception e) {
            logger.error("Error during File→DB sync", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
        }
        return result;
    }

    /**
     * Exports all expense records from the database into {@code expenses_sync.json},
     * creating or overwriting the file.
     *
     * @return a result map with {@code status}, {@code exportedCount} or {@code message}
     */
    public synchronized Map<String, Object> syncDbToFile() {
        Map<String, Object> result = new HashMap<>();
        try {
            List<Expense> allExpenses = expenseRepository.findAll();
            List<Map<String, Object>> exportData = new ArrayList<>();
            for (Expense exp : allExpenses) {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", exp.getId());
                map.put("userId", exp.getUser() != null ? exp.getUser().getId() : null);
                map.put("amount", exp.getAmount());
                map.put("category", exp.getCategory() != null ? exp.getCategory().getName() : "Uncategorized");
                map.put("description", exp.getDescription());
                map.put("date", exp.getDate() != null ? exp.getDate().toString() : null);
                map.put("recurring", exp.isRecurring());
                exportData.add(map);
            }

            File syncFile = new File(SYNC_FILE_PATH);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(syncFile, exportData);

            result.put("status", "success");
            result.put("exportedCount", exportData.size());
            logger.info("DB→File sync completed. Exported {} expenses to {}.", exportData.size(), SYNC_FILE_PATH);
        } catch (IOException e) {
            logger.error("Error writing DB→File sync", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
        }
        return result;
    }

    /**
     * Downloads {@code expenses_sync.json} from the Hugging Face Space git
     * repository and writes it to the local filesystem. This restores data
     * after a container restart (HF Spaces ephemeral storage is wiped).
     *
     * <p>Only downloads if the local file doesn't exist or is empty/contains
     * only an empty JSON array ({@code []}).</p>
     *
     * @return a result map with {@code status} and details
     */
    public Map<String, Object> downloadJsonBackupFromHuggingFace() {
        Map<String, Object> result = new HashMap<>();

        if (hfToken == null || hfToken.isBlank()) {
            logger.warn("HF_TOKEN is not set. Skipping HF download.");
            result.put("status", "skipped");
            result.put("message", "HF_TOKEN environment variable is not configured.");
            return result;
        }

        // Check if local file already has meaningful data
        File localFile = new File(SYNC_FILE_PATH);
        if (localFile.exists() && localFile.length() > 4) {
            try {
                String content = Files.readString(localFile.toPath()).trim();
                if (!content.equals("[]") && !content.isEmpty()) {
                    logger.info("Local {} already has data ({} bytes). Skipping HF download.",
                            SYNC_FILE_PATH, localFile.length());
                    result.put("status", "skipped");
                    result.put("message", "Local file already has data.");
                    return result;
                }
            } catch (IOException ignored) {
                // Fall through to download
            }
        }

        try {
            String downloadUrl = String.format(HF_DOWNLOAD_URL, hfSpaceRepo, SYNC_FILE_PATH);

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(30))
                    .followRedirects(HttpClient.Redirect.NORMAL)
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(downloadUrl))
                    .header("Authorization", "Bearer " + hfToken)
                    .GET()
                    .timeout(Duration.ofSeconds(60))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            int statusCode = response.statusCode();

            if (statusCode >= 200 && statusCode < 300) {
                String body = response.body().trim();
                if (body.length() > 4 && !body.equals("[]")) {
                    // Validate it's proper JSON before writing
                    objectMapper.readValue(body, new TypeReference<List<Map<String, Object>>>() {});
                    Files.writeString(Path.of(SYNC_FILE_PATH), body,
                            StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                    logger.info("Downloaded {} from HF Spaces ({} bytes).", SYNC_FILE_PATH, body.length());
                    result.put("status", "success");
                    result.put("bytesDownloaded", body.length());
                } else {
                    logger.info("HF Spaces {} is empty. Nothing to restore.", SYNC_FILE_PATH);
                    result.put("status", "skipped");
                    result.put("message", "Remote file is empty.");
                }
            } else if (statusCode == 404) {
                logger.info("{} not found on HF Spaces. First-time deployment.", SYNC_FILE_PATH);
                result.put("status", "skipped");
                result.put("message", "File not found on HF Spaces (first deployment).");
            } else {
                logger.error("HF download failed. HTTP {}: {}", statusCode, response.body());
                result.put("status", "error");
                result.put("httpStatus", statusCode);
                result.put("message", response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Exception during HF Spaces JSON download", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        }
        return result;
    }

    /**
     * Uploads the local {@code expenses_sync.json} file to the Hugging Face
     * Hub repository configured by {@code hf.space.repo}.
     *
     * <p>Uses the HF Hub Commit API to commit the JSON backup file to the
     * Space's git repository. This ensures the data snapshot persists across
     * container restarts.</p>
     *
     * <p>Before uploading, calls {@code syncDbToFile()} to ensure the JSON
     * export is fresh.</p>
     *
     * @return a result map with {@code status}, {@code httpStatus} or {@code message}
     */
    public Map<String, Object> pushJsonBackupToHuggingFace() {
        Map<String, Object> result = new HashMap<>();

        if (hfToken == null || hfToken.isBlank()) {
            logger.warn("HF_TOKEN is not set. Skipping HF JSON backup push.");
            result.put("status", "skipped");
            result.put("message", "HF_TOKEN environment variable is not configured.");
            return result;
        }

        File syncFile = new File(SYNC_FILE_PATH);
        if (!syncFile.exists() || syncFile.length() == 0) {
            logger.warn("JSON sync file not found or empty at {}. Skipping HF push.", SYNC_FILE_PATH);
            result.put("status", "skipped");
            result.put("message", "JSON sync file not found or empty: " + SYNC_FILE_PATH);
            return result;
        }

        try {
            byte[] fileBytes = Files.readAllBytes(syncFile.toPath());
            String base64Content = Base64.getEncoder().encodeToString(fileBytes);

            String uploadUrl = String.format(HF_COMMIT_URL, hfSpaceRepo);
            String jsonPayload = String.format(
                "{\"summary\":\"Automated JSON data backup (%d bytes)\",\"operations\":[{\"operation\":\"uploadOrUpdate\",\"path\":\"%s\",\"content\":\"%s\"}]}",
                fileBytes.length, SYNC_FILE_PATH, base64Content
            );

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(30))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(uploadUrl))
                    .header("Authorization", "Bearer " + hfToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .timeout(Duration.ofSeconds(120))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            int statusCode = response.statusCode();
            if (statusCode >= 200 && statusCode < 300) {
                logger.info("JSON backup successfully pushed to HF Spaces ({} bytes, HTTP {}).",
                        fileBytes.length, statusCode);
                result.put("status", "success");
                result.put("httpStatus", statusCode);
                result.put("bytesUploaded", fileBytes.length);
                result.put("destination", uploadUrl);
            } else {
                logger.error("HF JSON push failed. HTTP {}: {}", statusCode, response.body());
                result.put("status", "error");
                result.put("httpStatus", statusCode);
                result.put("message", response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Exception during HF Spaces JSON backup push", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        }
        return result;
    }
}

