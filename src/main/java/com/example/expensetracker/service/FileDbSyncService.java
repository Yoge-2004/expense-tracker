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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;

/**
 * Service that manages two-way data synchronisation between the running
 * database and local snapshot files ({@code expenses_sync.json} and {@code expense_tracker.db}),
 * and pushes/pulls data backups to Hugging Face Spaces repository so data survives container restarts.
 *
 * <h3>Sync Responsibilities</h3>
 * <ol>
 *   <li><b>HF → Local Files</b>: On startup, downloads {@code expenses_sync.json} and
 *       {@code expense_tracker.db} from the HF Space git repository if they exist.</li>
 *   <li><b>File → DB</b>: Reads {@code expenses_sync.json} and imports missing expense records
 *       into the active database.</li>
 *   <li><b>DB → File</b>: Exports all expense records from the DB back to the JSON snapshot.</li>
 *   <li><b>Files → HF Spaces</b>: If {@code hf.sync.enabled=true} (or on manual trigger),
 *       uploads {@code expenses_sync.json} and {@code expense_tracker.db} via the Hugging Face Hub
 *       Commit API using application/x-ndjson.</li>
 * </ol>
 *
 * <h3>Configuration Properties</h3>
 * <ul>
 *   <li>{@code hf.token} — HF Access Token with write permissions</li>
 *   <li>{@code hf.space.repo} — HF repo ID, e.g. {@code Yoge-2004/expense-tracker-backend}</li>
 *   <li>{@code hf.sync.enabled} — Enables/disables the HF push/pull</li>
 * </ul>
 */
@Service
public class FileDbSyncService {

    private static final Logger logger = LoggerFactory.getLogger(FileDbSyncService.class);
    private static final String SYNC_FILE_PATH = "expenses_sync.json";
    private static final String DB_FILE_PATH = "expense_tracker.db";

    /** HF Hub Commit API endpoint: POST /api/spaces/{repoId}/commit/main */
    private static final String HF_COMMIT_URL = "https://huggingface.co/api/spaces/%s/commit/main";

    /** HF Hub raw file download: GET /spaces/{repoId}/resolve/main/{filePath} */
    private static final String HF_DOWNLOAD_URL = "https://huggingface.co/spaces/%s/resolve/main/%s";

    @Value("${hf.token:}")
    private String hfToken;

