package com.example.expensetracker.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MlFeedbackRequest(
        @NotBlank @Size(max = 128) String transactionId,
        @NotBlank @Size(max = 4000) String text,
        @NotBlank @Size(max = 64) String predictedCategory,
        @NotBlank @Size(max = 64) String correctedCategory,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double confidence,
        @NotBlank @Size(max = 128) String modelVersion
) {}
