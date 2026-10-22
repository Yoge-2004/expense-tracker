package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.AdminLogEntryDto;
import com.example.expensetracker.dto.AdminTelemetryDto;
import com.example.expensetracker.logging.MemoryLogAppender;
import com.example.expensetracker.model.AdminAuditLog;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.AdminAuditLogRepository;
import com.example.expensetracker.service.AdminAuditService;
import com.example.expensetracker.service.AdminMetricsService;
import com.example.expensetracker.service.AdminSystemOpsService;
import com.zaxxer.hikari.HikariDataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.util.List;

/**
 * Implementation of {@link AdminSystemOpsService}.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminSystemOpsServiceImpl implements AdminSystemOpsService {

    private final DataSource dataSource;
    private final AdminAuditLogRepository auditLogRepository;
    private final AdminAuditService auditService;
    private final AdminMetricsService metricsService;
    private final MemoryLogAppender memoryLogAppender;

    @Value("${spring.threads.virtual.enabled:false}")
    private boolean virtualThreadsConfigured;

    @Override
    public AdminTelemetryDto getTelemetry() {
        Runtime rt = Runtime.getRuntime();
        long totalMb = rt.totalMemory() / (1024 * 1024);
        long freeMb = rt.freeMemory() / (1024 * 1024);
        long maxMb = rt.maxMemory() / (1024 * 1024);
        if (maxMb <= 0 || maxMb > 100000) {
            maxMb = Math.max(totalMb, 512);
        }
        long usedMb = Math.max(1, totalMb - freeMb);

        long uptimeSec = Math.max(1, ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        int activeThreads = ManagementFactory.getThreadMXBean().getThreadCount();
        int peakThreads = ManagementFactory.getThreadMXBean().getPeakThreadCount();
        String jvmVer = System.getProperty("java.version");
        String osName = System.getProperty("os.name") + " " + System.getProperty("os.arch");

        double processCpu = 0.0;
        double systemCpu = 0.0;
        long totalPhysRam = 0;
        long freePhysRam = 0;
        try {
            java.lang.management.OperatingSystemMXBean baseOs = ManagementFactory.getOperatingSystemMXBean();
            if (baseOs instanceof com.sun.management.OperatingSystemMXBean sunOs) {
                double pLoad = sunOs.getProcessCpuLoad();
                if (pLoad >= 0) processCpu = Math.round(pLoad * 1000.0) / 10.0;
                double sLoad = sunOs.getCpuLoad();
                if (sLoad >= 0) systemCpu = Math.round(sLoad * 1000.0) / 10.0;
                totalPhysRam = sunOs.getTotalMemorySize() / (1024 * 1024);
                freePhysRam = sunOs.getFreeMemorySize() / (1024 * 1024);
            }
        } catch (Throwable ignored) {}

        if (totalPhysRam <= 0) totalPhysRam = maxMb * 2;
        long usedPhysRam = Math.max(usedMb, totalPhysRam - freePhysRam);

        long diskTotalGb = 0;
        long diskFreeGb = 0;
        try {
            File root = new File(".");
            diskTotalGb = root.getTotalSpace() / (1024 * 1024 * 1024);
            diskFreeGb = root.getUsableSpace() / (1024 * 1024 * 1024);
        } catch (Throwable ignored) {}
        long diskUsedGb = Math.max(0, diskTotalGb - diskFreeGb);

        long nonHeapMb = 0;
        try {
            nonHeapMb = ManagementFactory.getMemoryMXBean().getNonHeapMemoryUsage().getUsed() / (1024 * 1024);
        } catch (Throwable ignored) {}

        String dbProduct = "PostgreSQL";
        String dbUrl = "";
        try (Connection conn = dataSource.getConnection()) {
            dbProduct = conn.getMetaData().getDatabaseProductName();
            dbUrl = conn.getMetaData().getURL();
        } catch (Exception ignored) {}

        int activeConns = 1;
        int idleConns = 1;
        int totalConns = 2;
        int maxPoolSize = 10;
        if (dataSource instanceof HikariDataSource hikari) {
            maxPoolSize = hikari.getMaximumPoolSize();
            if (hikari.getHikariPoolMXBean() != null) {
                activeConns = hikari.getHikariPoolMXBean().getActiveConnections();
                idleConns = hikari.getHikariPoolMXBean().getIdleConnections();
                totalConns = hikari.getHikariPoolMXBean().getTotalConnections();
            } else {
                totalConns = Math.max(1, hikari.getHikariConfigMXBean() != null ? hikari.getHikariConfigMXBean().getMaximumPoolSize() : 10);
                activeConns = 1;
                idleConns = totalConns - activeConns;
            }
        }

        return new AdminTelemetryDto(
                jvmVer,
                uptimeSec,
                usedMb,
                maxMb,
                rt.availableProcessors(),
                activeThreads,
                virtualThreadsConfigured,
                dbProduct,
                dbUrl,
                activeConns,
                idleConns,
                totalConns,
                100,
                processCpu,
                systemCpu,
                usedPhysRam,
                totalPhysRam,
                diskUsedGb,
                diskTotalGb,
                diskFreeGb,
                peakThreads,
                nonHeapMb,
                maxPoolSize,
                osName
        );
    }

    @Override
    public List<AdminLogEntryDto> getApplicationLogs(int lines, String level, String query) {
        return memoryLogAppender.getRecentLogs(lines, level, query);
    }

    @Override
    public void purgeCaches(User actor, String ipAddress, String userAgent) {
        metricsService.refreshMetrics();

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "PURGE_RUNTIME_CACHE",
                "SYSTEM_CACHE",
                "PLATFORM_METRICS",
                "In-memory metrics cache cleared and rebuilt.",
                ipAddress,
                userAgent
        );
        log.info("Runtime cache purged by admin={}", actor.getEmail());
    }

    @Override
    public String exportAuditLogsCsv() {
        List<AdminAuditLog> logs = auditLogRepository.findAll(
                PageRequest.of(0, 5000, Sort.by("createdAt").descending())).getContent();

        StringBuilder csv = new StringBuilder();
        csv.append("ID,Timestamp,ActorUsername,Action,TargetResource,TargetID,IPAddress,Details\n");

        for (AdminAuditLog l : logs) {
            csv.append(l.getId()).append(",")
               .append(l.getCreatedAt()).append(",")
               .append(escapeCsv(l.getActorUsername())).append(",")
               .append(escapeCsv(l.getAction())).append(",")
               .append(escapeCsv(l.getTargetResource())).append(",")
               .append(escapeCsv(l.getTargetId())).append(",")
               .append(escapeCsv(l.getIpAddress())).append(",")
               .append(escapeCsv(l.getDetails())).append("\n");
        }

        return csv.toString();
    }

    private String escapeCsv(String val) {
        if (val == null) return "\"\"";
        return "\"" + val.replace("\"", "\"\"").replace("\n", " ") + "\"";
    }
}
