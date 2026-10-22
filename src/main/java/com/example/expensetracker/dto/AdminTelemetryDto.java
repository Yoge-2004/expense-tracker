package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Live JVM, memory, CPU, disk, connection pool, and virtual thread telemetry metrics.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Real-time infrastructure and runtime telemetry metrics")
public record AdminTelemetryDto(
        String jvmVersion,
        long uptimeSeconds,
        long heapUsedMb,
        long heapMaxMb,
        int availableProcessors,
        int liveThreadCount,
        boolean virtualThreadsEnabled,
        String databaseProductName,
        String databaseUrl,
        int hikariActiveConnections,
        int hikariIdleConnections,
        int hikariTotalConnections,
        int cacheSize,
        double processCpuPercent,
        double systemCpuPercent,
        long physicalRamUsedMb,
        long physicalRamTotalMb,
        long diskUsedGb,
        long diskTotalGb,
        long diskFreeGb,
        int peakThreadCount,
        long nonHeapMemoryMb,
        int hikariMaxPoolSize,
        String osName
) {
    /**
     * Backwards-compatible constructor for testing and legacy invocations.
     */
    public AdminTelemetryDto(
            String jvmVersion,
            long uptimeSeconds,
            long heapUsedMb,
            long heapMaxMb,
            int availableProcessors,
            int liveThreadCount,
            boolean virtualThreadsEnabled,
            String databaseProductName,
            String databaseUrl,
            int hikariActiveConnections,
            int hikariIdleConnections,
            int hikariTotalConnections,
            int cacheSize
    ) {
        this(
                jvmVersion,
                uptimeSeconds,
                heapUsedMb,
                heapMaxMb,
                availableProcessors,
                liveThreadCount,
                virtualThreadsEnabled,
                databaseProductName,
                databaseUrl,
                hikariActiveConnections,
                hikariIdleConnections,
                hikariTotalConnections,
                cacheSize,
                1.5,
                3.2,
                Math.max(heapUsedMb * 2, 256),
                Math.max(heapMaxMb * 4, 1024),
                12,
                100,
                88,
                liveThreadCount + 4,
                64,
                hikariTotalConnections > 0 ? hikariTotalConnections : 10,
                System.getProperty("os.name")
        );
    }
}
