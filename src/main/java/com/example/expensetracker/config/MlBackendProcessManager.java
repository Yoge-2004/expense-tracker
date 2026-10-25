package com.example.expensetracker.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Automatically launches the Python FastAPI Machine Learning inference backend
 * when the Spring Boot application starts under development profiles.
 *
 * Ensures local developers and test environments have transaction intelligence
 * and smart categorization active without needing to manually run external scripts.
 */
@Component
@ConditionalOnProperty(name = "ml.autostart.enabled", havingValue = "true")
public class MlBackendProcessManager implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(MlBackendProcessManager.class);

    @Value("${ml.inference.url:http://127.0.0.1:8000}")
    private String mlInferenceUrl;

    private Process mlProcess;
    private volatile boolean isRunning = false;

    @Override
    public void start() {
        if (isRunning) {
            return;
        }

        log.info("[MlBackendProcessManager] Checking health of ML inference service at {}...", mlInferenceUrl);
        if (isMlServiceHealthy()) {
            log.info("[MlBackendProcessManager] Python ML backend is already active and responsive at {}. Reusing existing service.", mlInferenceUrl);
            isRunning = true;
            return;
        }

        File mlDir = resolveMlDirectory();
        if (mlDir == null || !mlDir.exists()) {
            log.warn("[MlBackendProcessManager] ML directory could not be located. Auto-startup bypassed.");
            return;
        }

        try {
            List<String> command = buildCommand(mlDir);
            log.info("[MlBackendProcessManager] Launching Python ML backend: {} from directory {}", String.join(" ", command), mlDir.getAbsolutePath());

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(mlDir);
            pb.redirectErrorStream(true);

            mlProcess = pb.start();

            // Pipe output in background daemon thread
            Thread logDrainer = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(mlProcess.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        log.debug("[python-ml] {}", line);
                    }
                } catch (Exception ignored) {
                }
            }, "ml-log-drainer");
            logDrainer.setDaemon(true);
            logDrainer.start();

            // Wait up to 10 seconds for ML service to become healthy
            boolean healthy = waitForHealthCheck(10_000);
            if (healthy) {
                log.info("[MlBackendProcessManager] Python ML backend successfully started and verified healthy at {}", mlInferenceUrl);
                isRunning = true;
            } else {
                log.warn("[MlBackendProcessManager] Python ML backend process started (PID: {}) but health endpoint did not respond within timeout.", mlProcess.pid());
                isRunning = true;
            }
        } catch (Exception e) {
            log.error("[MlBackendProcessManager] Failed to start Python ML backend process: {}", e.getMessage(), e);
        }
    }

    @Override
    public void stop() {
        if (mlProcess != null && mlProcess.isAlive()) {
            log.info("[MlBackendProcessManager] Gracefully shutting down Python ML backend process (PID: {})...", mlProcess.pid());
            try {
                mlProcess.destroy();
                boolean terminated = mlProcess.waitFor(3, TimeUnit.SECONDS);
                if (!terminated) {
                    log.warn("[MlBackendProcessManager] Python ML backend did not terminate within 3s. Terminating forcibly.");
                    mlProcess.destroyForcibly();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                mlProcess.destroyForcibly();
            }
        }
        isRunning = false;
        log.info("[MlBackendProcessManager] Python ML backend shutdown complete.");
    }

    @Override
    public boolean isRunning() {
        return isRunning && (mlProcess == null || mlProcess.isAlive());
    }

    @Override
    public boolean isAutoStartup() {
        return true;
    }

    @Override
    public int getPhase() {
        return Integer.MIN_VALUE + 100; // Start early during context refresh
    }

    private boolean isMlServiceHealthy() {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofMillis(800))
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(mlInferenceUrl + "/health"))
                    .timeout(Duration.ofMillis(800))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() >= 200 && response.statusCode() < 400;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean waitForHealthCheck(long timeoutMillis) {
        long start = System.currentTimeMillis();
        while (System.currentTimeMillis() - start < timeoutMillis) {
            if (isMlServiceHealthy()) {
                return true;
            }
            if (mlProcess != null && !mlProcess.isAlive()) {
                log.error("[MlBackendProcessManager] Python ML backend process exited prematurely with code {}", mlProcess.exitValue());
                return false;
            }
            try {
                Thread.sleep(400);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return isMlServiceHealthy();
    }

    private File resolveMlDirectory() {
        File current = new File("ml");
        if (current.exists() && current.isDirectory()) {
            return current;
        }
        File parent = new File("../ml");
        if (parent.exists() && parent.isDirectory()) {
            return parent;
        }
        String userDir = System.getProperty("user.dir", ".");
        File sub = new File(userDir, "ml");
        if (sub.exists() && sub.isDirectory()) {
            return sub;
        }
        return null;
    }

    private List<String> buildCommand(File mlDir) {
        List<String> cmd = new ArrayList<>();
        File venvUvicorn = new File(mlDir, ".venv/bin/uvicorn");
        if (venvUvicorn.exists() && venvUvicorn.canExecute()) {
            cmd.add(venvUvicorn.getAbsolutePath());
            cmd.add("expense_ml.api.main:app");
            cmd.add("--host");
            cmd.add("127.0.0.1");
            cmd.add("--port");
            cmd.add("8000");
            return cmd;
        }

        String uvPath = findExecutableOnPath("uv");
        if (uvPath != null) {
            cmd.add(uvPath);
            cmd.add("run");
            cmd.add("uvicorn");
            cmd.add("expense_ml.api.main:app");
            cmd.add("--host");
            cmd.add("127.0.0.1");
            cmd.add("--port");
            cmd.add("8000");
            return cmd;
        }

        // Fallback to python3 / uvicorn directly
        cmd.add("python3");
        cmd.add("-m");
        cmd.add("uvicorn");
        cmd.add("expense_ml.api.main:app");
        cmd.add("--host");
        cmd.add("127.0.0.1");
        cmd.add("--port");
        cmd.add("8000");
        return cmd;
    }

    private String findExecutableOnPath(String name) {
        String pathEnv = System.getenv("PATH");
        if (pathEnv != null) {
            for (String dir : pathEnv.split(File.pathSeparator)) {
                File file = new File(dir, name);
                if (file.exists() && file.canExecute()) {
                    return file.getAbsolutePath();
                }
            }
        }
        String[] commonPaths = {"/opt/uv/bin/uv", "/usr/local/bin/uv", "/usr/bin/uv"};
        for (String p : commonPaths) {
            File f = new File(p);
            if (f.exists() && f.canExecute()) {
                return f.getAbsolutePath();
            }
        }
        return null;
    }
}
