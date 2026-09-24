package com.example.expensetracker.service;

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
}
