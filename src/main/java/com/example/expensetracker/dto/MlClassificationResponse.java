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
) {
    @JsonProperty("top_k")
    public List<Map<String, Object>> top_k() {
        return topK;
    }

    @JsonProperty("model_revision")
    public String model_revision() {
        return modelRevision;
    }

    @JsonProperty("model_type")
    public String model_type() {
        return modelType;
    }
}
