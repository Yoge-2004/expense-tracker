package com.example.expensetracker.domain.ai.dto;

import java.util.List;


/**
 * Cursor-paginated page of ML feedback training records.
 *
 * @param records    training records in the current page
 * @param nextCursor opaque cursor for fetching the next page, or null when exhausted
 */
public record MlFeedbackPageResponse(
        List<MlFeedbackTrainingRecord> records,
        String nextCursor
) {}
