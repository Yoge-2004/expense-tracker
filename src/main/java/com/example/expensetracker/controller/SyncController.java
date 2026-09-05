package com.example.expensetracker.controller;

import com.example.expensetracker.security.RateLimiterService;
import com.example.expensetracker.service.FileDbSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

@Tag(name = "Sync", description = "File to Database Auto-Sync & HF Spaces Backup Endpoints")
@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private static final Logger log = LoggerFactory.getLogger(SyncController.class);

    private final FileDbSyncService syncService;
    private final RateLimiterService rateLimiterService;

    @Value("${app.sync.secret-key:expense-tracker-auto-sync-secret-key-2026}")
    private String syncSecretKey;

    public SyncController(FileDbSyncService syncService, RateLimiterService rateLimiterService) {
        this.syncService = syncService;
        this.rateLimiterService = rateLimiterService;
    }

    private ResponseEntity<Map<String, Object>> validateSyncAccess(String syncToken, HttpServletRequest request) {
        String clientIp = request != null ? request.getHeader("X-Forwarded-For") : null;
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = request != null ? request.getRemoteAddr() : "127.0.0.1";
        } else {
            clientIp = clientIp.split(",")[0].trim();
        }

        if (!rateLimiterService.tryAcquire("sync:" + clientIp, 15, Duration.ofMinutes(1))) {
            log.warn("Rate limit exceeded for sync requests from IP: {}", clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("status", "error", "message", "Too many sync requests. Please try again later."));
        }

        // Allow if valid X-Sync-Token is provided
        if (syncToken != null && syncToken.equals(syncSecretKey)) {
            return null;
        }

        // Allow if caller has authenticated session
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            return null;
        }

        log.warn("Unauthorized sync attempt from IP: {}", clientIp);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("status", "error", "message", "Unauthorized: Valid X-Sync-Token header or authenticated session required."));
    }

    @Operation(summary = "Trigger File to DB Sync")
    @SecurityRequirements
    @PostMapping("/file-to-db")
    public ResponseEntity<Map<String, Object>> syncFileToDb(
            @RequestHeader(value = "X-Sync-Token", required = false) String syncToken,
            HttpServletRequest request) {
        ResponseEntity<Map<String, Object>> accessError = validateSyncAccess(syncToken, request);
        if (accessError != null) {
            return accessError;
        }

        log.info("Authorized file-to-db sync requested");
        Map<String, Object> result = syncService.syncFileToDb();
        log.info("File-to-db sync completed with result: status={}", result.get("status"));
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Trigger DB to File Backup Sync")
    @SecurityRequirements
    @PostMapping("/db-to-file")
    public ResponseEntity<Map<String, Object>> syncDbToFile(
            @RequestHeader(value = "X-Sync-Token", required = false) String syncToken,
            HttpServletRequest request) {
        ResponseEntity<Map<String, Object>> accessError = validateSyncAccess(syncToken, request);
        if (accessError != null) {
            return accessError;
        }

        log.info("Authorized db-to-file sync requested");
        Map<String, Object> result = syncService.syncDbToFile();
        log.info("Db-to-file sync completed with result: status={}", result.get("status"));
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Push JSON backup to Hugging Face Spaces",
               description = "Exports the current database to expenses_sync.json and uploads it to the HF Space git repository.")
    @SecurityRequirements
    @PostMapping("/push-to-hf")
    public ResponseEntity<Map<String, Object>> pushToHuggingFace(
            @RequestHeader(value = "X-Sync-Token", required = false) String syncToken,
            HttpServletRequest request) {
        ResponseEntity<Map<String, Object>> accessError = validateSyncAccess(syncToken, request);
        if (accessError != null) {
            return accessError;
        }

        log.info("Authorized Push JSON backup to Hugging Face Spaces requested");
        syncService.syncDbToFile();
        Map<String, Object> result = syncService.pushJsonBackupToHuggingFace();
        log.info("Push to Hugging Face completed: status={}", result.get("status"));
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Pull JSON backup from Hugging Face Spaces",
               description = "Downloads expenses_sync.json from HF Space and imports any missing records into the database.")
    @SecurityRequirements
    @PostMapping("/pull-from-hf")
    public ResponseEntity<Map<String, Object>> pullFromHuggingFace(
            @RequestHeader(value = "X-Sync-Token", required = false) String syncToken,
            HttpServletRequest request) {
        ResponseEntity<Map<String, Object>> accessError = validateSyncAccess(syncToken, request);
        if (accessError != null) {
            return accessError;
        }

        log.info("Authorized Pull JSON backup from Hugging Face Spaces requested");
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
