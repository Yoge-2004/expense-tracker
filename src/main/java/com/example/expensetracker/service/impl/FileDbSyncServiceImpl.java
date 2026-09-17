package com.example.expensetracker.service.impl;

import com.example.expensetracker.service.FileDbSyncService;
import com.example.expensetracker.service.HuggingFaceDatabaseFailoverService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Implementation of FileDbSyncService providing backward-compatible facade for legacy sync endpoints.
 * Database backup persistence is exclusively handled by the encrypted
 * Hugging Face snapshot/failover service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileDbSyncServiceImpl implements FileDbSyncService {

    private final HuggingFaceDatabaseFailoverService failoverService;

    /** Legacy name retained for API compatibility; creates an encrypted HF snapshot. */
    @Override
    public synchronized Map<String, Object> syncDbToFile() {
        log.info("Triggered syncDbToFile via facade");
        return backupResult("Database snapshot → Hugging Face");
    }

    /** Plaintext file imports are intentionally disabled. */
    @Override
    public synchronized Map<String, Object> syncFileToDb() {
        log.info("syncFileToDb invoked; plaintext file sync is intentionally disabled");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "skipped");
        result.put("message", "Plaintext file-to-database sync is disabled; encrypted Hugging Face failover hydration is used instead.");
        return result;
    }

    /** Legacy endpoint compatibility: push the encrypted snapshot to Hugging Face. */
    @Override
    public synchronized Map<String, Object> pushJsonBackupToHuggingFace() {
        log.info("Triggered pushJsonBackupToHuggingFace via facade");
        return backupResult("Encrypted database snapshot → Hugging Face");
    }

    /** Legacy endpoint compatibility: hydration is managed by the failover service. */
    @Override
    public synchronized Map<String, Object> downloadJsonBackupFromHuggingFace() {
        log.info("downloadJsonBackupFromHuggingFace invoked; hydration managed by failover service at startup");
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
