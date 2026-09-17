package com.example.expensetracker.service;

import java.util.Map;

/**
 * Service interface for database synchronization and backup operations.
 */
public interface FileDbSyncService {

    /**
     * Creates a database snapshot backup and synchronizes it.
     */
    Map<String, Object> syncDbToFile();

    /**
     * Restores the database from file storage.
     */
    Map<String, Object> syncFileToDb();

    /**
     * Uploads the encrypted database snapshot backup to Hugging Face.
     */
    Map<String, Object> pushJsonBackupToHuggingFace();

    /**
     * Downloads and restores the database backup from Hugging Face.
     */
    Map<String, Object> downloadJsonBackupFromHuggingFace();
}
