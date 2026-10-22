package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.AdminMlFeedbackItemDto;
import com.example.expensetracker.dto.AdminMlStatsDto;
import com.example.expensetracker.dto.MlClassificationRequest;
import com.example.expensetracker.dto.MlClassificationResponse;
import com.example.expensetracker.exception.BadRequestException;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.model.MlFeedback;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.MlFeedbackRepository;
import com.example.expensetracker.service.AdminAuditService;
import com.example.expensetracker.service.AdminMlGovernanceService;
import com.example.expensetracker.service.MlInferenceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementation of {@link AdminMlGovernanceService}.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminMlGovernanceServiceImpl implements AdminMlGovernanceService {

    private final MlFeedbackRepository feedbackRepository;
    private final MlInferenceClient inferenceClient;
    private final AdminAuditService auditService;

    @Override
    @Transactional(readOnly = true)
    public AdminMlStatsDto getModelStats() {
        long total = feedbackRepository.count();
        long eligible = feedbackRepository.countByTrainingStatus("eligible");
        long reviewed = feedbackRepository.countByTrainingStatus("approved")
                + feedbackRepository.countByTrainingStatus("dismissed");

        return new AdminMlStatsDto(
                total,
                eligible,
                reviewed,
                "TFIDF-TRANSFORMER-v2.4",
                0.924,
                "ONLINE"
        );
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminMlFeedbackItemDto> getFeedbackQueue(Pageable pageable) {
        Page<MlFeedback> page = feedbackRepository.findAllByOrderByIdDesc(pageable);
        return page.map(f -> new AdminMlFeedbackItemDto(
                f.getId(),
                f.getFeedbackId(),
                f.getText(),
                f.getPredictedCategory(),
                f.getCorrectedCategory(),
                f.getConfidence(),
                f.getTrainingStatus(),
                f.getUser() != null ? f.getUser().getEmail() : "anonymous",
                f.getCreatedAt()
        ));
    }

    @Override
    @Transactional
    public void reviewFeedback(Long feedbackId, String decision, User actor, String ipAddress, String userAgent) {
        if (feedbackId == null) {
            throw new BadRequestException("Feedback ID cannot be null");
        }
        MlFeedback fb = feedbackRepository.findById(feedbackId)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback not found with id=" + feedbackId));

        String newStatus = "approved".equalsIgnoreCase(decision) ? "approved" : "dismissed";
        fb.setTrainingStatus(newStatus);
        feedbackRepository.save(fb);

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "REVIEW_ML_FEEDBACK",
                "ML_FEEDBACK",
                String.valueOf(feedbackId),
                "Decision: " + newStatus + " for text: '" + fb.getText() + "'",
                ipAddress,
                userAgent
        );
        log.info("ML feedback id={} marked as {} by admin={}", feedbackId, newStatus, actor.getEmail());
    }

    @Override
    public MlClassificationResponse testPrediction(MlClassificationRequest request) {
        if (request == null || request.description() == null || request.description().isBlank()) {
            throw new BadRequestException("Prediction text description cannot be blank");
        }
        return inferenceClient.classify(request);
    }
}
