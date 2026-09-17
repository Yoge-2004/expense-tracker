package com.example.expensetracker.service;

import com.example.expensetracker.service.impl.DatabaseSnapshotServiceImpl;

import java.nio.file.Path;

/**
 * Service interface for creating, restoring, and encrypting portable database snapshots.
 */
public interface DatabaseSnapshotService {

    /**
     * Exports the live relational database tables into an SQLite database snapshot.
     *
     * @param sqliteFile the target file path for the SQLite snapshot
     * @return the total number of rows written to the snapshot
     * @throws Exception if extraction or write fails
     */
    int exportCurrentDatabase(Path sqliteFile) throws Exception;

    /**
     * Imports an SQLite snapshot into the dedicated local fallback datastore.
     *
     * @param sqliteFile the source SQLite database file
     * @return the number of rows restored
     * @throws Exception if import fails
     */
    int importIntoFallback(Path sqliteFile) throws Exception;

    /**
     * Encrypts the specified SQLite snapshot using AES-256-GCM.
     */
    static void encrypt(Path input, Path output, String password) throws Exception {
        DatabaseSnapshotServiceImpl.encrypt(input, output, password);
    }

    /**
     * Decrypts an encrypted snapshot with authenticated header verification.
     */
    static void decrypt(Path input, Path output, String password) throws Exception {
        DatabaseSnapshotServiceImpl.decrypt(input, output, password);
    }
}
