package com.example.expensetracker.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MlClassificationRequest(
        @NotBlank @Size(max = 4000) String description,
        @Min(1) @Max(10) Integer topN
) {
    public int effectiveTopN() {
        return topN == null ? 3 : topN;
    }
}
