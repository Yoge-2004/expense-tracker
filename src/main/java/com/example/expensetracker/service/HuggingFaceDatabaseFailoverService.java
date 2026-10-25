package com.example.expensetracker.service;

import java.util.Map;

/**
 * Service interface for Hugging Face automated database failover and snapshot backups.
 */
@SuppressWarnings("unused")
public interface HuggingFaceDatabaseFailoverService {

    /**
     * Initializes the local failover snapshot from Hugging Face Space storage on application ready.
     */
    void initializeFailoverSnapshot();

    /**
     * Periodically backs up the active database to the Hugging Face Space repository.
     */
    void scheduledBackup();

    /**
     * Creates and uploads an encrypted database snapshot to Hugging Face.
     *
     * @return {@code true} if successful, {@code false} otherwise
     */
    boolean backupCurrentDatabase();

    /**
     * Forcefully creates and uploads an encrypted database snapshot to Hugging Face,
     * overriding safety guards (e.g. unmerged fallback writes).
     *
     * @return {@code true} if successful, {@code false} otherwise
     */
    default boolean forceBackupCurrentDatabase() {
        return backupCurrentDatabase();
    }

    /**
     * Diagnoses configuration status and token permissions.
     *
     * @return map with configuration status and diagnostic message
     */
    default Map<String, Object> getDiagnostics() {
        return Map.of("configured", false, "statusMessage", "Not implemented");
    }
}
