package com.example.expensetracker.domain.ai.dto;

import java.util.List;


public record MlFeedbackPageResponse(
        List<MlFeedbackTrainingRecord> records,
        String nextCursor
) {}
