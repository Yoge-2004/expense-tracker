package com.example.expensetracker.domain.ai.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;



/**
 * Response payload returned by ML expense-category classification.
 *
 * @param category      predicted top category
 * @param confidence    confidence score for the top prediction
 * @param topK          ranked candidate category predictions with scores
 * @param modelRevision active ML model revision identifier
 * @param modelType     active ML model architecture/type name
 */
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
