package com.example.expensetracker.service;

import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Backward-compatible facade for legacy sync endpoints.
 * Database backup persistence is exclusively handled by the encrypted
 * Hugging Face snapshot/failover service.
 */
@Service
public class FileDbSyncService {
    private final HuggingFaceDatabaseFailoverService failoverService;

    public FileDbSyncService(HuggingFaceDatabaseFailoverService failoverService) {
        this.failoverService = failoverService;
    }

    /** Legacy name retained for API compatibility; creates an encrypted HF snapshot. */
    public synchronized Map<String, Object> syncDbToFile() {
        return backupResult("Database snapshot → Hugging Face");
    }

    /** Plaintext file imports are intentionally disabled. */
    public synchronized Map<String, Object> syncFileToDb() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "skipped");
        result.put("message", "Plaintext file-to-database sync is disabled; encrypted Hugging Face failover hydration is used instead.");
        return result;
    }

    /** Legacy endpoint compatibility: push the encrypted snapshot to Hugging Face. */
    public synchronized Map<String, Object> pushJsonBackupToHuggingFace() {
        return backupResult("Encrypted database snapshot → Hugging Face");
    }

    /** Legacy endpoint compatibility: hydration is managed by the failover service. */
    public synchronized Map<String, Object> downloadJsonBackupFromHuggingFace() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "managed");
        result.put("message", "Encrypted Hugging Face snapshot hydration is managed by the failover service during application startup.");
        return result;
    }

    private Map<String, Object> backupResult(String operation) {
        Map<String, Object> result = new LinkedHashMap<>();
        boolean success = failoverService.backupCurrentDatabase();
        result.put("status", success ? "success" : "error");
        result.put("message", success ? operation + " completed successfully." : operation + " failed or is not configured.");
        return result;
    }
}
