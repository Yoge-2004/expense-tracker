package com.example.expensetracker.service;

import com.example.expensetracker.dto.MlFeedbackConsumeRequest;
import com.example.expensetracker.dto.MlFeedbackPageResponse;
import com.example.expensetracker.dto.MlFeedbackRequest;
import com.example.expensetracker.dto.MlFeedbackResponse;
import com.example.expensetracker.dto.MlFeedbackTrainingRecord;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.MlFeedback;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.MlFeedbackRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class MlFeedbackService {

    private static final Set<String> CANONICAL_CATEGORIES = Set.of(
            "food_dining",
            "transportation",
            "shopping_retail",
            "entertainment_recreation",
            "healthcare_medical",
            "utilities_services",
            "financial_services",
            "income",
            "government_legal",
            "charity_donations"
    );

    private final MlFeedbackRepository repository;
    private final ExpenseRepository expenseRepository;

    public MlFeedbackService(MlFeedbackRepository repository, ExpenseRepository expenseRepository) {
        this.repository = repository;
        this.expenseRepository = expenseRepository;
    }

    public MlFeedbackResponse create(User user, MlFeedbackRequest request) {
        String predicted = canonical(request.predictedCategory());
        String corrected = canonical(request.correctedCategory());
        if (!CANONICAL_CATEGORIES.contains(predicted) || !CANONICAL_CATEGORIES.contains(corrected)) {
            throw new IllegalArgumentException("ML feedback categories must use the canonical taxonomy");
        }

        Long expenseId;
        try {
            expenseId = Long.valueOf(request.transactionId().trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("ML feedback transactionId must reference an expense id");
        }
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new IllegalArgumentException("Expense not found"));
        if (expense.getUser() == null || !Objects.equals(expense.getUser().getId(), user.getId())) {
            throw new IllegalArgumentException("ML feedback transaction does not belong to the current user");
        }

        MlFeedback feedback = new MlFeedback();
        feedback.setFeedbackId(UUID.randomUUID().toString().replace("-", ""));
        feedback.setTransactionId(request.transactionId().trim());
        feedback.setText(request.text().trim());
        feedback.setPredictedCategory(predicted);
        feedback.setCorrectedCategory(corrected);
        feedback.setConfidence(request.confidence());
        feedback.setModelVersion(request.modelVersion().trim());
        feedback.setTrainingStatus("eligible");
        feedback.setUser(user);
        repository.save(feedback);
        return new MlFeedbackResponse(feedback.getFeedbackId(), feedback.getTrainingStatus());
    }

    @Transactional(readOnly = true)
    public long countEligible() {
        return repository.countByTrainingStatus("eligible");
    }

    @Transactional(readOnly = true)
    public MlFeedbackPageResponse fetchEligible(String after, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 1000);
        List<MlFeedback> feedback;
        if (after == null || after.isBlank()) {
            feedback = repository.findByTrainingStatusOrderByIdAsc("eligible", PageRequest.of(0, safeLimit));
        } else {
            Long afterId;
            try {
                afterId = Long.valueOf(after);
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException("ML feedback cursor must be a numeric id");
            }
            feedback = repository.findByTrainingStatusAndIdGreaterThanOrderByIdAsc(
                    "eligible", afterId, PageRequest.of(0, safeLimit));
        }

        List<MlFeedbackTrainingRecord> records = feedback.stream()
                .map(item -> new MlFeedbackTrainingRecord(
                        item.getFeedbackId(),
                        item.getTransactionId(),
                        item.getText(),
                        item.getPredictedCategory(),
                        item.getCorrectedCategory(),
                        item.getConfidence(),
                        item.getModelVersion(),
                        item.getCreatedAt(),
                        item.getTrainingStatus(),
                        "spring-boot"
                ))
                .toList();

        String nextCursor = feedback.size() < safeLimit ? null : String.valueOf(feedback.getLast().getId());
        return new MlFeedbackPageResponse(records, nextCursor);
    }

    public int consume(MlFeedbackConsumeRequest request) {
        Set<String> requested = new HashSet<>(request.feedbackIds());
        int updated = 0;
        for (String feedbackId : requested) {
            MlFeedback feedback = repository.findByFeedbackId(feedbackId).orElse(null);
            if (feedback != null && "eligible".equals(feedback.getTrainingStatus())) {
                feedback.setTrainingStatus("consumed");
                updated++;
            }
        }
        return updated;
    }

    private String canonical(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
