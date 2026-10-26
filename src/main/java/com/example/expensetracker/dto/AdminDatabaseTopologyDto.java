package com.example.expensetracker.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Diagnostic payload reporting the operational topology of the data plane:
 * local primary engine, Neon cloud database, and Hugging Face resilience backup.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Diagnostic state of platform database tiers (Server, Neon, Hugging Face)")
public record AdminDatabaseTopologyDto(
        @Schema(description = "Server engine state")
        @JsonProperty("server")
        @JsonAlias({"serverDatabase"})
        ServerDatabaseState server,

        @Schema(description = "Neon serverless cloud database state")
        @JsonProperty("neon")
        @JsonAlias({"neonCloudDatabase"})
        NeonDatabaseState neon,

        @Schema(description = "Hugging Face Space backup and failover snapshot state")
        @JsonProperty("huggingFace")
        @JsonAlias({"huggingFaceSpaces"})
        HuggingFaceSpaceState huggingFace
) {
    @JsonProperty("serverDatabase")
    public ServerDatabaseState serverDatabase() {
        return server;
    }

    @JsonProperty("neonCloudDatabase")
    public NeonDatabaseState neonCloudDatabase() {
        return neon;
    }

    @JsonProperty("huggingFaceSpaces")
    public HuggingFaceSpaceState huggingFaceSpaces() {
        return huggingFace;
    }

    public record ServerDatabaseState(
            String engine,
            String url,
            String routingMode,
            String healthStatus,
            long uptimeSeconds,
            long heapUsedMb,
            long heapMaxMb,
            int activeThreads,
            boolean virtualThreadsEnabled,
            long latencyMs,
            int activeConnections,
            int maxConnections,
            String databaseName
    ) {}

    public record NeonDatabaseState(
            String status,
            String host,
            int activeConnections,
            int idleConnections,
            int maxPoolSize,
            String sslMode,
            long latencyMs,
            String lastProbeStatus
    ) {}

    public record HuggingFaceSpaceState(
            String spaceName,
            String repoType,
            String status,
            String snapshotPath,
            String cipherAlgorithm,
            String lastAttemptAt,
            String lastSuccessAt,
            String lastUploadAt,
            String lastError,
            String tokenScopeDiagnosis,
            boolean isConfigured
    ) {}
}
