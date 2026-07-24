package com.example.expensetracker.controller;

import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.FileDbSyncService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

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
    void syncFileToDb_returns200() throws Exception {
        when(syncService.syncFileToDb()).thenReturn(Map.of("status", "success", "importedCount", 5));

        mockMvc.perform(post("/api/sync/file-to-db"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.importedCount").value(5));
    }

    @Test
    void syncDbToFile_returns200() throws Exception {
        when(syncService.syncDbToFile()).thenReturn(Map.of("status", "success", "exportedCount", 10));

        mockMvc.perform(post("/api/sync/db-to-file"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.exportedCount").value(10));
    }
}
