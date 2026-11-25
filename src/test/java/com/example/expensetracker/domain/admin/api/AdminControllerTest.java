package com.example.expensetracker.domain.admin.api;

import com.example.expensetracker.infrastructure.security.BrowserSessionCookieService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.expensetracker.domain.admin.dto.AdminAuditLogDto;
import com.example.expensetracker.domain.admin.dto.AdminBroadcastRequest;
import com.example.expensetracker.domain.admin.dto.AdminBroadcastResultDto;
import com.example.expensetracker.domain.admin.dto.AdminLogEntryDto;
import com.example.expensetracker.domain.admin.dto.AdminMlStatsDto;
import com.example.expensetracker.domain.admin.dto.AdminPermissionsDto;
import com.example.expensetracker.domain.admin.dto.AdminSummaryMetricsDto;
import com.example.expensetracker.domain.admin.dto.AdminTelemetryDto;
import com.example.expensetracker.domain.admin.dto.AdminUserDetailDto;
import com.example.expensetracker.domain.admin.dto.AdminUserDto;
import com.example.expensetracker.domain.admin.dto.AdminUserRoleUpdateRequest;
import com.example.expensetracker.domain.admin.dto.AdminUserStatusUpdateRequest;
import com.example.expensetracker.domain.admin.dto.AdminVolumeTrendDto;
import com.example.expensetracker.domain.admin.service.AdminAuditService;
import com.example.expensetracker.domain.admin.service.AdminDataService;
import com.example.expensetracker.domain.admin.service.AdminMetricsService;
import com.example.expensetracker.domain.admin.service.AdminMlGovernanceService;
import com.example.expensetracker.domain.admin.service.AdminNotificationBroadcastService;
import com.example.expensetracker.domain.admin.service.AdminResilienceService;
import com.example.expensetracker.domain.admin.service.AdminSystemOpsService;
import com.example.expensetracker.domain.admin.service.AdminUserService;
import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ForbiddenException;
import com.example.expensetracker.infrastructure.security.ClientIpResolver;
import com.example.expensetracker.infrastructure.security.CustomUserDetails;
import com.example.expensetracker.infrastructure.security.CustomUserDetailsService;
import com.example.expensetracker.infrastructure.security.JwtService;




