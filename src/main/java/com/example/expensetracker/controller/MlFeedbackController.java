package com.example.expensetracker.controller;

import com.example.expensetracker.dto.MlFeedbackConsumeRequest;
import com.example.expensetracker.dto.MlFeedbackCountResponse;
import com.example.expensetracker.dto.MlFeedbackPageResponse;
import com.example.expensetracker.dto.MlFeedbackRequest;
import com.example.expensetracker.dto.MlFeedbackResponse;
import com.example.expensetracker.security.CustomUserDetails;
import com.example.expensetracker.service.MlFeedbackService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class MlFeedbackController {

    private static final String TRAINING_TOKEN_HEADER = "X-ML-Training-Token";

    private final MlFeedbackService service;
    private final String trainingToken;

    public MlFeedbackController(
            MlFeedbackService service,
            @Value("${ml.feedback.token:}") String trainingToken) {
        this.service = service;
        this.trainingToken = trainingToken;
    }

    @PostMapping("/ml/feedback")
    public ResponseEntity<MlFeedbackResponse> submitFeedback(
            @AuthenticationPrincipal CustomUserDetails principal,
            @Valid @RequestBody MlFeedbackRequest request) {
        if (principal == null || principal.getUser() == null) {
            throw new AccessDeniedException("Authenticated user required.");
        }
        return ResponseEntity.ok(service.create(principal.getUser(), request));
    }

    @GetMapping("/internal/ml/feedback/count")
    public ResponseEntity<MlFeedbackCountResponse> countTrainingFeedback(
            @RequestHeader(value = TRAINING_TOKEN_HEADER, required = false) String providedToken) {
        requireTrainingToken(providedToken);
        return ResponseEntity.ok(new MlFeedbackCountResponse(service.countEligible()));
    }

    @GetMapping("/internal/ml/feedback")
    public ResponseEntity<MlFeedbackPageResponse> fetchTrainingFeedback(
            @RequestHeader(value = TRAINING_TOKEN_HEADER, required = false) String providedToken,
            @RequestParam(name = "after", required = false) String after,
            @RequestParam(name = "limit", defaultValue = "1000") int limit) {
        requireTrainingToken(providedToken);
        return ResponseEntity.ok(service.fetchEligible(after, limit));
    }

    @PostMapping("/internal/ml/feedback/consume")
    public ResponseEntity<Map<String, Object>> consumeTrainingFeedback(
            @RequestHeader(value = TRAINING_TOKEN_HEADER, required = false) String providedToken,
            @Valid @RequestBody MlFeedbackConsumeRequest request) {
        requireTrainingToken(providedToken);
        int updated = service.consume(request);
        return ResponseEntity.ok(Map.of("status", "ok", "consumed", updated));
    }

    private void requireTrainingToken(String providedToken) {
        if (!StringUtils.hasText(trainingToken) || !StringUtils.hasText(providedToken)) {
            throw new AccessDeniedException("ML training access is not configured.");
        }
        boolean matches = MessageDigest.isEqual(
                trainingToken.getBytes(StandardCharsets.UTF_8),
                providedToken.getBytes(StandardCharsets.UTF_8));
        if (!matches) {
            throw new AccessDeniedException("Invalid ML training token.");
        }
    }
}
