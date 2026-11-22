package com.example.expensetracker.domain.admin.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration for the local retraining process and its Hugging Face destinations. */
@ConfigurationProperties(prefix = "ml.retraining")
public record MlRetrainingProperties(
        Integer feedbackThreshold,
        Long timeoutSeconds,
        Long terminationGraceSeconds,
        Boolean noTransformer,
        String hfToken,
        String modelRepo,
        String spaceRepo,
        String spaceUrl,
        String outputDirectory
) {
    private static final String DEFAULT_MODEL_REPO = "Yoge-2004/expense-intelligence-model";
    private static final String DEFAULT_SPACE_REPO = "Yoge-2004/expense-tracker-backend";
    private static final String DEFAULT_SPACE_URL = "https://yoge-2004-expense-tracker-backend.hf.space";

    public MlRetrainingProperties {
        if (feedbackThreshold == null || feedbackThreshold < 1) feedbackThreshold = 500;
        if (timeoutSeconds == null || timeoutSeconds < 1) timeoutSeconds = 1_800L;
        if (terminationGraceSeconds == null || terminationGraceSeconds < 0) terminationGraceSeconds = 2L;
        if (noTransformer == null) noTransformer = true;
        if (hfToken == null) hfToken = "";
        if (modelRepo == null || modelRepo.isBlank()) modelRepo = DEFAULT_MODEL_REPO;
        if (spaceRepo == null || spaceRepo.isBlank()) spaceRepo = DEFAULT_SPACE_REPO;
        if (spaceUrl == null || spaceUrl.isBlank()) spaceUrl = DEFAULT_SPACE_URL;
        if (outputDirectory == null || outputDirectory.isBlank()) outputDirectory = "../artifacts/automation-runs";
    }
}
