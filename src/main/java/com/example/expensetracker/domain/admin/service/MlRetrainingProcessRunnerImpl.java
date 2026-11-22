package com.example.expensetracker.domain.admin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/** Runs the ML retraining script and translates its final JSON result. */
@Slf4j
@Service
@RequiredArgsConstructor
public class MlRetrainingProcessRunnerImpl implements MlRetrainingProcessRunner {

    private static final int MAX_LOG_CHARS = 500_000;
    private static final int MAX_RESULT_CHARS = 1_000_000;
    private static final String TRUNCATED_LOG_MARKER = "[Earlier process output truncated]\n";

    private final ObjectMapper objectMapper;
    private final MlRetrainingProperties properties;
    private final Clock clock;

    @Override
    public RetrainingProcessResult executeRetraining(
            File pythonExe,
            File retrainScript,
            int serverPort,
            String trainingToken,
            long initialFeedbackCount,
            StringBuilder executionLogs
    ) {
        StringBuilder processOutput = new StringBuilder();
        Process process = null;
        Thread outputReader = null;
        boolean timedOut = false;
        long timeoutSeconds = properties.timeoutSeconds();
        long terminationGraceSeconds = properties.terminationGraceSeconds();

        try {
            if (trainingToken == null || trainingToken.isBlank()) {
                return configurationFailure(executionLogs, "ML_FEEDBACK_TOKEN is not configured.");
            }
            String pythonCommand = pythonExe.getParentFile() == null
                    ? pythonExe.getPath()
                    : pythonExe.getAbsolutePath();
            ProcessBuilder processBuilder = new ProcessBuilder(
                    pythonCommand,
                    retrainScript.getAbsolutePath()
            );
            File mlDirectory = new File(projectRoot(retrainScript), "ml").getAbsoluteFile();
            processBuilder.directory(mlDirectory);
            Map<String, String> environment = processBuilder.environment();
            String hfToken = environment.get("HF_TOKEN");
            if (hfToken == null || hfToken.isBlank()) {
                if (properties.hfToken().isBlank()) {
                    return configurationFailure(executionLogs, "HF_TOKEN is not configured.");
                }
                environment.put("HF_TOKEN", properties.hfToken());
            }
            environment.put("EXPENSE_ML_FEEDBACK_URL", "http://127.0.0.1:" + serverPort);
            environment.put("EXPENSE_ML_FEEDBACK_TOKEN", trainingToken);
            environment.put("EXPENSE_ML_FEEDBACK_THRESHOLD", String.valueOf(properties.feedbackThreshold()));
            environment.put("EXPENSE_ML_SCHEDULED", "1");
            environment.put("EXPENSE_ML_NO_TRANSFORMER", properties.noTransformer() ? "1" : "0");
            environment.put("HF_MODEL_REPO", properties.modelRepo());
            environment.put("HF_SPACE_REPO", properties.spaceRepo());
            environment.put("HF_SPACE_URL", properties.spaceUrl());
            putIfBlank(environment, "EXPENSE_ML_CONFIG", mlDirectory.toPath().resolve("config/datasets.yaml").toString());
            putIfBlank(environment, "EXPENSE_ML_PREPARED",
                    mlDirectory.toPath().resolve("data/prepared/transactions.parquet").toString());
            Path outputDirectory = Path.of(properties.outputDirectory());
            if (!outputDirectory.isAbsolute()) outputDirectory = mlDirectory.toPath().resolve(outputDirectory);
            environment.put("EXPENSE_ML_OUTPUT", outputDirectory.normalize().toString());
            processBuilder.redirectErrorStream(true);

            process = processBuilder.start();
            process.getOutputStream().close();
            Process runningProcess = process;
            outputReader = Thread.ofVirtual().name("ml-retraining-output").start(
                    () -> drainOutput(runningProcess, processOutput, executionLogs));

            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                timedOut = true;
                process.destroy();
                if (!process.waitFor(terminationGraceSeconds, TimeUnit.SECONDS)) {
                    process.destroyForcibly();
                    process.waitFor(terminationGraceSeconds, TimeUnit.SECONDS);
                }
            }

            if (outputReader != null) {
                outputReader.join(terminationGraceSeconds * 1_000);
                if (outputReader.isAlive()) {
                    process.getInputStream().close();
                    outputReader.join(1_000);
                }
            }

            if (timedOut) {
                appendLog(executionLogs, "[" + Instant.now(clock) + "] [ERROR] Retraining process timed out after "
                        + timeoutSeconds + "s.\n");
                return new RetrainingProcessResult(false, "TIMED_OUT",
                        "Retraining evaluation timed out after " + timeoutSeconds + " seconds",
                        initialFeedbackCount);
            }

            String capturedOutput;
            synchronized (processOutput) {
                capturedOutput = processOutput.toString();
            }
            return resultForExitCode(process.exitValue(), capturedOutput, initialFeedbackCount);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            appendLog(executionLogs, "[" + Instant.now(clock) + "] [ERROR] Retraining process was interrupted.\n");
            return new RetrainingProcessResult(false, "INTERRUPTED", "Retraining process was interrupted", initialFeedbackCount);
        } catch (Exception e) {
            log.error("Failed to execute ML retraining process: {}", e.getMessage(), e);
            appendLog(executionLogs, "[" + Instant.now(clock) + "] [ERROR] Process execution exception: "
                    + e.getMessage() + "\n");
            return new RetrainingProcessResult(false, "FAILED", "Execution failed: " + e.getMessage(), initialFeedbackCount);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
            if (outputReader != null && outputReader.isAlive()) {
                outputReader.interrupt();
            }
        }
    }

    private void drainOutput(Process process, StringBuilder processOutput, StringBuilder executionLogs) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                synchronized (processOutput) {
                    appendTail(processOutput, line + "\n", MAX_RESULT_CHARS, null);
                }
                appendProcessLine(executionLogs, line);
            }
        } catch (IOException e) {
            if (process.isAlive()) {
                log.warn("Could not continue reading ML retraining output: {}", e.getMessage());
            }
        }
    }

    private RetrainingProcessResult resultForExitCode(
            int exitCode,
            String processOutput,
            long fallbackFeedbackCount
    ) {
        if (exitCode != 0) {
            String status = "FAILED_EXIT_" + exitCode;
            return new RetrainingProcessResult(false, status,
                    "Retraining process failed with exit code " + exitCode, fallbackFeedbackCount);
        }

        JsonNode summary = readFinalSummary(processOutput);
        if (summary == null) {
            return new RetrainingProcessResult(true, "EVALUATED",
                    "Retraining process exited normally, but did not print a result summary.", fallbackFeedbackCount);
        }

        String summaryStatus = summary.path("status").asText("").toLowerCase(Locale.ROOT);
        long feedbackCount = summary.path("feedback_consumed")
                .asLong(summary.path("feedback_count").asLong(fallbackFeedbackCount));
        return switch (summaryStatus) {
            case "skipped" -> new RetrainingProcessResult(true, "SKIPPED_INSUFFICIENT_FEEDBACK",
                    "Evaluated feedback threshold: " + feedbackCount + " / "
                            + summary.path("threshold").asLong(500)
                            + " approved corrections. Insufficient new samples; production baseline maintained.",
                    feedbackCount);
            case "promoted" -> new RetrainingProcessResult(true, "COMPLETED_PROMOTED",
                    "Retraining completed successfully and candidate models passed validation gates.", feedbackCount);
            case "rejected" -> new RetrainingProcessResult(true, "REJECTED_VALIDATION",
                    "Retraining completed, but the candidate did not pass the production validation gates.", feedbackCount);
            default -> new RetrainingProcessResult(true, summaryStatus.isBlank() ? "EVALUATED" : summaryStatus.toUpperCase(),
                    "Retraining evaluation completed with status: " + (summaryStatus.isBlank() ? "unknown" : summaryStatus),
                    feedbackCount);
        };
    }

    private JsonNode readFinalSummary(String output) {
        int lineStart = output.length();
        while (lineStart > 0) {
            int previousNewline = output.lastIndexOf('\n', lineStart - 1);
            int candidateStart = previousNewline + 1;
            if (candidateStart < output.length() && output.charAt(candidateStart) == '{') {
                try {
                    JsonNode candidate = objectMapper.readTree(output.substring(candidateStart));
                    if (candidate != null && candidate.isObject() && candidate.has("status")) {
                        return candidate;
                    }
                } catch (IOException _) {
                    // Continue to an earlier top-level JSON block, if present.
                }
            }
            if (previousNewline < 0) {
                break;
            }
            lineStart = previousNewline;
        }
        return null;
    }

    @Override
    public File resolvePythonExecutable() {
        File[] candidates = {
                new File("ml/.venv/bin/python"),
                new File("../ml/.venv/bin/python"),
                new File(System.getProperty("user.dir", "."), "ml/.venv/bin/python")
        };
        for (File candidate : candidates) {
            if (candidate.exists() && candidate.canExecute()) {
                return candidate;
            }
        }
        return new File("python3");
    }

    @Override
    public File resolveRetrainScript() {
        File[] candidates = {
                new File("ml/jobs/retrain.py"),
                new File("../ml/jobs/retrain.py"),
                new File(System.getProperty("user.dir", "."), "ml/jobs/retrain.py")
        };
        for (File candidate : candidates) {
            if (candidate.exists()) {
                return candidate;
            }
        }
        return null;
    }

    private File projectRoot(File retrainScript) {
        File jobsDirectory = retrainScript.getAbsoluteFile().getParentFile();
        File mlDirectory = jobsDirectory != null ? jobsDirectory.getParentFile() : null;
        File rootDirectory = mlDirectory != null ? mlDirectory.getParentFile() : null;
        return rootDirectory != null ? rootDirectory : new File(".").getAbsoluteFile();
    }

    private static void putIfBlank(Map<String, String> environment, String key, String value) {
        String configured = environment.get(key);
        if (configured == null || configured.isBlank()) {
            environment.put(key, value);
        }
    }

    private RetrainingProcessResult configurationFailure(StringBuilder logs, String message) {
        appendLog(logs, "[" + Instant.now(clock) + "] [ERROR] " + message + "\n");
        return new RetrainingProcessResult(false, "FAILED_CONFIGURATION", message, 0);
    }

    @Override
    public String collapseTqdmProgress(String logText) {
        return collapseTqdm(logText);
    }

    public static String collapseTqdm(String logText) {
        if (logText == null || logText.isBlank()) return "";
        String[] lines = logText.split("\\r?\\n");
        List<String> result = new ArrayList<>();
        boolean inProgress = false;

        for (String line : lines) {
            boolean isTqdm = isTqdmLine(line);
            if (isTqdm) {
                if (inProgress && !result.isEmpty()) {
                    result.set(result.size() - 1, line);
                } else {
                    result.add(line);
                    inProgress = true;
                }
            } else {
                inProgress = false;
                result.add(line);
            }
        }
        return String.join("\n", result);
    }

    public static boolean isTqdmLine(String line) {
        if (line == null) return false;
        return line.contains("%|") || (line.contains("it/s") && line.contains("[")) || (line.contains("s/it") && line.contains("["));
    }

    private void appendProcessLine(StringBuilder logs, String line) {
        synchronized (logs) {
            String clean = line.replace("\r", "").stripTrailing();
            if (clean.isBlank()) return;

            boolean isTqdm = isTqdmLine(clean);
            if (isTqdm && !logs.isEmpty()) {
                int lastNewline = logs.lastIndexOf("\n", logs.length() - 2);
                String lastLine = lastNewline >= 0 ? logs.substring(lastNewline + 1) : logs.toString();
                if (isTqdmLine(lastLine)) {
                    int startReplace = lastNewline >= 0 ? lastNewline + 1 : 0;
                    logs.replace(startReplace, logs.length(), "[" + Instant.now(clock) + "] " + clean + "\n");
                    trimLog(logs);
                    return;
                }
            }
            appendTail(logs, "[" + Instant.now(clock) + "] " + clean + "\n", MAX_LOG_CHARS, TRUNCATED_LOG_MARKER);
        }
    }

    private static void appendLog(StringBuilder logs, String line) {
        synchronized (logs) {
            appendTail(logs, line, MAX_LOG_CHARS, TRUNCATED_LOG_MARKER);
        }
    }

    private static void trimLog(StringBuilder logs) {
        if (logs.length() > MAX_LOG_CHARS) {
            appendTail(logs, "", MAX_LOG_CHARS, TRUNCATED_LOG_MARKER);
        }
    }

    private static void appendTail(StringBuilder target, String value, int maxChars, String marker) {
        target.append(value);
        if (target.length() <= maxChars) return;

        int removeThrough = target.length() - maxChars + (marker == null ? 0 : marker.length());
        int nextLine = target.indexOf("\n", Math.max(0, removeThrough));
        target.delete(0, nextLine >= 0 ? nextLine + 1 : removeThrough);
        if (marker != null && target.indexOf(marker) != 0) {
            target.insert(0, marker);
        }
    }
}
