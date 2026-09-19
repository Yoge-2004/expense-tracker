package com.example.expensetracker.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record MlFeedbackConsumeRequest(@NotEmpty List<String> feedbackIds) {}
