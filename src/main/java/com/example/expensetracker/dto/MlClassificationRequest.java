package com.example.expensetracker.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MlClassificationRequest(
        @NotBlank @Size(max = 4000) String description,
        @Size(max = 10) Integer topN
) {
    public int effectiveTopN() {
        return topN == null ? 3 : Math.min(Math.max(topN, 1), 10);
    }
}
