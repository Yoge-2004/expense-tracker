package com.example.expensetracker.controller;

import com.example.expensetracker.service.FileDbSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "Sync", description = "File to Database Auto-Sync & HF Spaces Backup Endpoints")
@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final FileDbSyncService syncService;

    public SyncController(FileDbSyncService syncService) {
        this.syncService = syncService;
    }

    @Operation(summary = "Trigger File to DB Sync")
    @SecurityRequirements
    @PostMapping("/file-to-db")
    public ResponseEntity<Map<String, Object>> syncFileToDb() {
        return ResponseEntity.ok(syncService.syncFileToDb());
    }

    @Operation(summary = "Trigger DB to File Backup Sync")
    @SecurityRequirements
    @PostMapping("/db-to-file")
    public ResponseEntity<Map<String, Object>> syncDbToFile() {
        return ResponseEntity.ok(syncService.syncDbToFile());
    }

    @Operation(summary = "Push JSON backup to Hugging Face Spaces",
               description = "Exports the current database to expenses_sync.json and uploads it to the HF Space git repository.")
    @SecurityRequirements
    @PostMapping("/push-to-hf")
    public ResponseEntity<Map<String, Object>> pushToHuggingFace() {
        syncService.syncDbToFile();
        return ResponseEntity.ok(syncService.pushJsonBackupToHuggingFace());
    }

    @Operation(summary = "Pull JSON backup from Hugging Face Spaces",
               description = "Downloads expenses_sync.json from HF Space and imports any missing records into the database.")
    @SecurityRequirements
    @PostMapping("/pull-from-hf")
    public ResponseEntity<Map<String, Object>> pullFromHuggingFace() {
        Map<String, Object> downloadResult = syncService.downloadJsonBackupFromHuggingFace();
        if ("success".equals(downloadResult.get("status"))) {
            syncService.syncFileToDb();
        }
        return ResponseEntity.ok(downloadResult);
    }
}

