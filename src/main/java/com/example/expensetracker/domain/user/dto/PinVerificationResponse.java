package com.example.expensetracker.domain.user.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;


/**
 * Strongly-typed payload reporting result of Security PIN verification attempt.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Security PIN verification status")
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PinVerificationResponse(
        @Schema(description = "Whether the submitted PIN was valid", example = "true")
        boolean valid,

        @Schema(description = "Feedback message when verification fails", example = "Incorrect Security PIN")
        String message
) {}
