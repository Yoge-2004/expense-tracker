package com.example.expensetracker.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    public HealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Operation(summary = "Get system health status", description = "Checks database connectivity, JVM memory, and system uptime.")
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
            Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            if (result != null && result == 1) {
                dbUp = true;
            }
        } catch (Exception ex) {
            dbUp = false;
        }

        if (dbUp) {
            statusMap.put("status", "UP");
            statusMap.put("database", "UP");
            return ResponseEntity.ok(statusMap);
        } else {
            statusMap.put("status", "DOWN");
            statusMap.put("database", "DOWN");
            statusMap.put("message", "Database service is unavailable.");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(statusMap);
        }
    }
}
