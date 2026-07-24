package com.example.expensetracker.controller;

import com.example.expensetracker.service.FileDbSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "Sync", description = "File to Database Auto-Sync Endpoints")
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
}
