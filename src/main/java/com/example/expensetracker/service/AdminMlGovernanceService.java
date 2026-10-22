package com.example.expensetracker.service;

import com.example.expensetracker.dto.AdminMlFeedbackItemDto;
import com.example.expensetracker.dto.AdminMlStatsDto;
import com.example.expensetracker.dto.MlClassificationRequest;
import com.example.expensetracker.dto.MlClassificationResponse;
import com.example.expensetracker.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Service for administrative governance of the ML expense categorization model,
 * reviewing user correction queues, and running live inference sandbox tests.
 *
 * @author Yogeshwaran
 */
public interface AdminMlGovernanceService {

    AdminMlStatsDto getModelStats();

    Page<AdminMlFeedbackItemDto> getFeedbackQueue(Pageable pageable);

    void reviewFeedback(Long feedbackId, String decision, User actor, String ipAddress, String userAgent);

    MlClassificationResponse testPrediction(MlClassificationRequest request);
}
