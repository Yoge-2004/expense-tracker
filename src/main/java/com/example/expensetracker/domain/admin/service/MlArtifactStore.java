package com.example.expensetracker.domain.admin.service;

import java.util.List;
import java.util.Map;
import com.example.expensetracker.domain.ai.service.MlInferenceClient;

/**
 * Repository and store abstraction for reading and persisting machine learning
 * training manifests, automation run history, and evaluation logs.
 *
 * <p>Separates file system I/O and JSON serialization from the governance
 * orchestration service, satisfying the Single Responsibility Principle (SRP)
 * and Dependency Inversion Principle (DIP).</p>
 *
 * @author Yogeshwaran
 */
public interface MlArtifactStore {

    /**
     * Reads the real model accuracy score from the master training manifest on disk.
     *
     * @return model test accuracy in range [0.0, 1.0], or baseline fallback 0.993
     */
    double readRealModelAccuracy();

    /**
     * Persists terminal execution logs to {@code artifacts/automation-runs/retrain-execution.log}.
     *
     * @param logs the text log output to write
     */
    void saveExecutionLogs(String logs);

    /**
     * Records a new execution run in {@code artifacts/automation-runs/runs-history.json},
     * maintaining a sliding window of the most recent 50 runs.
     *
     * @param runRecord map containing run metadata and status
     */
    void recordRunHistory(Map<String, Object> runRecord);

    /**
     * Loads the historical list of retraining runs from persistent disk manifests.
     *
     * @return list of run record maps ordered chronologically (newest first)
     */
    List<Map<String, Object>> loadRunsHistory();

    /**
     * Loads recent terminal logs from disk summaries or live Python ML engine events.
     *
     * @param inferenceClient client to probe live engine logs if no disk logs exist
     * @return formatted log text
     */
    String loadTerminalLogs(MlInferenceClient inferenceClient);
}
