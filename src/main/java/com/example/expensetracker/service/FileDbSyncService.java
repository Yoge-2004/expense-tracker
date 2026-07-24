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
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
public class FileDbSyncService {

    private static final Logger logger = LoggerFactory.getLogger(FileDbSyncService.class);
    private static final String SYNC_FILE_PATH = "expenses_sync.json";

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
        logger.info("Application ready. Initializing File-to-DB auto sync...");
        syncFileToDb();
        syncDbToFile();
    }

    @Scheduled(cron = "0 0 * * * *")
    public void scheduledSync() {
        logger.info("Running scheduled File-to-DB auto sync...");
        syncFileToDb();
        syncDbToFile();
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
            logger.info("File-to-DB sync completed. Imported {} expenses.", importedCount);
        } catch (Exception e) {
            logger.error("Error during File-to-DB sync", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
        }
        return result;
    }

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
            logger.info("DB-to-File sync completed. Exported {} expenses to {}.", exportData.size(), SYNC_FILE_PATH);
        } catch (IOException e) {
            logger.error("Error writing DB-to-File sync", e);
            result.put("status", "error");
            result.put("message", e.getMessage());
        }
        return result;
    }
}