    @Value("${hf.space.repo:Yoge-2004/expense-tracker-backend}")
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
     * Scheduled HF Spaces backup push every 6 hours.
     * Only executes when {@code hf.sync.enabled=true}.
     */
    @Scheduled(cron = "0 0 */6 * * *")
    public void scheduledHfPush() {
        if (hfSyncEnabled) {
            logger.info("Running scheduled Hugging Face Spaces backup sync…");
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
    @Transactional(readOnly = true)
    public synchronized Map<String, Object> syncDbToFile() {
        Map<String, Object> result = new HashMap<>();
        try {
            List<Expense> allExpenses = expenseRepository.findAllWithCategoryAndUser();
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
     * Downloads {@code expenses_sync.json} and {@code expense_tracker.db} from the
     * Hugging Face Space git repository if available and writes them to the local filesystem.
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

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        int downloadedFiles = 0;
        int totalBytes = 0;

        // 1. Download expenses_sync.json
        try {
            String jsonDownloadUrl = String.format(HF_DOWNLOAD_URL, hfSpaceRepo, SYNC_FILE_PATH);
            HttpRequest jsonRequest = HttpRequest.newBuilder()
                    .uri(URI.create(jsonDownloadUrl))
                    .header("Authorization", "Bearer " + hfToken)
                    .GET()
                    .timeout(Duration.ofSeconds(60))
                    .build();

            HttpResponse<String> jsonResponse = client.send(jsonRequest, HttpResponse.BodyHandlers.ofString());
            if (jsonResponse.statusCode() >= 200 && jsonResponse.statusCode() < 300) {
                String body = jsonResponse.body().trim();
                if (body.length() > 4 && !body.equals("[]")) {
                    objectMapper.readValue(body, new TypeReference<List<Map<String, Object>>>() {});
                    Files.writeString(Path.of(SYNC_FILE_PATH), body,
                            StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                    logger.info("Downloaded {} from HF Spaces ({} bytes).", SYNC_FILE_PATH, body.length());
                    downloadedFiles++;
                    totalBytes += body.length();
                }
            } else {
                logger.info("HF Spaces {} returned status {}.", SYNC_FILE_PATH, jsonResponse.statusCode());
            }
        } catch (Exception e) {
            logger.warn("Error downloading {}: {}", SYNC_FILE_PATH, e.getMessage());
        }

        // 2. Download expense_tracker.db if present
        try {
            String dbDownloadUrl = String.format(HF_DOWNLOAD_URL, hfSpaceRepo, DB_FILE_PATH);
            HttpRequest dbRequest = HttpRequest.newBuilder()
                    .uri(URI.create(dbDownloadUrl))
                    .header("Authorization", "Bearer " + hfToken)
                    .GET()
                    .timeout(Duration.ofSeconds(60))
                    .build();

            HttpResponse<byte[]> dbResponse = client.send(dbRequest, HttpResponse.BodyHandlers.ofByteArray());
            if (dbResponse.statusCode() >= 200 && dbResponse.statusCode() < 300 && dbResponse.body().length > 0) {
                Files.write(Path.of(DB_FILE_PATH), dbResponse.body(),
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                logger.info("Downloaded {} from HF Spaces ({} bytes).", DB_FILE_PATH, dbResponse.body().length);
                downloadedFiles++;
                totalBytes += dbResponse.body().length;
            } else {
                logger.info("HF Spaces {} returned status {}.", DB_FILE_PATH, dbResponse.statusCode());
            }
        } catch (Exception e) {
            logger.warn("Error downloading {}: {}", DB_FILE_PATH, e.getMessage());
        }

        if (downloadedFiles > 0) {
            result.put("status", "success");
            result.put("bytesDownloaded", totalBytes);
            result.put("filesDownloaded", downloadedFiles);
        } else {
            result.put("status", "skipped");
            result.put("message", "No remote files were downloaded.");
        }
        return result;
    }

    /**
     * Uploads the local {@code expenses_sync.json} and {@code expense_tracker.db} (if present)
     * to the Hugging Face Hub repository configured by {@code hf.space.repo} using NDJSON commit API.
     *
     * @return a result map with {@code status}, {@code httpStatus} or {@code message}
     */
    public Map<String, Object> pushJsonBackupToHuggingFace() {
        Map<String, Object> result = new HashMap<>();

        if (hfToken == null || hfToken.isBlank()) {
            logger.warn("HF_TOKEN is not set. Skipping HF backup push.");
            result.put("status", "skipped");
            result.put("message", "HF_TOKEN environment variable is not configured.");
            return result;
        }

        File syncFile = new File(SYNC_FILE_PATH);
        File dbFile = new File(DB_FILE_PATH);

        if ((!syncFile.exists() || syncFile.length() == 0) && (!dbFile.exists() || dbFile.length() == 0)) {
            logger.warn("No sync files found to upload. Skipping HF push.");
            result.put("status", "skipped");
            result.put("message", "Sync file not found or empty.");
            return result;
        }

        try {
            StringBuilder ndjson = new StringBuilder();
            // 1. Commit header
            Map<String, Object> headerObj = Map.of(
                    "key", "header",
                    "value", Map.of("summary", "Automated data backup from Expense Tracker")
            );
            ndjson.append(objectMapper.writeValueAsString(headerObj)).append("\n");

            int totalUploadedBytes = 0;

            // 2. Add expenses_sync.json if present
            if (syncFile.exists() && syncFile.length() > 0) {
                byte[] jsonBytes = Files.readAllBytes(syncFile.toPath());
                String base64Json = Base64.getEncoder().encodeToString(jsonBytes);
                Map<String, Object> fileObj = Map.of(
                        "key", "file",
                        "value", Map.of(
                                "content", base64Json,
                                "encoding", "base64",
                                "path", SYNC_FILE_PATH
                        )
                );
                ndjson.append(objectMapper.writeValueAsString(fileObj)).append("\n");
                totalUploadedBytes += jsonBytes.length;
            }

            // 3. Add expense_tracker.db if present
            if (dbFile.exists() && dbFile.length() > 0) {
                byte[] dbBytes = Files.readAllBytes(dbFile.toPath());
                String base64Db = Base64.getEncoder().encodeToString(dbBytes);
                Map<String, Object> dbObj = Map.of(
                        "key", "file",
                        "value", Map.of(
                                "content", base64Db,
                                "encoding", "base64",
                                "path", DB_FILE_PATH
                        )
                );
                ndjson.append(objectMapper.writeValueAsString(dbObj)).append("\n");
                totalUploadedBytes += dbBytes.length;
            }

            String uploadUrl = String.format(HF_COMMIT_URL, hfSpaceRepo);

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(30))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(uploadUrl))
                    .header("Authorization", "Bearer " + hfToken)
                    .header("Content-Type", "application/x-ndjson")
                    .POST(HttpRequest.BodyPublishers.ofString(ndjson.toString(), StandardCharsets.UTF_8))
                    .timeout(Duration.ofSeconds(120))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            int statusCode = response.statusCode();
            if (statusCode >= 200 && statusCode < 300) {
                logger.info("Backup successfully pushed to HF Spaces ({} bytes, HTTP {}).",
                        totalUploadedBytes, statusCode);
                result.put("status", "success");
                result.put("httpStatus", statusCode);
                result.put("bytesUploaded", totalUploadedBytes);
                result.put("destination", uploadUrl);
            } else {
                logger.error("HF backup push failed. HTTP {}: {}", statusCode, response.body());
                result.put("status", "error");
                result.put("httpStatus", statusCode);
                result.put("message", response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Exception during HF Spaces backup push", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        }
        return result;
    }
}
