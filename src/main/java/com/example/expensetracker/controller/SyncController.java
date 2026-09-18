package com.example.expensetracker.controller;

import com.example.expensetracker.security.RateLimiterService;
import com.example.expensetracker.service.FileDbSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.MessageDigest;
import java.time.Duration;
import java.util.Map;

/**
 * REST controller providing endpoints to manually trigger two-way synchronisation
 * between the H2 database and the local JSON file snapshot (expenses_sync.json).
 *
 * <p>Access control: Local sync endpoints (file-to-db, db-to-file) are accessible
 * from loopback (localhost) without authentication (for cron/scripts), or from
 * any client that presents a valid X-Sync-Token header. Hugging Face endpoints
 * strictly require a valid X-Sync-Token header regardless of caller origin.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 */
@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/sync")
@Tag(name = "Sync", description = "Endpoints for synchronising data between the database, local file snapshots, and Hugging Face Spaces.")
public class SyncController {

    private final FileDbSyncService syncService;
    private final RateLimiterService rateLimiterService;

    @Value("${SYNC_SECRET_KEY:}")
    private String syncSecretKey;


    private boolean isLoopbackRequest(HttpServletRequest request) {
        if (request == null) return false;
        String addr = request.getRemoteAddr();
        return "127.0.0.1".equals(addr) || "0:0:0:0:0:0:0:1".equals(addr) || "::1".equals(addr);
    }

    private boolean hasValidSyncToken(String syncToken) {
        if (syncSecretKey == null || syncSecretKey.isBlank()) return false;
        if (syncToken == null || syncToken.isBlank()) return false;
        return MessageDigest.isEqual(
                syncToken.trim().getBytes(java.nio.charset.StandardCharsets.UTF_8),
                syncSecretKey.trim().getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
    }

    private ResponseEntity<Map<String, Object>> validateLocalSyncAccess(String syncToken, HttpServletRequest request) {
        String clientIp = request != null ? request.getRemoteAddr() : "unknown";
        if (!rateLimiterService.tryAcquire("sync:" + clientIp, 15, Duration.ofMinutes(1))) {
            log.warn("Rate limit exceeded for sync operations from IP={}", clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("status", "error", "message", "Too many sync requests. Please try again later."));
        }

        if (isLoopbackRequest(request)) return null;
        if (hasValidSyncToken(syncToken)) return null;

        log.warn("Unauthorized sync attempt from IP={}", clientIp);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("status", "error", "message", "Unauthorized: valid X-Sync-Token required for sync operations."));
    }

    private ResponseEntity<Map<String, Object>> validateHfSyncAccess(String syncToken, HttpServletRequest request) {
        String clientIp = request != null ? request.getRemoteAddr() : "unknown";
        if (!rateLimiterService.tryAcquire("sync-hf:" + clientIp, 5, Duration.ofMinutes(1))) {
            log.warn("Rate limit exceeded for Hugging Face sync from IP={}", clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("status", "error", "message", "Too many Hugging Face sync requests. Please try again later."));
        }

        if (hasValidSyncToken(syncToken)) return null;

        log.warn("Unauthorized HF sync attempt");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("status", "error", "message", "Unauthorized: valid X-Sync-Token required for Hugging Face backup operations."));
    }

    @Operation(summary = "Trigger File to DB Sync")
    @SecurityRequirements
    @PostMapping("/file-to-db")
    public ResponseEntity<Map<String, Object>> syncFileToDb(
            @RequestHeader(value = "X-Sync-Token", required = false) String syncToken,
            HttpServletRequest request) {
        ResponseEntity<Map<String, Object>> accessError = validateLocalSyncAccess(syncToken, request);
        if (accessError != null) return accessError;

        log.info("Authorized file-to-db sync requested");
        Map<String, Object> result = syncService.syncFileToDb();
        log.info("File-to-db sync completed with result: status={}", result.get("status"));
        if ("error".equals(result.get("status"))) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Trigger DB to File Backup Sync")
    @SecurityRequirements
    @PostMapping("/db-to-file")
    public ResponseEntity<Map<String, Object>> syncDbToFile(
            @RequestHeader(value = "X-Sync-Token", required = false) String syncToken,
            HttpServletRequest request) {
        ResponseEntity<Map<String, Object>> accessError = validateLocalSyncAccess(syncToken, request);
        if (accessError != null) return accessError;

        log.info("Authorized db-to-file sync requested");
        Map<String, Object> result = syncService.syncDbToFile();
        log.info("Db-to-file sync completed with result: status={}", result.get("status"));
        if ("error".equals(result.get("status"))) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Push JSON backup to Hugging Face Spaces",
               description = "Exports the current database to expenses_sync.json and uploads it to the HF Space git repository.")
    @SecurityRequirements
    @PostMapping("/push-to-hf")
    public ResponseEntity<Map<String, Object>> pushToHuggingFace(
            @RequestHeader(value = "X-Sync-Token", required = false) String syncToken,
            HttpServletRequest request) {
        ResponseEntity<Map<String, Object>> accessError = validateHfSyncAccess(syncToken, request);
        if (accessError != null) return accessError;

        log.info("Authorized Push JSON backup to Hugging Face Spaces requested");
        syncService.syncDbToFile();
        Map<String, Object> result = syncService.pushJsonBackupToHuggingFace();
        log.info("Push to Hugging Face completed: status={}", result.get("status"));
        if ("error".equals(result.get("status"))) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Pull JSON backup from Hugging Face Spaces",
               description = "Downloads expenses_sync.json from HF Space and imports any missing records into the database.")
    @SecurityRequirements
    @PostMapping("/pull-from-hf")
    public ResponseEntity<Map<String, Object>> pullFromHuggingFace(
            @RequestHeader(value = "X-Sync-Token", required = false) String syncToken,
            HttpServletRequest request) {
        ResponseEntity<Map<String, Object>> accessError = validateHfSyncAccess(syncToken, request);
        if (accessError != null) return accessError;

        log.info("Authorized Pull JSON backup from Hugging Face Spaces requested");
        Map<String, Object> downloadResult = syncService.downloadJsonBackupFromHuggingFace();
        String status = (String) downloadResult.get("status");
        if ("success".equals(status) || "managed".equals(status)) {
            log.info("Pull successful (status={}); triggering file-to-db sync to import new records", status);
            syncService.syncFileToDb();
            return ResponseEntity.ok(downloadResult);
        } else {
            log.warn("Pull from Hugging Face did not report success: {}", downloadResult);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(downloadResult);
        }
    }
}
