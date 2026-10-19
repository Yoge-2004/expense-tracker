package com.example.expensetracker.controller;

import com.example.expensetracker.resilience.FallbackRecoveryCoordinator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.util.HashMap;
import java.util.Map;

@Tag(name = "Health", description = "Application and Database Health Check Endpoints")
@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    /** Optional: absent when the app runs against a single database. */
    @Autowired(required = false)
    private FallbackRecoveryCoordinator fallbackCoordinator;

    @Operation(summary = "Get system health status",
               description = "Checks database connectivity, JVM memory, and system uptime.")
    @SecurityRequirements
    @GetMapping
    public ResponseEntity<Map<String, Object>> getHealth() {
        Map<String, Object> statusMap = new HashMap<>();
        long uptime = ManagementFactory.getRuntimeMXBean().getUptime();
        statusMap.put("uptimeMs", uptime);
        statusMap.put("timestamp", System.currentTimeMillis());

        Runtime runtime = Runtime.getRuntime();
        Map<String, Object> memoryMap = new HashMap<>();
        memoryMap.put("totalMemoryBytes", runtime.totalMemory());
        memoryMap.put("freeMemoryBytes", runtime.freeMemory());
        memoryMap.put("maxMemoryBytes", runtime.maxMemory());
        statusMap.put("memory", memoryMap);

        boolean dbUp = false;
        try {
            //noinspection SqlNoDataSourceInspection
            Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            dbUp = result != null && result == 1;
        } catch (Exception ex) {
            log.error("Database health check probe failed: {}", ex.getMessage());
        }

        if (dbUp) {
            log.debug("System health check probe passed: UP, uptimeMs={}", uptime);
            statusMap.put("status", "UP");
            statusMap.put("database", "UP");
            if (fallbackCoordinator != null && fallbackCoordinator.isActive()) {
                // "UP" alone hides an outage: say whether the primary or the emergency fallback is answering.
                String databaseMode = fallbackCoordinator.mode().name();
                statusMap.put("databaseMode", databaseMode);
                if (!"PRIMARY".equals(databaseMode)) {
                    statusMap.put("message", "Primary database unavailable; serving the emergency fallback.");
                }
            }
            return ResponseEntity.ok(statusMap);
        } else {
            log.warn("System health check probe failed: DOWN, uptimeMs={}", uptime);
            statusMap.put("status", "DOWN");
            statusMap.put("database", "DOWN");
            statusMap.put("message", "Database service is unavailable.");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(statusMap);
        }
    }
}
