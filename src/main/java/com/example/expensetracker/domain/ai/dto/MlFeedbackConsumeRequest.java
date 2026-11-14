package com.example.expensetracker.domain.ai.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;



public record MlFeedbackConsumeRequest(@NotEmpty List<String> feedbackIds) {}
