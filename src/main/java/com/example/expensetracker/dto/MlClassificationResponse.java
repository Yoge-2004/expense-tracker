package com.example.expensetracker.dto;

import java.util.List;
import java.util.Map;

public record MlClassificationResponse(
        String category,
        double confidence,
        List<Map<String, Object>> topK,
        String modelRevision,
        String modelType
) {}
