package com.example.expensetracker.controller;

import com.example.expensetracker.dto.*;
import com.example.expensetracker.exception.BadRequestException;
import com.example.expensetracker.model.Role;
import com.example.expensetracker.security.ClientIpResolver;
import com.example.expensetracker.security.CustomUserDetails;
import com.example.expensetracker.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Controller exposing administrative operations, system telemetry,
 * user moderation, full user CRUD, and non-repudiation audit trails.
 *
 * <p>Protected by RBAC method security: all endpoints require at least
 * {@code ROLE_ADMIN}. Destructive operations additionally require
 * {@code ROLE_SUPER_ADMIN} and mandatory step-up Security PIN verification.</p>
 *
 * @author Yogeshwaran
 */
@Tag(name = "Admin Operations", description = "Platform management, user moderation, telemetry, and resilience control")
@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminMetricsService metricsService;
    private final AdminUserService adminUserService;
    private final AdminAuditService auditService;
    private final AdminMlGovernanceService mlGovernanceService;
    private final AdminNotificationBroadcastService broadcastService;
    private final AdminResilienceService resilienceService;
    private final AdminSystemOpsService systemOpsService;
    private final ClientIpResolver clientIpResolver;
    private final AdminDataService adminDataService;

    @Operation(summary = "Get admin permissions matrix", description = "Returns dynamic RBAC authority permissions for the active operator")
    @GetMapping("/me/permissions")
    public ResponseEntity<AdminPermissionsDto> getPermissions(
            @AuthenticationPrincipal CustomUserDetails principal) {
        return ResponseEntity.ok(adminUserService.getPermissions(principal.getUser()));
    }

    @Operation(summary = "Get high-level summary metrics", description = "Cached KPIs: Total users, total income, total expense, and locked users")
    @GetMapping("/metrics/summary")
    public ResponseEntity<AdminSummaryMetricsDto> getSummaryMetrics() {
        return ResponseEntity.ok(metricsService.getSummaryMetrics());
    }

    @Operation(summary = "Purge and refresh summary metrics", description = "Forces eviction of in-memory metrics cache")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @PostMapping("/metrics/purge-cache")
    public ResponseEntity<AdminSummaryMetricsDto> purgeMetricsCache() {
        metricsService.refreshMetrics();
        return ResponseEntity.ok(metricsService.getSummaryMetrics());
    }

    @Operation(summary = "Get platform volume trends", description = "Pre-aggregated daily volume trends for the requested time window (7, 30, 90 days)")
    @GetMapping("/metrics/trends")
    public ResponseEntity<List<AdminVolumeTrendDto>> getVolumeTrends(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(metricsService.getVolumeTrends(days));
    }

    @Operation(summary = "List users", description = "Returns paginated list of users with search and role filtering")
    @GetMapping("/users")
    public ResponseEntity<Page<AdminUserDto>> getUsers(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Role role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int boundedSize = Math.min(Math.max(size, 1), 50);
        Pageable pageable = PageRequest.of(Math.max(page, 0), boundedSize, Sort.by("id").descending());
        return ResponseEntity.ok(adminUserService.getUsers(query, role, pageable));
    }

    @Operation(summary = "Deep inspect user profile", description = "Returns complete security state, failed PIN attempts, and financial summary for a user")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/users/{userId}/details")
    public ResponseEntity<AdminUserDetailDto> getUserDetails(@PathVariable Long userId) {
        return ResponseEntity.ok(adminUserService.getUserDetails(userId));
    }

    @Operation(summary = "Provision a new user account", description = "Creates a new user account with assigned role and credentials. Requires ADMIN or SUPER_ADMIN and valid step-up PIN.")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @PostMapping("/users")
    public ResponseEntity<AdminUserDto> createUser(
            @RequestBody @Valid AdminUserCreateRequest request,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        AdminUserDto created = adminUserService.createUser(request, principal.getUser(), ip, ua);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @Operation(summary = "Update user account", description = "Modifies user details, role, status, password, or PIN. Requires ADMIN or SUPER_ADMIN and valid step-up PIN.")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @PutMapping("/users/{userId}")
    public ResponseEntity<AdminUserDto> updateUser(
            @PathVariable Long userId,
            @RequestBody @Valid AdminUserUpdateRequest request,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        return ResponseEntity.ok(adminUserService.updateUser(userId, request, principal.getUser(), ip, ua));
    }

    @Operation(summary = "Delete user account", description = "Permanently deletes a user and cascades deletion to child records. Requires SUPER_ADMIN and valid step-up PIN.")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Map<String, String>> deleteUser(
            @PathVariable Long userId,
            @RequestHeader(value = "X-Step-Up-Pin", required = false) String stepUpPin,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        if (stepUpPin == null || stepUpPin.isBlank()) {
            throw new BadRequestException("Step-up Security PIN is required for account deletion");
        }
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        adminUserService.deleteUser(userId, stepUpPin, principal.getUser(), ip, ua);
        return ResponseEntity.ok(Map.of("message", "User account and all associated data permanently deleted."));
    }

    @Operation(summary = "Update user account status", description = "Lock or unlock a user account, with mandatory audit logging")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @PatchMapping("/users/{userId}/status")
    public ResponseEntity<AdminUserDto> updateUserStatus(
            @PathVariable Long userId,
            @RequestBody @Valid AdminUserStatusUpdateRequest request,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        return ResponseEntity.ok(adminUserService.updateUserStatus(userId, request, principal.getUser(), ip, ua));
    }

    @Operation(summary = "Update user role", description = "Elevate or demote a user role. Requires SUPER_ADMIN and valid step-up PIN.")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PostMapping("/users/{userId}/role")
    public ResponseEntity<AdminUserDto> updateUserRole(
            @PathVariable Long userId,
            @RequestBody @Valid AdminUserRoleUpdateRequest request,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        return ResponseEntity.ok(adminUserService.updateUserRole(userId, request, principal.getUser(), ip, ua));
    }

    @Operation(summary = "Reset failed Security PIN lockout", description = "Unlocks a user account locked due to consecutive wrong PIN attempts")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'SUPPORT')")
    @PostMapping("/users/{userId}/reset-pin-lockout")
    public ResponseEntity<Map<String, String>> resetPinLockout(
            @PathVariable Long userId,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        adminUserService.resetPinLockout(userId, principal.getUser(), ip, ua);
        return ResponseEntity.ok(Map.of("message", "User PIN lockout reset successfully"));
    }

    @Operation(summary = "Revoke user sessions", description = "Administratively invalidate active tokens for a user")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @PostMapping("/users/{userId}/revoke-sessions")
    public ResponseEntity<Void> revokeSessions(
            @PathVariable Long userId,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        adminUserService.revokeUserSessions(userId, principal.getUser(), ip, ua);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Query audit logs", description = "Returns immutable records of administrative actions taken")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/audit-logs")
    public ResponseEntity<Page<AdminAuditLogDto>> getAuditLogs(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int boundedSize = Math.min(Math.max(size, 1), 50);
        Pageable pageable = PageRequest.of(Math.max(page, 0), boundedSize, Sort.by("createdAt").descending());
        return ResponseEntity.ok(auditService.getAuditLogs(query, pageable));
    }

    @Operation(summary = "Export audit logs CSV", description = "Streams immutable audit trail as a downloadable CSV for compliance")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/audit-logs/export")
    public ResponseEntity<byte[]> exportAuditLogsCsv() {
        String csv = systemOpsService.exportAuditLogsCsv();
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"audit-trail-" + System.currentTimeMillis() + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    @Operation(summary = "Get ML model health & stats", description = "Returns categorization model health, feedback volumes, and accuracy")
    @GetMapping("/ml/stats")
    public ResponseEntity<AdminMlStatsDto> getMlStats() {
        return ResponseEntity.ok(mlGovernanceService.getModelStats());
    }

    @Operation(summary = "Get ML feedback queue", description = "Paginated list of user category corrections for model retraining review")
    @GetMapping("/ml/feedback")
    public ResponseEntity<Page<AdminMlFeedbackItemDto>> getMlFeedback(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int boundedSize = Math.min(Math.max(size, 1), 50);
        Pageable pageable = PageRequest.of(Math.max(page, 0), boundedSize);
        return ResponseEntity.ok(mlGovernanceService.getFeedbackQueue(pageable));
    }

    @Operation(summary = "Review ML feedback", description = "Approve or dismiss a user correction in the training queue")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @PostMapping("/ml/feedback/{feedbackId}/review")
    public ResponseEntity<Map<String, String>> reviewMlFeedback(
            @PathVariable Long feedbackId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        String decision = body != null ? body.get("decision") : null;
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        mlGovernanceService.reviewFeedback(feedbackId, decision, principal.getUser(), ip, ua);
        return ResponseEntity.ok(Map.of("message", "Feedback marked as " + decision));
    }

    @Operation(summary = "Test ML prediction sandbox", description = "Executes real-time inference on a test description")
    @PostMapping("/ml/test-prediction")
    public ResponseEntity<MlClassificationResponse> testMlPrediction(
            @Valid @RequestBody MlClassificationRequest request) {
        return ResponseEntity.ok(mlGovernanceService.testPrediction(request));
    }

    @Operation(summary = "Broadcast announcement", description = "Dispatches push notifications & inbox announcements to targeted users. Requires PIN.")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @PostMapping("/notifications/broadcast")
    public ResponseEntity<AdminBroadcastResultDto> broadcastAnnouncement(
            @Valid @RequestBody AdminBroadcastRequest request,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        return ResponseEntity.ok(broadcastService.broadcastAnnouncement(request, principal.getUser(), ip, ua));
    }

    @Operation(summary = "Resilience diagnostics", description = "Check database status and Hugging Face snapshot health")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/resilience/status")
    public ResponseEntity<Map<String, Object>> getResilienceStatus() {
        return ResponseEntity.ok(resilienceService.getResilienceStatus());
    }

    @Operation(summary = "Multi-cloud database cluster topology state", description = "Returns real-time health and connection metrics across Server Engine, Neon PostgreSQL, and Hugging Face Spaces")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/resilience/database-state")
    public ResponseEntity<AdminDatabaseTopologyDto> getDatabaseTopology() {
        return ResponseEntity.ok(resilienceService.getDatabaseTopology());
    }

    @Operation(summary = "Trigger on-demand Hugging Face backup", description = "Uploads encrypted database snapshot to Hugging Face. Requires SUPER_ADMIN & PIN.")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PostMapping("/resilience/hf-backup")
    public ResponseEntity<Map<String, Object>> triggerBackup(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        String pin = body != null ? body.get("stepUpPin") : null;
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        boolean ok = resilienceService.triggerSnapshotBackup(principal.getUser(), pin, ip, ua);
        return ResponseEntity.ok(Map.of(
                "success", ok,
                "message", ok ? "Encrypted database snapshot successfully pushed to Hugging Face Space."
                              : "Backup procedure failed. Please verify Space token and write permissions."
        ));
    }

    @Operation(summary = "Get live application logs", description = "Retrieves recent in-memory and rolling application logs with optional level/query filtering")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/system/logs")
    public ResponseEntity<List<AdminLogEntryDto>> getApplicationLogs(
            @RequestParam(defaultValue = "150") int lines,
            @RequestParam(defaultValue = "ALL") String level,
            @RequestParam(required = false) String query) {
        return ResponseEntity.ok(systemOpsService.getApplicationLogs(lines, level, query));
    }

    @Operation(summary = "Get system runtime telemetry", description = "Live JVM memory, thread pool, and HikariCP connection status")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/system/telemetry")
    public ResponseEntity<AdminTelemetryDto> getTelemetry() {
        return ResponseEntity.ok(systemOpsService.getTelemetry());
    }

    @Operation(summary = "Purge runtime cache", description = "Clears and rebuilds platform in-memory caches")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @PostMapping("/system/cache/purge")
    public ResponseEntity<Map<String, String>> purgeCache(
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest httpRequest) {
        String ip = extractClientIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        systemOpsService.purgeCaches(principal.getUser(), ip, ua);
        return ResponseEntity.ok(Map.of("message", "Metrics and query cache purged successfully."));
    }

    @Operation(summary = "Get all platform expenses", description = "Paginated list of all expenses across all users")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/expenses")
    public ResponseEntity<Page<ExpenseDto>> getAllExpenses(
            @RequestParam(required = false) Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        int boundedSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(Math.max(page, 0), boundedSize, Sort.by("id").descending());
        return ResponseEntity.ok(adminDataService.getAllExpenses(userId, pageable));
    }

    @Operation(summary = "Get all platform incomes", description = "Paginated list of all incomes across all users")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/incomes")
    public ResponseEntity<Page<IncomeDto>> getAllIncomes(
            @RequestParam(required = false) Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        int boundedSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(Math.max(page, 0), boundedSize, Sort.by("id").descending());
        return ResponseEntity.ok(adminDataService.getAllIncomes(userId, pageable));
    }

    @Operation(summary = "Export complete platform ledger", description = "Dumps complete multi-tenant ledger as structured JSON")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/database/export/json")
    public ResponseEntity<Map<String, Object>> exportPlatformLedgerJson() {
        return ResponseEntity.ok(adminDataService.exportPlatformLedger());
    }

    @Operation(summary = "Download portable SQLite database snapshot", description = "Generates and streams immediate portable SQLite database snapshot file")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @GetMapping("/database/snapshot/download")
    public ResponseEntity<byte[]> downloadDatabaseSnapshot() throws Exception {
        byte[] bytes = adminDataService.exportSqliteSnapshot();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"expense_tracker_snapshot.sqlite\"")
                .contentType(MediaType.parseMediaType("application/x-sqlite3"))
                .contentLength(bytes.length)
                .body(bytes);
    }

    @Operation(summary = "Trigger immediate database snapshot to Hugging Face", description = "Forces immediate export and push of current database")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @PostMapping("/database/snapshot/trigger")
    public ResponseEntity<Map<String, Object>> triggerDatabaseSnapshot() {
        return ResponseEntity.ok(adminDataService.triggerManualBackup());
    }

    private String extractClientIp(HttpServletRequest request) {
        String ip = clientIpResolver.resolve(request);
        return ip != null ? ip : "127.0.0.1";
    }
}
