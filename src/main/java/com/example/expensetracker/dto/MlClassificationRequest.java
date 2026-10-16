package com.example.expensetracker.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MlClassificationRequest(
        @NotBlank @Size(max = 4000) String description,
        @JsonProperty("topN") @JsonAlias({"top_n", "topN"}) @Min(1) @Max(10) Integer topN
) {
    public int effectiveTopN() {
        return topN == null ? 3 : topN;
    }
}
