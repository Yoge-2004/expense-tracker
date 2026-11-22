package com.example.expensetracker.domain.admin.service;

import java.io.File;

/**
 * Strategy interface abstracting the external execution of the machine learning
 * retraining pipeline.
 *
 * <p>Adheres to the Single Responsibility Principle (SRP) and Dependency Inversion
 * Principle (DIP) by isolating low-level OS process management, process I/O streaming,
 * and command line path resolution from administrative governance orchestration.</p>
 *
 * @author Yogeshwaran
 */
public interface MlRetrainingProcessRunner {

    /**
     * Immutable outcome carrier for a retraining process execution run.
     *
     * @param success       true if the process exited cleanly with code 0 and validated
     * @param status        symbolic status tag (e.g. COMPLETED_PROMOTED, SKIPPED_INSUFFICIENT_FEEDBACK, FAILED)
     * @param runMessage    descriptive summary message of the run
     * @param feedbackCount number of approved feedback samples evaluated/consumed
     */
    record RetrainingProcessResult(
            boolean success,
            String status,
            String runMessage,
            long feedbackCount
    ) {}

    /**
     * Executes the ML retraining script via a managed subprocess.
     *
     * @param pythonExe            resolved Python interpreter executable
     * @param retrainScript        resolved retraining script
     * @param serverPort           HTTP port of the running application for feedback callbacks
     * @param trainingToken        authentication token for internal feedback endpoint access
     * @param initialFeedbackCount baseline count of approved feedback items
     * @param executionLogs        accumulator for real-time terminal output logs
     * @return outcome of the retraining run
     */
    RetrainingProcessResult executeRetraining(
            File pythonExe,
            File retrainScript,
            int serverPort,
            String trainingToken,
            long initialFeedbackCount,
            StringBuilder executionLogs
    );

    /**
     * Resolves the Python executable candidate across standard virtualenv locations.
     *
     * @return a valid Python {@link File} executable, or fallback to "python3"
     */
    File resolvePythonExecutable();

    /**
     * Resolves the retraining script file candidate.
     *
     * @return a valid {@link File} referencing {@code ml/jobs/retrain.py}, or {@code null} if not found
     */
    File resolveRetrainScript();

    /**
     * Normalizes terminal output by collapsing consecutive tqdm progress updates.
     *
     * @param logText raw execution logs
     * @return cleaned, deduplicated progress text
     */
    String collapseTqdmProgress(String logText);
}
