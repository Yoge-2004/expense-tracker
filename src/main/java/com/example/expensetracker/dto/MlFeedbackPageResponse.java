package com.example.expensetracker.dto;

import java.util.List;

public record MlFeedbackPageResponse(
        List<MlFeedbackTrainingRecord> records,
        String nextCursor
) {}
