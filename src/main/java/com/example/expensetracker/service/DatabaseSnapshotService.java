package com.example.expensetracker.service;

import com.example.expensetracker.service.impl.DatabaseSnapshotServiceImpl;

import java.io.IOException;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.sql.SQLException;

/**
 * Service interface for creating, restoring, and encrypting portable database snapshots.
 */
public interface DatabaseSnapshotService {

    /**
     * Exports the live relational database tables into an SQLite database snapshot.
     *
     * @param sqliteFile the target file path for the SQLite snapshot
     * @return the total number of rows written to the snapshot
     * @throws IOException if file system operations fail
     * @throws SQLException if database read operations fail
     */
    int exportCurrentDatabase(Path sqliteFile) throws IOException, SQLException;

    /**
     * Imports an SQLite snapshot into the dedicated local fallback datastore.
     *
     * @param sqliteFile the source SQLite database file
     * @return the number of rows restored
     * @throws IOException if file system operations fail
     * @throws SQLException if database write operations fail
     */
    int importIntoFallback(Path sqliteFile) throws IOException, SQLException;

    /**
     * Encrypts the specified SQLite snapshot using AES-256-GCM.
     */
    static void encrypt(Path input, Path output, String password) throws IOException, GeneralSecurityException {
        DatabaseSnapshotServiceImpl.encrypt(input, output, password);
    }

    /**
     * Decrypts an encrypted snapshot with authenticated header verification.
     */
    static void decrypt(Path input, Path output, String password) throws IOException, GeneralSecurityException {
        DatabaseSnapshotServiceImpl.decrypt(input, output, password);
    }
}
