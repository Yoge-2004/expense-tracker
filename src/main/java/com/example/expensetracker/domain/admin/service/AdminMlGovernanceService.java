package com.example.expensetracker.domain.admin.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.Map;

import com.example.expensetracker.domain.admin.dto.AdminMlFeedbackItemDto;
import com.example.expensetracker.domain.admin.dto.AdminMlStatsDto;
import com.example.expensetracker.domain.ai.dto.MlClassificationRequest;
import com.example.expensetracker.domain.ai.dto.MlClassificationResponse;
import com.example.expensetracker.domain.user.model.User;



/**
 * Service for administrative governance of the ML models,
 * reviewing user correction queues, running inference sandbox tests,
 * and tracking automated model retraining execution logs.
 *
 * @author Yogeshwaran
 */
public interface AdminMlGovernanceService {

    AdminMlStatsDto getModelStats();

    Page<AdminMlFeedbackItemDto> getFeedbackQueue(Pageable pageable);

    void reviewFeedback(Long feedbackId, String decision, User actor, String ipAddress, String userAgent);

    MlClassificationResponse testPrediction(MlClassificationRequest request);

    Map<String, Object> getRetrainingLogs();

    Map<String, Object> triggerRetraining(String stepUpPin, User actor, String ipAddress, String userAgent);
}
