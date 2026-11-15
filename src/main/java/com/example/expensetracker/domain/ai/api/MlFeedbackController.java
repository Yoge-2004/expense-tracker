package com.example.expensetracker.domain.ai.api;

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

import com.example.expensetracker.domain.ai.dto.MlFeedbackConsumeRequest;
import com.example.expensetracker.domain.ai.dto.MlFeedbackCountResponse;
import com.example.expensetracker.domain.ai.dto.MlFeedbackPageResponse;
import com.example.expensetracker.domain.ai.dto.MlFeedbackRequest;
import com.example.expensetracker.domain.ai.dto.MlFeedbackResponse;
import com.example.expensetracker.domain.ai.service.MlFeedbackService;
import com.example.expensetracker.infrastructure.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;



@Tag(
    name = "ML Feedback",
    description = """
        Lets users correct the app's smart category suggestions and lets the training jobs read those
        corrections.

        **User endpoint** (`/api/ml/feedback`): needs a normal JWT.

        **Training endpoints** (`/api/internal/ml/**`): for the retraining jobs only. They use the
        `X-ML-Training-Token` header instead of a JWT and answer `403` without a valid token.
        """
)
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

    @Operation(summary = "Submit category feedback",
            description = "Records that the signed-in user corrected, or confirmed, a suggested category. "
                    + "Used to improve future model versions.")
    @ApiResponse(responseCode = "200", description = "Feedback stored")
    @ApiResponse(responseCode = "400", description = "Invalid feedback payload")
    @PostMapping("/ml/feedback")
    public ResponseEntity<MlFeedbackResponse> submitFeedback(
            @AuthenticationPrincipal CustomUserDetails principal,
            @Valid @RequestBody MlFeedbackRequest request) {
        if (principal == null || principal.getUser() == null) {
            throw new AccessDeniedException("Authenticated user required.");
        }
        return ResponseEntity.ok(service.create(principal.getUser(), request));
    }

    @Operation(summary = "Count feedback ready for training",
            description = "Training jobs only. Returns how many feedback rows are eligible for retraining.")
    @SecurityRequirements
    @ApiResponse(responseCode = "200", description = "Eligible row count")
    @ApiResponse(responseCode = "403", description = "Missing or invalid training token")
    @GetMapping("/internal/ml/feedback/count")
    public ResponseEntity<MlFeedbackCountResponse> countTrainingFeedback(
            @Parameter(description = "Shared secret for training jobs.", required = true)
            @RequestHeader(value = TRAINING_TOKEN_HEADER, required = false) String providedToken) {
        requireTrainingToken(providedToken);
        return ResponseEntity.ok(new MlFeedbackCountResponse(service.countEligible()));
    }

    @Operation(summary = "Fetch feedback for training",
            description = "Training jobs only. Returns one page of eligible feedback rows. "
                    + "Pass the `after` cursor from the previous page to continue.")
    @SecurityRequirements
    @ApiResponse(responseCode = "200", description = "A page of feedback rows")
    @ApiResponse(responseCode = "403", description = "Missing or invalid training token")
    @GetMapping("/internal/ml/feedback")
    public ResponseEntity<MlFeedbackPageResponse> fetchTrainingFeedback(
            @Parameter(description = "Shared secret for training jobs.", required = true)
            @RequestHeader(value = TRAINING_TOKEN_HEADER, required = false) String providedToken,
            @Parameter(description = "Cursor from the previous page; omit for the first page.")
            @RequestParam(name = "after", required = false) String after,
            @Parameter(description = "Maximum rows per page.")
            @RequestParam(name = "limit", defaultValue = "1000") int limit) {
        requireTrainingToken(providedToken);
        return ResponseEntity.ok(service.fetchEligible(after, limit));
    }

    @Operation(summary = "Mark feedback as consumed",
            description = "Training jobs only. Marks rows as used so later runs skip them.")
    @SecurityRequirements
    @ApiResponse(responseCode = "200", description = "Number of rows marked as consumed")
    @ApiResponse(responseCode = "403", description = "Missing or invalid training token")
    @PostMapping("/internal/ml/feedback/consume")
    public ResponseEntity<Map<String, Object>> consumeTrainingFeedback(
            @Parameter(description = "Shared secret for training jobs.", required = true)
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
