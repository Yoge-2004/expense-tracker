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
     * Reports whether the encrypted Hugging Face snapshot is configured and when it last
     * succeeded or failed. Contains no secrets.
     */
    Map<String, Object> getHuggingFaceStatus();

    /**
     * Uploads the encrypted database snapshot backup to Hugging Face.
     */
    Map<String, Object> pushJsonBackupToHuggingFace();

    /**
     * Downloads and restores the database backup from Hugging Face.
     */
    Map<String, Object> downloadJsonBackupFromHuggingFace();
}
