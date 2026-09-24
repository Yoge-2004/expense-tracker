package com.example.expensetracker.service.impl;

import com.example.expensetracker.service.HuggingFaceDatabaseFailoverService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("FileDbSyncServiceImpl Unit Tests")
class FileDbSyncServiceImplTest {

    @Mock
    private HuggingFaceDatabaseFailoverService failoverService;

    private FileDbSyncServiceImpl syncService;

    @BeforeEach
    void setUp() {
        syncService = new FileDbSyncServiceImpl(failoverService);
    }

    @Test
    @DisplayName("syncDbToFile: triggers failover backup and returns success status")
    void syncDbToFile_success() {
        when(failoverService.backupCurrentDatabase()).thenReturn(true);

        Map<String, Object> result = syncService.syncDbToFile();

        assertNotNull(result);
        assertEquals("success", result.get("status"));
        assertTrue(result.get("message").toString().contains("completed successfully"));
        verify(failoverService).backupCurrentDatabase();
    }

    @Test
    @DisplayName("syncDbToFile: handles backup failure cleanly")
    void syncDbToFile_failure() {
        when(failoverService.backupCurrentDatabase()).thenReturn(false);

        Map<String, Object> result = syncService.syncDbToFile();

        assertNotNull(result);
        assertEquals("error", result.get("status"));
        assertTrue(result.get("message").toString().contains("failed or is not configured"));
    }

    @Test
    @DisplayName("syncFileToDb: indicates plaintext sync is disabled")
    void syncFileToDb_skipped() {
        Map<String, Object> result = syncService.syncFileToDb();

        assertNotNull(result);
        assertEquals("skipped", result.get("status"));
        assertTrue(result.get("message").toString().contains("Plaintext file-to-database sync is disabled"));
    }

    @Test
    @DisplayName("pushJsonBackupToHuggingFace: triggers failover backup and returns success status")
    void pushJsonBackupToHuggingFace_success() {
        when(failoverService.backupCurrentDatabase()).thenReturn(true);

        Map<String, Object> result = syncService.pushJsonBackupToHuggingFace();

        assertNotNull(result);
        assertEquals("success", result.get("status"));
        verify(failoverService).backupCurrentDatabase();
    }

    @Test
    @DisplayName("downloadJsonBackupFromHuggingFace: returns managed status message")
    void downloadJsonBackupFromHuggingFace_managed() {
        Map<String, Object> result = syncService.downloadJsonBackupFromHuggingFace();

        assertNotNull(result);
        assertEquals("managed", result.get("status"));
    }
}