@WebMvcTest(AdminController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminControllerTest {
    @MockitoBean BrowserSessionCookieService browserSessionCookieService;

    @Autowired MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @MockitoBean AdminMetricsService metricsService;
    @MockitoBean AdminUserService adminUserService;
    @MockitoBean AdminAuditService auditService;
    @MockitoBean AdminResilienceService resilienceService;
    @MockitoBean AdminMlGovernanceService mlGovernanceService;
    @MockitoBean AdminNotificationBroadcastService broadcastService;
    @MockitoBean AdminSystemOpsService systemOpsService;
    @MockitoBean AdminDataService adminDataService;
    @MockitoBean ClientIpResolver clientIpResolver;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    private User adminUser;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .id(1L)
                .name("Super Admin")
                .username("superadmin")
                .email("admin@test.com")
                .role(Role.ROLE_SUPER_ADMIN)
                .enabled(true)
                .accountLocked(false)
                .build();

        CustomUserDetails userDetails = new CustomUserDetails(adminUser);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    void getMyPermissionsReturnsOk() throws Exception {
        AdminPermissionsDto perm = new AdminPermissionsDto(
                1L, "superadmin", "ROLE_SUPER_ADMIN", true, true, true, true, true, true, true, true
        );
        when(adminUserService.getPermissions(any())).thenReturn(perm);

        mockMvc.perform(get("/api/admin/me/permissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canModifyRoles").value(true))
                .andExpect(jsonPath("$.canTriggerFailover").value(true));
    }

    @Test
    void getSummaryMetricsReturnsOk() throws Exception {
        AdminSummaryMetricsDto dto = new AdminSummaryMetricsDto(
                100, 2, 500, new BigDecimal("12500.00"), new BigDecimal("25000.00"),
                98, "HEALTHY", "H2", true, LocalDateTime.now()
        );
        when(metricsService.getSummaryMetrics()).thenReturn(dto);

        mockMvc.perform(get("/api/admin/metrics/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers").value(100))
                .andExpect(jsonPath("$.lockedUsers").value(2))
                .andExpect(jsonPath("$.dbStatus").value("HEALTHY"));
    }

    @Test
    void getVolumeTrendsReturnsOk() throws Exception {
        AdminVolumeTrendDto trend = new AdminVolumeTrendDto(
                LocalDate.now(), 100, 20, new BigDecimal("500.00"), new BigDecimal("1000.00")
        );
        when(metricsService.getVolumeTrends(anyInt())).thenReturn(List.of(trend));

        mockMvc.perform(get("/api/admin/metrics/trends").queryParam("days", "14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].users").value(100))
                .andExpect(jsonPath("$[0].expenseCount").value(20));
    }

    @Test
    void getUsersReturnsPaginatedList() throws Exception {
        AdminUserDto userDto = new AdminUserDto(
                2L, "John Doe", "johndoe", "john@example.com", "ROLE_USER",
                true, false, "INR", LocalDateTime.now(), 15
        );
        when(adminUserService.getUsers(any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(userDto)));

        mockMvc.perform(get("/api/admin/users").queryParam("page", "0").queryParam("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].email").value("john@example.com"))
                .andExpect(jsonPath("$.content[0].role").value("ROLE_USER"));
    }

    @Test
    void getUserDetailsReturnsOk() throws Exception {
        AdminUserDetailDto detail = new AdminUserDetailDto(
                2L, "John Doe", "johndoe", "john@example.com", "ROLE_USER",
                true, false, 0, null, "INR", true, null,
                LocalDateTime.now(), 10, new BigDecimal("5000.00"), 2, new BigDecimal("10000.00"), 1
        );
        when(adminUserService.getUserDetails(2L)).thenReturn(detail);

        mockMvc.perform(get("/api/admin/users/2/details"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expenseCount").value(10))
                .andExpect(jsonPath("$.hasSecurityPin").value(true));
    }

    @Test
    void resetPinLockoutReturnsOk() throws Exception {
        mockMvc.perform(post("/api/admin/users/2/reset-pin-lockout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User PIN lockout reset successfully"));
    }

    @Test
    void updateUserStatusReturnsOk() throws Exception {
        AdminUserStatusUpdateRequest req = new AdminUserStatusUpdateRequest(true, true, "Locked for security");
        AdminUserDto updated = new AdminUserDto(
                2L, "John Doe", "johndoe", "john@example.com", "ROLE_USER",
                true, true, "INR", LocalDateTime.now(), 15
        );
        when(adminUserService.updateUserStatus(eq(2L), any(), any(), any(), any()))
                .thenReturn(updated);

        mockMvc.perform(patch("/api/admin/users/2/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountLocked").value(true));
    }

    @Test
    void updateUserRoleReturnsOk() throws Exception {
        AdminUserRoleUpdateRequest req = new AdminUserRoleUpdateRequest(Role.ROLE_ADMIN, "123456", "Promotion");
        AdminUserDto updated = new AdminUserDto(
                2L, "John Doe", "johndoe", "john@example.com", "ROLE_ADMIN",
                true, false, "INR", LocalDateTime.now(), 15
        );
        when(adminUserService.updateUserRole(eq(2L), any(), any(), any(), any()))
                .thenReturn(updated);

        mockMvc.perform(post("/api/admin/users/2/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ROLE_ADMIN"));
    }

    @Test
    void roleChangeByANonSuperAdminIsAnHttp403NotA400() throws Exception {
        AdminUserRoleUpdateRequest req = new AdminUserRoleUpdateRequest(Role.ROLE_ADMIN, "123456", "Promotion");
        when(adminUserService.updateUserRole(eq(2L), any(), any(), any(), any()))
                .thenThrow(new com.example.expensetracker.infrastructure.exception.ForbiddenException(
                        "Only a Super Administrator is authorized to modify user roles"));

        mockMvc.perform(post("/api/admin/users/2/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.message").value("Only a Super Administrator is authorized to modify user roles"));
    }

    @Test
    void getAuditLogsReturnsPaginatedList() throws Exception {
        AdminAuditLogDto logDto = new AdminAuditLogDto(
                1L, 1L, "superadmin", "UPDATE_USER_STATUS", "USER", "2",
                "locked: false -> true", "127.0.0.1", "Mozilla/5.0", LocalDateTime.now()
        );
        when(auditService.getAuditLogs(any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(logDto)));

        mockMvc.perform(get("/api/admin/audit-logs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].action").value("UPDATE_USER_STATUS"))
                .andExpect(jsonPath("$.content[0].actorUsername").value("superadmin"));
    }

    @Test
    void exportAuditLogsCsvReturnsAttachment() throws Exception {
        when(systemOpsService.exportAuditLogsCsv()).thenReturn("ID,Timestamp,Actor\n1,now,admin\n");

        mockMvc.perform(get("/api/admin/audit-logs/export"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment; filename=")))
                .andExpect(content().contentType("text/csv"));
    }

    @Test
    void getMlStatsReturnsOk() throws Exception {
        AdminMlStatsDto stats = new AdminMlStatsDto(50, 10, 40, "v2", 0.94, "ONLINE");
        when(mlGovernanceService.getModelStats()).thenReturn(stats);

        mockMvc.perform(get("/api/admin/ml/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeModelVersion").value("v2"));
    }

    @Test
    void broadcastAnnouncementReturnsOk() throws Exception {
        AdminBroadcastRequest req = new AdminBroadcastRequest("Title", "Message", "ALL", "/dashboard", "123456");
        AdminBroadcastResultDto result = new AdminBroadcastResultDto(100, 98, 2, "COMPLETED");
        when(broadcastService.broadcastAnnouncement(any(), any(), any(), any())).thenReturn(result);

        mockMvc.perform(post("/api/admin/notifications/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(98));
    }

    @Test
    void getTelemetryReturnsOk() throws Exception {
        AdminTelemetryDto telemetry = new AdminTelemetryDto(
                "21", 3600, 128, 512, 8, 24, true, "H2", "jdbc:h2:mem", 2, 8, 10, 50
        );
        when(systemOpsService.getTelemetry()).thenReturn(telemetry);

        mockMvc.perform(get("/api/admin/system/telemetry"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.virtualThreadsEnabled").value(true));
    }

    @Test
    void getApplicationLogsReturnsOk() throws Exception {
        when(systemOpsService.getApplicationLogs(50, "INFO", null))
                .thenReturn(List.of(new AdminLogEntryDto("2026-10-22T22:00:00Z", "INFO", "main", "TestLogger", "System online")));

        mockMvc.perform(get("/api/admin/system/logs")
                .param("lines", "50")
                .param("level", "INFO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].message").value("System online"));
    }

    @Test
    void deleteUserTakesTheStepUpPinFromTheHeaderNotTheUrl() throws Exception {
        mockMvc.perform(delete("/api/admin/users/2").header("X-Step-Up-Pin", "123456"))
                .andExpect(status().isOk());

        org.mockito.Mockito.verify(adminUserService)
                .deleteUser(eq(2L), eq("123456"), any(), any(), any());
    }

    @Test
    void deleteUserWithoutThePinHeaderIsRejected() throws Exception {
        mockMvc.perform(delete("/api/admin/users/2").queryParam("stepUpPin", "123456"))
                .andExpect(status().isBadRequest());

        org.mockito.Mockito.verifyNoInteractions(adminUserService);
    }
    @Test
    void getAllExpensesReturnsPaginatedList() throws Exception {
        when(adminDataService.getAllExpenses(any(), any())).thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/admin/expenses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    private static final String PIN_BODY = "{\"stepUpPin\":\"123456\"}";

    @Test
    void exportPlatformLedgerJsonStreamsDump() throws Exception {
        org.mockito.Mockito.doAnswer(invocation -> {
            java.io.OutputStream out = invocation.getArgument(0);
            out.write("{\"totalUsers\":12}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return null;
        }).when(adminDataService).writePlatformLedger(any());

        mockMvc.perform(post("/api/admin/database/export/json")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content(PIN_BODY))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.totalUsers").value(12));

        org.mockito.Mockito.verify(adminDataService).authorizeBulkExport(
                any(), eq("123456"), eq("EXPORT_PLATFORM_LEDGER"), any(), any());
    }

    @Test
    void exportPlatformLedgerJsonIsNoLongerReachableWithGet() throws Exception {
        mockMvc.perform(get("/api/admin/database/export/json"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void exportPlatformLedgerJsonWritesNothingWhenAuthorisationFails() throws Exception {
        org.mockito.Mockito.doThrow(new com.example.expensetracker.infrastructure.exception.BadRequestException("Invalid security PIN"))
                .when(adminDataService).authorizeBulkExport(any(), any(), any(), any(), any());

        mockMvc.perform(post("/api/admin/database/export/json")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is4xxClientError());

        org.mockito.Mockito.verify(adminDataService, org.mockito.Mockito.never()).writePlatformLedger(any());
    }

    @Test
    void downloadDatabaseSnapshotStreamsSqliteFileAndDeletesIt() throws Exception {
        java.nio.file.Path temp = java.nio.file.Files.createTempFile("et_snapshot_test_", ".sqlite");
        java.nio.file.Files.writeString(temp, "SQLite format 3");
        when(adminDataService.createSqliteSnapshotFile()).thenReturn(temp);

        org.springframework.test.web.servlet.MvcResult started = mockMvc.perform(
                        post("/api/admin/database/snapshot/download")
                                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                                .content(PIN_BODY))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("expense_tracker_snapshot.sqlite")))
                .andExpect(content().contentType("application/x-sqlite3"))
                .andExpect(content().string("SQLite format 3"));

        org.junit.jupiter.api.Assertions.assertFalse(java.nio.file.Files.exists(temp),
                "the temporary snapshot must be removed once it has been sent");
        org.mockito.Mockito.verify(adminDataService).authorizeBulkExport(
                any(), eq("123456"), eq("EXPORT_DATABASE_SNAPSHOT"), any(), any());
    }

    @Test
    void downloadDatabaseSnapshotIsNoLongerReachableWithGet() throws Exception {
        mockMvc.perform(get("/api/admin/database/snapshot/download"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void triggerDatabaseSnapshotRequiresAndForwardsThePin() throws Exception {
        when(resilienceService.triggerSnapshotBackup(any(), eq("123456"), any(), any())).thenReturn(true);

        mockMvc.perform(post("/api/admin/database/snapshot/trigger")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content(PIN_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
