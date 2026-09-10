package com.example.expensetracker.controller;

import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.RateLimiterService;
import com.example.expensetracker.service.FileDbSyncService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = SyncController.class)
@AutoConfigureMockMvc(addFilters = false)
class SyncControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired SyncController controller;

    @MockitoBean FileDbSyncService syncService;
    @MockitoBean RateLimiterService rateLimiterService;
    // FIXED: @WebMvcTest scans Filter beans (like JwtAuthenticationFilter) but NOT @Service beans
    // (like JwtService). The filter's constructor requires JwtService, which was missing from
    // the context → "bean of type JwtService could not be found" → 9 test errors. Adding a
    // MockitoBean mock satisfies the dependency. Since addFilters=false, the filter never
    // actually runs, so no methods need to be stubbed on the mock.
    @MockitoBean JwtService jwtService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(controller, "syncSecretKey", "sync-secret");
        when(rateLimiterService.tryAcquire(anyString(), eq(15), any(Duration.class))).thenReturn(true);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void fileToDbRejectsMissingTokenAndUnauthenticatedSession() throws Exception {
        mockMvc.perform(post("/api/sync/file-to-db").with(request -> {
                    request.setRemoteAddr("10.0.0.1");
                    return request;
                }))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value("error"))
                .andExpect(jsonPath("$.message").value("Unauthorized: valid X-Sync-Token required for sync operations."));

        verify(syncService, never()).syncFileToDb();
    }

    @Test
    void fileToDbAcceptsConstantTimeValidatedSyncToken() throws Exception {
        when(syncService.syncFileToDb()).thenReturn(Map.of("status", "success", "imported", 4));

        mockMvc.perform(post("/api/sync/file-to-db")
                        .header("X-Sync-Token", "sync-secret")
                        .with(request -> {
                            request.setRemoteAddr("10.0.0.2");
                            return request;
                        }))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.imported").value(4));

        verify(syncService).syncFileToDb();
        verify(rateLimiterService).tryAcquire(eq("sync:10.0.0.2"), eq(15), any(Duration.class));
    }

    @Test
    void fileToDbRejectsAuthenticatedSessionWithoutSyncToken() throws Exception {
        // SECURITY FIX: previously an authenticated session was accepted as authorization for
        // global sync/backup operations. That was an IDOR / privilege-escalation issue because
        // those operations affect ALL users' data. Now only a valid X-Sync-Token is accepted.
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("jane@example.com", null, List.of()));

        mockMvc.perform(post("/api/sync/file-to-db").with(request -> {
                    request.setRemoteAddr("10.0.0.3");
                    return request;
                }))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value("error"));

        verify(syncService, never()).syncFileToDb();
    }

    @Test
    void dbToFileAcceptsSyncTokenAndReturnsServiceResult() throws Exception {
        when(syncService.syncDbToFile()).thenReturn(Map.of("status", "success", "exported", 9));

        mockMvc.perform(post("/api/sync/db-to-file")
                        .header("X-Sync-Token", "sync-secret"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exported").value(9));

        verify(syncService).syncDbToFile();
    }

    @Test
    void hfPushRequiresSyncTokenEvenWhenSessionIsAuthenticated() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("jane@example.com", null, List.of()));

        mockMvc.perform(post("/api/sync/push-to-hf"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Unauthorized: valid X-Sync-Token required for Hugging Face backup operations."));

        verifyNoInteractions(syncService);
    }

    @Test
    void hfPushGeneratesLocalBackupBeforeUploading() throws Exception {
        when(syncService.syncDbToFile()).thenReturn(Map.of("status", "success"));
        when(syncService.pushJsonBackupToHuggingFace()).thenReturn(Map.of("status", "success", "pushed", true));

        mockMvc.perform(post("/api/sync/push-to-hf").header("X-Sync-Token", "sync-secret"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pushed").value(true));

        var inOrder = inOrder(syncService);
        inOrder.verify(syncService).syncDbToFile();
        inOrder.verify(syncService).pushJsonBackupToHuggingFace();
    }

    @Test
    void hfPullTriggersFileToDbOnlyAfterSuccessfulDownload() throws Exception {
        when(syncService.downloadJsonBackupFromHuggingFace()).thenReturn(Map.of("status", "success", "downloaded", true));

        mockMvc.perform(post("/api/sync/pull-from-hf").header("X-Sync-Token", "sync-secret"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"));

        var inOrder = inOrder(syncService);
        inOrder.verify(syncService).downloadJsonBackupFromHuggingFace();
        inOrder.verify(syncService).syncFileToDb();
    }

    @Test
    void hfPullDoesNotImportWhenDownloadFails() throws Exception {
        when(syncService.downloadJsonBackupFromHuggingFace()).thenReturn(Map.of("status", "error", "message", "backup unavailable"));

        mockMvc.perform(post("/api/sync/pull-from-hf").header("X-Sync-Token", "sync-secret"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("error"))
                .andExpect(jsonPath("$.message").value("backup unavailable"));

        verify(syncService).downloadJsonBackupFromHuggingFace();
        verify(syncService, never()).syncFileToDb();
    }

    @Test
    void rateLimitBlocksSyncBeforeServiceInvocation() throws Exception {
        when(rateLimiterService.tryAcquire(anyString(), eq(15), any(Duration.class))).thenReturn(false);

        mockMvc.perform(post("/api/sync/file-to-db").header("X-Sync-Token", "sync-secret"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value("error"));

        verifyNoInteractions(syncService);
    }
}
