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

@Service
public class FileDbSyncService {

    private static final Logger logger = LoggerFactory.getLogger(FileDbSyncService.class);
    private static final String SYNC_FILE_PATH = "expenses_sync.json";
    private static final String DB_FILE_PATH = "expense_tracker.db";
    private static final String HF_COMMIT_URL = "https://huggingface.co/api/spaces/%s/commit/main";
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

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        try {
            logger.info("Application ready — initialising File ↔ DB auto-sync…");
            if (hfSyncEnabled) downloadJsonBackupFromHuggingFace();
            syncFileToDb();
            syncDbToFile();
            if (hfSyncEnabled) pushJsonBackupToHuggingFace();
        } catch (Exception e) {
            logger.error("Error during startup sync: {}, continuing application boot.", e.getMessage(), e);
        }
    }

    @Scheduled(cron = "0 0 * * * *")
    public void scheduledSync() {
        logger.info("Running scheduled hourly File ↔ DB sync…");
        syncFileToDb();
        syncDbToFile();
    }

    @Scheduled(cron = "0 0 */6 * * *")
    public void scheduledHfPush() {
        if (hfSyncEnabled) {
            logger.info("Running scheduled Hugging Face Spaces backup sync…");
            syncDbToFile();
            pushJsonBackupToHuggingFace();
        }
    }

    @Transactional
    public synchronized Map<String, Object> syncFileToDb() {
        Map<String, Object> result = new HashMap<>();
        File syncFile = new File(SYNC_FILE_PATH);
        if (!syncFile.exists()) {
            result.put("status", "skipped");
            result.put("message", "Sync file " + SYNC_FILE_PATH + " does not exist.");
            return result;
        }

        try {
            List<Map<String, Object>> records = objectMapper.readValue(
                    syncFile, new TypeReference<List<Map<String, Object>>>() {});
            List<User> users = userRepository.findAll();
            if (users.isEmpty()) {
                result.put("status", "skipped");
                result.put("message", "No users found in database for sync.");
                return result;
            }

            Map<Long, User> usersById = new HashMap<>();
            for (User user : users) {
                if (user.getId() != null) usersById.put(user.getId(), user);
            }

            Map<Long, Set<String>> expenseKeysByUser = new HashMap<>();
            Map<Long, List<Category>> categoriesByUser = new HashMap<>();
            List<Category> globalCategories = safeCategoryList(categoryRepository.findByUserIsNull());

            int importedCount = 0;
            int skippedCount = 0;

            for (Map<String, Object> record : records) {
                String desc = asString(record.get("description"));
                String dateStr = asString(record.get("date"));
                Object amountValue = record.get("amount");
                if (desc == null || dateStr == null || amountValue == null) {
                    skippedCount++;
                    continue;
                }

                User targetUser = resolveRecordUser(record, users, usersById);
                if (targetUser == null) {
                    skippedCount++;
                    logger.warn("Skipping backup expense without a resolvable userId; refusing to assign it to an arbitrary account.");
                    continue;
                }

                LocalDate date = LocalDate.parse(dateStr);
                BigDecimal amount = new BigDecimal(amountValue.toString());
                long userKey = targetUser.getId() != null ? targetUser.getId() : System.identityHashCode(targetUser);
                Set<String> existingKeys = expenseKeysByUser.computeIfAbsent(userKey, key -> buildExpenseKeys(expenseRepository.findByUser(targetUser)));
                String expenseKey = buildExpenseKey(desc, date, amount);
                if (existingKeys.contains(expenseKey)) continue;

                List<Category> userCategories = categoriesByUser.computeIfAbsent(
                        userKey, key -> safeCategoryList(categoryRepository.findByUser(targetUser)));
                String catName = asString(record.get("category"));
                Category category = resolveCategory(catName, userCategories, globalCategories, targetUser);

                Expense expense = new Expense();
                expense.setUser(targetUser);
                expense.setCategory(category);
                expense.setAmount(amount);
                expense.setDescription(desc);
                expense.setDate(date);
                expense.setRecurring(asBoolean(record.get("recurring")));

                expenseRepository.save(expense);
                existingKeys.add(expenseKey);
                importedCount++;
            }

            result.put("status", "success");
            result.put("importedCount", importedCount);
            result.put("skippedCount", skippedCount);
            logger.info("File→DB sync completed. Imported {} expenses; skipped {} records.", importedCount, skippedCount);
        } catch (Exception e) {
            logger.error("Error during File→DB sync", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
        }
        return result;
    }

    private User resolveRecordUser(Map<String, Object> record, List<User> users, Map<Long, User> usersById) {
        Object rawUserId = record.get("userId");
        if (rawUserId == null) return users.size() == 1 ? users.get(0) : null;
        try {
            Long userId = rawUserId instanceof Number
                    ? ((Number) rawUserId).longValue()
                    : Long.parseLong(rawUserId.toString());
            return usersById.get(userId);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Category resolveCategory(String name, List<Category> userCategories,
                                     List<Category> globalCategories, User owner) {
        if (name == null || name.isBlank()) name = "Other";
        for (Category category : userCategories) {
            if (category.getName() != null && category.getName().equalsIgnoreCase(name)) return category;
        }
        for (Category category : globalCategories) {
            if (category.getName() != null && category.getName().equalsIgnoreCase(name)) return category;
        }
        Category created = new Category();
        created.setName(name.trim());
        created.setUser(owner);
        return categoryRepository.save(created);
    }

    private Set<String> buildExpenseKeys(List<Expense> expenses) {
        Set<String> keys = new HashSet<>();
        for (Expense expense : expenses) {
            if (expense.getDescription() != null && expense.getDate() != null && expense.getAmount() != null) {
                keys.add(buildExpenseKey(expense.getDescription(), expense.getDate(), expense.getAmount()));
            }
        }
        return keys;
    }

    private String buildExpenseKey(String description, LocalDate date, BigDecimal amount) {
        return description.trim().toLowerCase(Locale.ROOT) + "|" + date + "|" + amount.stripTrailingZeros().toPlainString();
    }

    private List<Category> safeCategoryList(List<Category> categories) {
        return categories == null ? new ArrayList<>() : categories;
    }

    private String asString(Object value) {
        return value == null ? null : value.toString();
    }

    private boolean asBoolean(Object value) {
        if (value instanceof Boolean) return (Boolean) value;
        return value != null && Boolean.parseBoolean(value.toString());
    }

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
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(new File(SYNC_FILE_PATH), exportData);
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

    public Map<String, Object> downloadJsonBackupFromHuggingFace() {
        Map<String, Object> result = new HashMap<>();
        if (hfToken == null || hfToken.isBlank()) {
            result.put("status", "skipped");
            result.put("message", "HF_TOKEN environment variable is not configured.");
            return result;
        }
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).followRedirects(HttpClient.Redirect.NORMAL).build();
        int downloadedFiles = 0;
        int totalBytes = 0;
        try {
            String url = String.format(HF_DOWNLOAD_URL, hfSpaceRepo, SYNC_FILE_PATH);
            HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url)).header("Authorization", "Bearer " + hfToken).GET().timeout(Duration.ofSeconds(60)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                String body = response.body().trim();
                if (body.length() > 4 && !body.equals("[]")) {
                    objectMapper.readValue(body, new TypeReference<List<Map<String, Object>>>() {});
                    Files.writeString(Path.of(SYNC_FILE_PATH), body, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                    downloadedFiles++;
                    totalBytes += body.length();
                }
            }
        } catch (Exception e) {
            logger.warn("Error downloading {}: {}", SYNC_FILE_PATH, e.getMessage());
        }
        try {
            String url = String.format(HF_DOWNLOAD_URL, hfSpaceRepo, DB_FILE_PATH);
            HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url)).header("Authorization", "Bearer " + hfToken).GET().timeout(Duration.ofSeconds(60)).build();
            HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body().length > 0) {
                Files.write(Path.of(DB_FILE_PATH), response.body(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                downloadedFiles++;
                totalBytes += response.body().length;
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

    public Map<String, Object> pushJsonBackupToHuggingFace() {
        Map<String, Object> result = new HashMap<>();
        if (hfToken == null || hfToken.isBlank()) {
            result.put("status", "skipped");
            result.put("message", "HF_TOKEN environment variable is not configured.");
            return result;
        }
        File syncFile = new File(SYNC_FILE_PATH);
        File dbFile = new File(DB_FILE_PATH);
        if ((!syncFile.exists() || syncFile.length() == 0) && (!dbFile.exists() || dbFile.length() == 0)) {
            result.put("status", "skipped");
            result.put("message", "Sync file not found or empty.");
            return result;
        }
        try {
            StringBuilder ndjson = new StringBuilder();
            ndjson.append(objectMapper.writeValueAsString(Map.of("key", "header", "value", Map.of("summary", "Automated data backup from Expense Tracker")))).append("\n");
            int totalUploadedBytes = 0;
            if (syncFile.exists() && syncFile.length() > 0) {
                byte[] bytes = Files.readAllBytes(syncFile.toPath());
                ndjson.append(objectMapper.writeValueAsString(Map.of("key", "file", "value", Map.of("content", Base64.getEncoder().encodeToString(bytes), "encoding", "base64", "path", SYNC_FILE_PATH)))).append("\n");
                totalUploadedBytes += bytes.length;
            }
            if (dbFile.exists() && dbFile.length() > 0) {
                byte[] bytes = Files.readAllBytes(dbFile.toPath());
                ndjson.append(objectMapper.writeValueAsString(Map.of("key", "file", "value", Map.of("content", Base64.getEncoder().encodeToString(bytes), "encoding", "base64", "path", DB_FILE_PATH)))).append("\n");
                totalUploadedBytes += bytes.length;
            }
            String uploadUrl = String.format(HF_COMMIT_URL, hfSpaceRepo);
            HttpRequest request = HttpRequest.newBuilder().uri(URI.create(uploadUrl)).header("Authorization", "Bearer " + hfToken).header("Content-Type", "application/x-ndjson").POST(HttpRequest.BodyPublishers.ofString(ndjson.toString(), StandardCharsets.UTF_8)).timeout(Duration.ofSeconds(120)).build();
            HttpResponse<String> response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build().send(request, HttpResponse.BodyHandlers.ofString());
            int statusCode = response.statusCode();
            if (statusCode >= 200 && statusCode < 300) {
                result.put("status", "success");
                result.put("httpStatus", statusCode);
                result.put("bytesUploaded", totalUploadedBytes);
                result.put("destination", uploadUrl);
            } else {
                result.put("status", "error");
                result.put("httpStatus", statusCode);
                result.put("message", response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Exception during HF Spaces backup push", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
        }
        return result;
    }
}
