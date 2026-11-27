package com.example.expensetracker.domain.ai.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;


/**
 * Request payload submitting a user correction for a predicted expense category.
 *
 * @param transactionId     client or domain transaction reference ID
 * @param text              classified description or merchant text
 * @param predictedCategory category originally predicted by the model
 * @param correctedCategory category chosen by the user
 * @param confidence        prediction confidence in {@code [0.0, 1.0]}
 * @param modelVersion      version identifier of the model that produced the prediction
 */
public record MlFeedbackRequest(
        @NotBlank @Size(max = 128) String transactionId,
        @NotBlank @Size(max = 4000) String text,
        @NotBlank @Size(max = 64) String predictedCategory,
        @NotBlank @Size(max = 64) String correctedCategory,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double confidence,
        @NotBlank @Size(max = 128) String modelVersion
) {}
