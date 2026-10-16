package com.example.expensetracker.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public record MlClassificationResponse(
        String category,
        double confidence,
        @JsonProperty("topK") @JsonAlias({"top_k", "topK"}) List<Map<String, Object>> topK,
        @JsonProperty("modelRevision") @JsonAlias({"model_revision", "modelRevision"}) String modelRevision,
        @JsonProperty("modelType") @JsonAlias({"model_type", "modelType"}) String modelType
) {}
