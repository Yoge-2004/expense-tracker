package com.example.expensetracker.domain.admin.service;

import com.example.expensetracker.domain.admin.config.MlRetrainingProperties;
import com.example.expensetracker.domain.ai.dto.MlLogEntryDto;
import com.example.expensetracker.domain.ai.service.MlInferenceClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Concrete implementation of {@link MlArtifactStore} managing disk-based JSON manifests,
 * run histories, and execution log files.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MlArtifactStoreImpl implements MlArtifactStore {

    private final ObjectMapper objectMapper;
    private final MlRetrainingProcessRunner processRunner;
    private final MlRetrainingProperties retrainingProperties;
    private final Clock clock;

    @Override
    public double readRealModelAccuracy() {
        for (File manifestFile : listRunManifests()) {
            try {
                boolean automationRun = manifestFile.toPath().startsWith(automationOutputDirectory());
                File metricsFile = automationRun
                        ? new File(manifestFile.getParentFile(), "candidate/metrics.json")
                        : manifestFile;
                if (automationRun && !hasPromotionRecord(manifestFile)) {
                    continue;
                }
                JsonNode metrics = objectMapper.readTree(metricsFile);
                JsonNode selected = automationRun ? metrics : metrics.path("selected_model");
                double accuracy = selected.path("test_accuracy").asDouble(Double.NaN);
                if (Double.isFinite(accuracy) && accuracy >= 0.0 && accuracy <= 1.0) {
                    return accuracy;
                }
            } catch (Exception e) {
                log.warn("Could not read model metrics from {}: {}", manifestFile, e.getMessage());
            }
        }
        return 0.0;
    }

    private boolean hasPromotionRecord(File manifestFile) {
        File promotionSummary = new File(manifestFile.getParentFile(), "candidate/promotion-summary.json");
        if (!promotionSummary.isFile()) return false;
        try {
            return "promoted".equalsIgnoreCase(objectMapper.readTree(promotionSummary).path("status").asText());
        } catch (Exception e) {
            log.warn("Could not read promotion summary {}: {}", promotionSummary, e.getMessage());
            return false;
        }
    }

    @Override
    public void saveExecutionLogs(String logs) {
        try {
            File dir = automationOutputDirectory().toFile();
            if (!dir.exists() && !dir.mkdirs()) {
                log.warn("Automation execution directory could not be created: {}", dir);
            }
            File logFile = new File(dir, "retrain-execution.log");
            Files.writeString(logFile.toPath(), logs, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (Exception e) {
            log.warn("Failed to write retrain-execution.log: {}", e.getMessage());
        }
    }

    @Override
    public synchronized void recordRunHistory(Map<String, Object> runRecord) {
        try {
            File dir = automationOutputDirectory().toFile();
            if (!dir.exists() && !dir.mkdirs()) {
                log.warn("Run history storage directory could not be created: {}", dir);
            }
            File file = new File(dir, "runs-history.json");
            List<Map<String, Object>> runs = new ArrayList<>();
            if (file.exists()) {
                try {
                    runs = objectMapper.readValue(file, new TypeReference<List<Map<String, Object>>>() {});
                } catch (Exception _) {
                    runs = new ArrayList<>();
                }
            }
            if (runs == null) runs = new ArrayList<>();
            runs.add(0, runRecord);
            if (runs.size() > 50) {
                runs = runs.subList(0, 50);
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file, runs);
        } catch (Exception e) {
            log.error("Failed to persist run history: {}", e.getMessage());
        }
    }

    @Override
    public List<Map<String, Object>> loadRunsHistory() {
        List<Map<String, Object>> allRuns = new ArrayList<>();

        File historyFile = automationOutputDirectory().resolve("runs-history.json").toFile();
        if (historyFile.exists()) {
            try {
                List<Map<String, Object>> diskRuns = objectMapper.readValue(historyFile, new TypeReference<List<Map<String, Object>>>() {});
                if (diskRuns != null) {
                    allRuns.addAll(diskRuns);
                }
            } catch (Exception e) {
                log.warn("Failed to parse runs-history.json: {}", e.getMessage());
            }
        }

        for (File manifest : listRunManifests()) {
            try {
                JsonNode root = objectMapper.readTree(manifest);
                JsonNode selected = root.path("selected_model");
                String runId = root.path("run_id").asText(manifest.getParentFile().getName());
                long rows = root.path("models").path("category_tfidf").path("final_training_rows").asLong(0);
                double accuracy = selected.path("test_accuracy").asDouble(Double.NaN);
                double macroF1 = selected.path("test_macro_f1").asDouble(Double.NaN);

                Map<String, Object> run = new LinkedHashMap<>();
                run.put("runId", "manifest_" + runId);
                run.put("timestamp", root.path("created_at_utc").asText(
                        Instant.ofEpochMilli(manifest.lastModified()).toString()));
                run.put("trigger", "MODEL_MANIFEST");
                run.put("status", manifestStatus(manifest, root));
                run.put("feedbackConsumed", root.path("feedback_consumed").asLong(0));

                Map<String, Object> metrics = new LinkedHashMap<>();
                if (Double.isFinite(macroF1)) metrics.put("macroF1", macroF1);
                if (Double.isFinite(accuracy)) metrics.put("accuracy", accuracy);
                if (rows > 0) metrics.put("samples", rows);
                if (!metrics.isEmpty()) run.put("metrics", metrics);

                String modelName = selected.path("name").asText("unknown");
                run.put("message", "Model manifest for " + modelName + " (" + runId + ").");
                allRuns.add(run);
            } catch (Exception e) {
                log.warn("Failed to parse model manifest {}: {}", manifest.getAbsolutePath(), e.getMessage());
            }
        }

        allRuns.sort(Comparator.comparing(
                run -> String.valueOf(run.getOrDefault("timestamp", "")),
                Comparator.reverseOrder()));
        if (allRuns.size() > 50) {
            return allRuns.subList(0, 50);
        }
        return allRuns;
    }

    private String manifestStatus(File manifest, JsonNode root) {
        boolean automationRun = manifest.toPath().startsWith(automationOutputDirectory());
        if (!automationRun) {
            return root.path("status").asText("UNKNOWN").toUpperCase(Locale.ROOT);
        }

        File promotionSummary = new File(manifest.getParentFile(), "candidate/promotion-summary.json");
        if (promotionSummary.isFile()) {
            try {
                return objectMapper.readTree(promotionSummary).path("status").asText("PROMOTION_UNKNOWN")
                        .toUpperCase(Locale.ROOT);
            } catch (Exception e) {
                log.warn("Could not read promotion summary {}: {}", promotionSummary, e.getMessage());
            }
        }

        File promotionDecision = new File(manifest.getParentFile(), "candidate/promotion.json");
        if (promotionDecision.isFile()) {
            try {
                return objectMapper.readTree(promotionDecision).path("promote").asBoolean()
                        ? "PUBLISHING" : "REJECTED_VALIDATION";
            } catch (Exception e) {
                log.warn("Could not read promotion decision {}: {}", promotionDecision, e.getMessage());
            }
        }
        return "TRAINING_COMPLETED";
    }

    private List<File> listRunManifests() {
        List<File> manifests = new ArrayList<>();
        for (Path rootPath : List.of(automationOutputDirectory(), Path.of("ml/artifacts/master-runs"))) {
            File root = rootPath.toFile();
            if (!root.isDirectory()) continue;

            File[] runDirectories = root.listFiles(File::isDirectory);
            if (runDirectories == null) continue;
            Arrays.sort(runDirectories, Comparator.comparingLong(File::lastModified).reversed());
            for (int i = 0; i < Math.min(runDirectories.length, 50); i++) {
                File runDirectory = runDirectories[i];
                File manifest = new File(runDirectory, "manifest.json");
                if (manifest.isFile()) manifests.add(manifest);
            }
        }
        manifests.sort(Comparator.comparingLong(File::lastModified).reversed());
        return manifests;
    }

    private Path automationOutputDirectory() {
        Path configured = Path.of(retrainingProperties.outputDirectory());
        return configured.isAbsolute() ? configured.normalize() : Path.of("ml").resolve(configured).normalize();
    }

    @Override
    public String loadTerminalLogs(MlInferenceClient inferenceClient) {
        File logFile = automationOutputDirectory().resolve("retrain-execution.log").toFile();
        if (logFile.exists() && logFile.length() > 0) {
            try {
                String content = Files.readString(logFile.toPath(), StandardCharsets.UTF_8);
                return processRunner.collapseTqdmProgress(content);
            } catch (Exception e) {
                log.warn("Failed to read retrain-execution.log: {}", e.getMessage());
            }
        }

        File summaryFile = automationOutputDirectory().resolve("latest-summary.json").toFile();
        if (summaryFile.exists()) {
            try {
                JsonNode summary = objectMapper.readTree(summaryFile);
                return String.format(
                        "[%s] [INFO] [expense_ml.jobs.retrain] Latest automation summary loaded from disk.\n" +
                        "[%s] [INFO] [expense_ml.jobs.retrain] Status: %s (reason: %s)\n" +
                        "[%s] [INFO] [expense_ml.jobs.retrain] Feedback evaluated: %d / threshold %d\n" +
                        "[%s] [INFO] [expense_ml.jobs.retrain] Active production revision: hf://Yoge-2004/expense-intelligence-model@production",
                        Instant.ofEpochMilli(summaryFile.lastModified()),
                        Instant.ofEpochMilli(summaryFile.lastModified()), summary.path("status").asText(), summary.path("reason").asText(),
                        Instant.ofEpochMilli(summaryFile.lastModified()), summary.path("feedback_count").asLong(), summary.path("threshold").asLong(),
                        Instant.ofEpochMilli(summaryFile.lastModified())
                );
            } catch (Exception ex) {
                log.debug("Notice reading summary file {}: {}", ex.getClass().getSimpleName(), ex.getMessage());
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("[%s] [INFO] [expense_ml.engine] Retraining automation engine initialized.\n", Instant.now(clock)));
        sb.append(String.format("[%s] [INFO] [expense_ml.engine] Scheduled runner: Hugging Face uv-job (expense-tracker-ml-retrain) @ 0 2 * * *\n", Instant.now(clock)));
        sb.append(String.format("[%s] [INFO] [expense_ml.engine] Trigger gate: >= %d feedback corrections\n",
                Instant.now(clock), retrainingProperties.feedbackThreshold()));

        if (inferenceClient != null) {
            List<MlLogEntryDto> mlLogs = inferenceClient.getLogs(30, "INFO", null);
            if (mlLogs != null && !mlLogs.isEmpty()) {
                sb.append(String.format("[%s] [INFO] [expense_ml.engine] Live Python ML engine events:\n", Instant.now(clock)));
                for (MlLogEntryDto entry : mlLogs) {
                    sb.append(String.format("[%s] [%s] [%s] %s\n", entry.timestamp(), entry.level(), entry.logger(), entry.message()));
                }
            } else {
                sb.append(String.format("[%s] [INFO] [expense_ml.engine] Waiting for trigger or scheduled run.\n", Instant.now(clock)));
            }
        }
        return sb.toString();
    }
}
