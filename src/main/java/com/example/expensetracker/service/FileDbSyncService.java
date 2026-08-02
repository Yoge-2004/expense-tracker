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
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;

/**
 * Service that manages two-way data synchronisation between the running
 * database and a local JSON snapshot file ({@code expenses_sync.json}), and
 * optionally pushes the raw SQLite database file to Hugging Face Hub
 * persistent storage so the data survives Hugging Face Spaces container
 * restarts.
 *
 * <h3>Sync Responsibilities</h3>
 * <ol>
 *   <li><b>File → DB</b>: On startup and hourly, reads {@code expenses_sync.json}
 *       and imports any missing expense records into the active database.</li>
 *   <li><b>DB → File</b>: Exports all expense records from the DB back to the
 *       JSON snapshot, keeping the file as the source-of-truth replica.</li>
 *   <li><b>SQLite → Hugging Face Spaces</b>: If {@code hf.sync.enabled=true},
 *       uploads {@code expense_tracker.db} to the HF Hub repository via the
 *       Hugging Face Hub REST API every 6 hours and on demand.</li>
 * </ol>
 *
 * <h3>Configuration Properties</h3>
 * <ul>
 *   <li>{@code hf.token} — HF Access Token with write permissions (secret)</li>
 *   <li>{@code hf.space.repo} — HF repo ID, e.g. {@code user/space-name}</li>
 *   <li>{@code hf.sync.enabled} — Enables/disables the SQLite push (default false)</li>
 * </ul>
 */
@Service
public class FileDbSyncService {

    private static final Logger logger = LoggerFactory.getLogger(FileDbSyncService.class);
    private static final String SYNC_FILE_PATH = "expenses_sync.json";
    private static final String DB_FILE_PATH = "expense_tracker.db";

    /** HF Hub upload endpoint pattern: PUT /api/repos/{repoType}/{repoId}/upload/{branch}/{filePath} */
    private static final String HF_UPLOAD_URL = "https://huggingface.co/api/repos/dataset/%s/upload/main/%s";

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
     * Runs the full sync cycle: JSON file → DB, DB → JSON file.
     * If HF sync is enabled, also attempts to push the SQLite DB.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        logger.info("Application ready — initialising File ↔ DB auto-sync…");
        syncFileToDb();
        syncDbToFile();
        if (hfSyncEnabled) {
            pushSqliteToHuggingFace();
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
     * Scheduled HF Spaces SQLite push every 6 hours.
     * Only executes when {@code hf.sync.enabled=true}.
     */
    @Scheduled(cron = "0 0 */6 * * *")
    public void scheduledHfPush() {
        if (hfSyncEnabled) {
            logger.info("Running scheduled Hugging Face Spaces SQLite sync…");
            pushSqliteToHuggingFace();
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
     * Uploads the local {@code expense_tracker.db} SQLite file to the Hugging
     * Face Hub repository configured by {@code hf.space.repo}.
     *
     * <p>Uses the HF Hub REST API:
     * {@code PUT https://huggingface.co/api/repos/{type}/{repo}/upload/main/{filePath}}
     * with an {@code Authorization: Bearer <HF_TOKEN>} header.</p>
     *
     * <p>This ensures that when a Hugging Face Spaces container restarts (which
     * resets ephemeral storage), the SQLite file can be restored from the dataset
     * repository which persists data across restarts.</p>
     *
     * @return a result map with {@code status}, {@code httpStatus} or {@code message}
     */
    public Map<String, Object> pushSqliteToHuggingFace() {
        Map<String, Object> result = new HashMap<>();

        if (hfToken == null || hfToken.isBlank()) {
            logger.warn("HF_TOKEN is not set. Skipping Hugging Face Spaces SQLite push.");
            result.put("status", "skipped");
            result.put("message", "HF_TOKEN environment variable is not configured.");
            return result;
        }

        File dbFile = new File(DB_FILE_PATH);
        if (!dbFile.exists()) {
            logger.warn("SQLite DB file not found at {}. Skipping HF push.", DB_FILE_PATH);
            result.put("status", "skipped");
            result.put("message", "SQLite DB file not found: " + DB_FILE_PATH);
            return result;
        }

        try {
            byte[] dbBytes = Files.readAllBytes(dbFile.toPath());

            String uploadUrl = String.format(HF_UPLOAD_URL, hfSpaceRepo, DB_FILE_PATH);

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(30))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(uploadUrl))
                    .header("Authorization", "Bearer " + hfToken)
                    .header("Content-Type", "application/octet-stream")
                    .PUT(HttpRequest.BodyPublishers.ofByteArray(dbBytes))
                    .timeout(Duration.ofSeconds(120))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            int statusCode = response.statusCode();
            if (statusCode >= 200 && statusCode < 300) {
                logger.info("SQLite DB successfully pushed to HF Spaces ({} bytes, HTTP {}).",
                        dbBytes.length, statusCode);
                result.put("status", "success");
                result.put("httpStatus", statusCode);
                result.put("bytesUploaded", dbBytes.length);
                result.put("destination", uploadUrl);
            } else {
                logger.error("HF push failed. HTTP {}: {}", statusCode, response.body());
                result.put("status", "error");
                result.put("httpStatus", statusCode);
                result.put("message", response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Exception during HF Spaces SQLite push", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        }
        return result;
    }
}
