package com.example.expensetracker.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.poi.Version;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringBootVersion;
import org.springframework.core.SpringVersion;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.util.HashMap;
import java.util.Map;

/**
 * Health check probe controller.
 * Accessible without authentication so external orchestrators (Docker, K8s) can monitor liveness/readiness.
 */
@RestController
@RequestMapping("/api/health")
@Tag(name = "Health", description = "System liveness, readiness, and runtime architecture diagnostics")
public class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);

    private final DataSource dataSource;

    @Value("${app.database.mode:PRIMARY}")
    private String databaseMode;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Operation(summary = "Liveness probe", description = "Checks whether the service process is up and responding.")
    @SecurityRequirements
    @GetMapping("/live")
    public ResponseEntity<Map<String, Object>> liveness() {
        Map<String, Object> statusMap = new HashMap<>();
        statusMap.put("status", "UP");
        statusMap.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(statusMap);
    }

    @Operation(summary = "Readiness probe", description = "Verifies the application is ready to accept traffic by testing the active database connection.")
    @SecurityRequirements
    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> readiness() {
        Map<String, Object> statusMap = new HashMap<>();
        long uptime = ManagementFactory.getRuntimeMXBean().getUptime();
        statusMap.put("uptimeMs", uptime);

        boolean dbHealthy = false;
        try (Connection conn = dataSource.getConnection()) {
            dbHealthy = conn.isValid(2);
        } catch (Exception e) {
            log.warn("Health check database probe failed: {}", e.getMessage());
        }

        if (dbHealthy) {
            statusMap.put("status", "UP");
            statusMap.put("database", "UP");
            statusMap.put("databaseMode", databaseMode);
            if (!"PRIMARY".equals(databaseMode)) {
                statusMap.put("warning", "Running in fallback mode with in-memory H2 database. Data will not persist across restarts.");
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

    @Operation(summary = "Get dynamic system architecture specification",
               description = "Returns runtime versions, JVM specifications, and core stack architecture.")
    @SecurityRequirements
    @GetMapping("/architecture")
    public ResponseEntity<Map<String, Object>> getArchitecture() {
        Map<String, Object> arch = new HashMap<>();
        String springBootVer = SpringBootVersion.getVersion();
        if (springBootVer == null || springBootVer.isBlank()) {
            springBootVer = "4.1.2";
        }
        String javaVer = System.getProperty("java.version", "27");
        String javaMajor = javaVer.split("[^0-9]")[0];

        arch.put("springBootVersion", springBootVer);
        arch.put("springVersion", SpringVersion.getVersion());
        arch.put("javaVersion", javaVer);
        arch.put("javaMajor", javaMajor);
        arch.put("backendStack", String.format("Spring Boot %s (Java %s)", springBootVer, javaMajor));
        arch.put("apachePoiVersion", "5.5.1");
        arch.put("virtualThreads", true);
        arch.put("frontendStack", "Modern Web ES6+ • Tesseract WebAssembly • PWA");
        arch.put("mobileStack", "React Native 0.88 (Expo SDK 58 • React 19.3)");

        return ResponseEntity.ok(arch);
    }
}
