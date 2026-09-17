package com.example.expensetracker.service;

import com.example.expensetracker.dto.MlFeedbackConsumeRequest;
import com.example.expensetracker.dto.MlFeedbackRequest;
import com.example.expensetracker.model.MlFeedback;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.MlFeedbackRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MlFeedbackServiceTest {

    @Test
    void createRejectsNonCanonicalCategories() {
        MlFeedbackRepository repository = mock(MlFeedbackRepository.class);
        MlFeedbackService service = new MlFeedbackService(repository);
        User user = mock(User.class);

        MlFeedbackRequest request = new MlFeedbackRequest(
                "t1", "coffee", "food", "not-real", 0.9, "model@1");

        assertThrows(IllegalArgumentException.class, () -> service.create(user, request));
    }

    @Test
    void consumeOnlyMovesEligibleFeedbackToConsumed() {
        MlFeedbackRepository repository = mock(MlFeedbackRepository.class);
        MlFeedbackService service = new MlFeedbackService(repository);

        MlFeedback eligible = feedback("f1", "eligible");
        MlFeedback pending = feedback("f2", "pending");
        when(repository.findByFeedbackId("f1")).thenReturn(java.util.Optional.of(eligible));
        when(repository.findByFeedbackId("f2")).thenReturn(java.util.Optional.of(pending));

        int consumed = service.consume(new MlFeedbackConsumeRequest(List.of("f1", "f2", "missing")));

        assertEquals(1, consumed);
        assertEquals("consumed", eligible.getTrainingStatus());
        assertEquals("pending", pending.getTrainingStatus());
    }

    @Test
    void createMarksValidUserCorrectionEligible() {
        MlFeedbackRepository repository = mock(MlFeedbackRepository.class);
        when(repository.save(any(MlFeedback.class))).thenAnswer(invocation -> invocation.getArgument(0));
        MlFeedbackService service = new MlFeedbackService(repository);
        User user = mock(User.class);

        MlFeedbackRequest request = new MlFeedbackRequest(
                "t1", "coffee shop", "shopping_retail", "food_dining", 0.72, "transformer@v1");

        var response = service.create(user, request);

        assertEquals("eligible", response.status());
    }

    private static MlFeedback feedback(String id, String status) {
        MlFeedback feedback = new MlFeedback();
        feedback.setFeedbackId(id);
        feedback.setTrainingStatus(status);
        feedback.setTransactionId("t-" + id);
        feedback.setText("example");
        feedback.setPredictedCategory("shopping_retail");
        feedback.setCorrectedCategory("food_dining");
        feedback.setConfidence(0.5);
        feedback.setModelVersion("model@v1");
        return feedback;
    }
}
