package com.example.expensetracker.service.impl;

import com.example.expensetracker.service.DatabaseSnapshotService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/** The scheduled backup must not replace a bigger stored snapshot with a much smaller export. */
class HuggingFaceBackupGuardTest {

    @Test
    void aMuchSmallerExportDoesNotReplaceTheStoredSnapshot() throws Exception {
        DatabaseSnapshotService snapshots = mock(DatabaseSnapshotService.class);
        when(snapshots.exportCurrentDatabase(any(Path.class))).thenReturn(840);

        HuggingFaceDatabaseFailoverServiceImpl service = new HuggingFaceDatabaseFailoverServiceImpl(snapshots);
        ReflectionTestUtils.setField(service, "token", "hf_test_token");
        ReflectionTestUtils.setField(service, "space", "owner/space");
        ReflectionTestUtils.setField(service, "encryptionKey", "test-key");
        ReflectionTestUtils.setField(service, "path", "database/expense_tracker.sqlite.enc");
        ReflectionTestUtils.setField(service, "knownSnapshotRows", 1_800);

        boolean pushed = service.backupCurrentDatabase();

        assertFalse(pushed);
        verify(snapshots).exportCurrentDatabase(any(Path.class));
        verifyNoMoreInteractions(snapshots);
        String lastError = (String) ReflectionTestUtils.getField(service, "lastError");
        assertTrue(lastError != null && lastError.contains("840") && lastError.contains("1800"), lastError);
    }
}
