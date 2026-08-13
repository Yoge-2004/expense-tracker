package com.example.expensetracker.controller;

import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.FileDbSyncService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SyncController.class)
@AutoConfigureMockMvc(addFilters = false)
class SyncControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FileDbSyncService syncService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Test
    @DisplayName("POST /api/sync/file-to-db → 200 OK with import count")
    void syncFileToDb_returns200() throws Exception {
        when(syncService.syncFileToDb()).thenReturn(Map.of("status", "success", "importedCount", 5));

        mockMvc.perform(post("/api/sync/file-to-db"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.importedCount").value(5));
    }

    @Test
    @DisplayName("POST /api/sync/db-to-file → 200 OK with export count")
    void syncDbToFile_returns200() throws Exception {
        when(syncService.syncDbToFile()).thenReturn(Map.of("status", "success", "exportedCount", 10));

        mockMvc.perform(post("/api/sync/db-to-file"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.exportedCount").value(10));
    }

    @Test
    @DisplayName("POST /api/sync/push-to-hf → 200 OK with push result")
    void pushToHuggingFace_returns200() throws Exception {
        when(syncService.syncDbToFile()).thenReturn(Map.of("status", "success"));
        when(syncService.pushJsonBackupToHuggingFace())
                .thenReturn(Map.of("status", "success", "bytesUploaded", 2048));

        mockMvc.perform(post("/api/sync/push-to-hf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.bytesUploaded").value(2048));

        verify(syncService).syncDbToFile();
        verify(syncService).pushJsonBackupToHuggingFace();
    }

    @Test
    @DisplayName("POST /api/sync/push-to-hf → 200 OK with skipped when no HF token")
    void pushToHuggingFace_skippedWithoutToken() throws Exception {
        when(syncService.syncDbToFile()).thenReturn(Map.of("status", "success"));
        when(syncService.pushJsonBackupToHuggingFace())
                .thenReturn(Map.of("status", "skipped", "message", "HF_TOKEN environment variable is not configured."));

        mockMvc.perform(post("/api/sync/push-to-hf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("skipped"));
    }

    @Test
    @DisplayName("POST /api/sync/pull-from-hf → 200 OK with download result and triggers import")
    void pullFromHuggingFace_successTriggersImport() throws Exception {
        when(syncService.downloadJsonBackupFromHuggingFace())
                .thenReturn(Map.of("status", "success", "bytesDownloaded", 4096));
        when(syncService.syncFileToDb())
                .thenReturn(Map.of("status", "success", "importedCount", 3));

        mockMvc.perform(post("/api/sync/pull-from-hf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.bytesDownloaded").value(4096));

        verify(syncService).downloadJsonBackupFromHuggingFace();
        verify(syncService).syncFileToDb();
    }

    @Test
    @DisplayName("POST /api/sync/pull-from-hf → 200 OK with skipped does not trigger import")
    void pullFromHuggingFace_skippedDoesNotImport() throws Exception {
        when(syncService.downloadJsonBackupFromHuggingFace())
                .thenReturn(Map.of("status", "skipped", "message", "Local file already has data."));

        mockMvc.perform(post("/api/sync/pull-from-hf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("skipped"));

        verify(syncService).downloadJsonBackupFromHuggingFace();
    }
}

