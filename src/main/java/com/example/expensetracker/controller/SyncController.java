package com.example.expensetracker.controller;

import com.example.expensetracker.service.FileDbSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "Sync", description = "File to Database Auto-Sync & HF Spaces Backup Endpoints")
@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private static final Logger log = LoggerFactory.getLogger(SyncController.class);

    private final FileDbSyncService syncService;

    public SyncController(FileDbSyncService syncService) {
        this.syncService = syncService;
    }

    @Operation(summary = "Trigger File to DB Sync")
    @SecurityRequirements
    @PostMapping("/file-to-db")
    public ResponseEntity<Map<String, Object>> syncFileToDb() {
        log.info("Manual file-to-db sync requested");
        Map<String, Object> result = syncService.syncFileToDb();
        log.info("File-to-db sync completed with result: status={}", result.get("status"));
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Trigger DB to File Backup Sync")
    @SecurityRequirements
    @PostMapping("/db-to-file")
    public ResponseEntity<Map<String, Object>> syncDbToFile() {
        log.info("Manual db-to-file sync requested");
        Map<String, Object> result = syncService.syncDbToFile();
        log.info("Db-to-file sync completed with result: status={}", result.get("status"));
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Push JSON backup to Hugging Face Spaces",
               description = "Exports the current database to expenses_sync.json and uploads it to the HF Space git repository.")
    @SecurityRequirements
    @PostMapping("/push-to-hf")
    public ResponseEntity<Map<String, Object>> pushToHuggingFace() {
        log.info("Push JSON backup to Hugging Face Spaces requested");
        syncService.syncDbToFile();
        Map<String, Object> result = syncService.pushJsonBackupToHuggingFace();
        log.info("Push to Hugging Face completed: status={}", result.get("status"));
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Pull JSON backup from Hugging Face Spaces",
               description = "Downloads expenses_sync.json from HF Space and imports any missing records into the database.")
    @SecurityRequirements
    @PostMapping("/pull-from-hf")
    public ResponseEntity<Map<String, Object>> pullFromHuggingFace() {
        log.info("Pull JSON backup from Hugging Face Spaces requested");
        Map<String, Object> downloadResult = syncService.downloadJsonBackupFromHuggingFace();
        if ("success".equals(downloadResult.get("status"))) {
            log.info("Pull successful; triggering file-to-db sync to import new records");
            syncService.syncFileToDb();
        } else {
            log.warn("Pull from Hugging Face did not report success: {}", downloadResult);
        }
        return ResponseEntity.ok(downloadResult);
    }
}
