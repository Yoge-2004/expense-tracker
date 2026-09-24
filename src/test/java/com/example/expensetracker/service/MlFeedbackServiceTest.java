package com.example.expensetracker.service;

import com.example.expensetracker.dto.MlFeedbackConsumeRequest;
import com.example.expensetracker.dto.MlFeedbackPageResponse;
import com.example.expensetracker.dto.MlFeedbackRequest;
import com.example.expensetracker.dto.MlFeedbackResponse;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.MlFeedback;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.MlFeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MlFeedbackServiceTest {

    private MlFeedbackRepository feedbackRepository;
    private ExpenseRepository expenseRepository;
    private MlFeedbackService service;
    private User testUser;
    private Expense testExpense;

    @BeforeEach
    void setUp() {
        feedbackRepository = mock(MlFeedbackRepository.class);
        expenseRepository = mock(ExpenseRepository.class);
        service = new MlFeedbackService(feedbackRepository, expenseRepository);

        testUser = new User();
        testUser.setId(10L);
        testUser.setName("Test User");
        testUser.setEmail("test@example.com");

        testExpense = new Expense();
        testExpense.setId(42L);
        testExpense.setUser(testUser);
        testExpense.setDescription("Coffee");
    }

    @Test
    @DisplayName("create: rejects non-canonical predicted category")
    void create_rejectsNonCanonicalPredictedCategory() {
        MlFeedbackRequest request = new MlFeedbackRequest(
                "42", "coffee", "non_existent_category", "food_dining", 0.85, "model@v1");

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class, () -> service.create(testUser, request));
        assertEquals("ML feedback categories must use the canonical taxonomy", ex.getMessage());
    }

    @Test
    @DisplayName("create: rejects non-canonical corrected category")
    void create_rejectsNonCanonicalCorrectedCategory() {
        MlFeedbackRequest request = new MlFeedbackRequest(
                "42", "coffee", "food_dining", "invalid_corrected", 0.85, "model@v1");

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class, () -> service.create(testUser, request));
        assertEquals("ML feedback categories must use the canonical taxonomy", ex.getMessage());
    }

    @Test
    @DisplayName("create: rejects non-numeric transactionId")
    void create_rejectsNonNumericTransactionId() {
        MlFeedbackRequest request = new MlFeedbackRequest(
                "not-a-number", "coffee", "shopping_retail", "food_dining", 0.72, "model@v1");

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class, () -> service.create(testUser, request));
        assertEquals("ML feedback transactionId must reference an expense id", ex.getMessage());
    }

    @Test
    @DisplayName("create: rejects missing expense")
    void create_rejectsMissingExpense() {
        when(expenseRepository.findById(42L)).thenReturn(Optional.empty());

        MlFeedbackRequest request = new MlFeedbackRequest(
                "42", "coffee", "shopping_retail", "food_dining", 0.72, "model@v1");

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class, () -> service.create(testUser, request));
        assertEquals("Expense not found", ex.getMessage());
    }

    @Test
    @DisplayName("create: rejects transaction belonging to another user (IDOR prevention)")
    void create_rejectsExpenseOwnedByDifferentUser() {
        User otherUser = new User();
        otherUser.setId(99L);
        testExpense.setUser(otherUser);
        when(expenseRepository.findById(42L)).thenReturn(Optional.of(testExpense));

        MlFeedbackRequest request = new MlFeedbackRequest(
                "42", "coffee", "shopping_retail", "food_dining", 0.72, "model@v1");

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class, () -> service.create(testUser, request));
        assertEquals("ML feedback transaction does not belong to the current user", ex.getMessage());
    }

    @Test
    @DisplayName("create: saves valid user feedback as eligible")
    void create_validRequest_persistsEligibleFeedback() {
        when(expenseRepository.findById(42L)).thenReturn(Optional.of(testExpense));
        when(feedbackRepository.save(any(MlFeedback.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MlFeedbackRequest request = new MlFeedbackRequest(
                "42", "Whole Foods Grocery", "shopping_retail", "food_dining", 0.65, "model@v2");

        MlFeedbackResponse response = service.create(testUser, request);

        assertNotNull(response);
        assertNotNull(response.feedbackId());
        assertEquals("eligible", response.status());
        verify(feedbackRepository).save(any(MlFeedback.class));
    }

    @Test
    @DisplayName("countEligible: delegates count to repository")
    void countEligible_returnsCountFromRepository() {
        when(feedbackRepository.countByTrainingStatus("eligible")).thenReturn(25L);

        long count = service.countEligible();

        assertEquals(25L, count);
        verify(feedbackRepository).countByTrainingStatus("eligible");
    }

    @Test
    @DisplayName("fetchEligible: null or blank after cursor queries first page")
    void fetchEligible_nullCursor_fetchesFirstPage() {
        MlFeedback f1 = createFeedback("f1", 1L, "eligible");
        MlFeedback f2 = createFeedback("f2", 2L, "eligible");
        when(feedbackRepository.findByTrainingStatusOrderByIdAsc(eq("eligible"), any(Pageable.class)))
                .thenReturn(List.of(f1, f2));

        MlFeedbackPageResponse page = service.fetchEligible(null, 2);

        assertEquals(2, page.records().size());
        assertEquals("2", page.nextCursor());
        assertEquals("f1", page.records().getFirst().feedbackId());
    }

    @Test
    @DisplayName("fetchEligible: valid numeric after cursor queries next slice")
    void fetchEligible_withValidCursor_fetchesSubsequentSlice() {
        MlFeedback f3 = createFeedback("f3", 3L, "eligible");
        when(feedbackRepository.findByTrainingStatusAndIdGreaterThanOrderByIdAsc(
                eq("eligible"), eq(2L), any(Pageable.class)))
                .thenReturn(List.of(f3));

        MlFeedbackPageResponse page = service.fetchEligible("2", 5);

        assertEquals(1, page.records().size());
        assertNull(page.nextCursor());
        assertEquals("f3", page.records().getFirst().feedbackId());
    }

    @Test
    @DisplayName("fetchEligible: invalid non-numeric cursor throws IllegalArgumentException")
    void fetchEligible_invalidCursor_throwsException() {
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class, () -> service.fetchEligible("invalid-cursor", 10));
        assertEquals("ML feedback cursor must be a numeric id", ex.getMessage());
    }

    @Test
    @DisplayName("consume: transitions eligible feedback to consumed idempotently")
    void consume_transitionsEligibleToConsumed() {
        MlFeedback f1 = createFeedback("f1", 1L, "eligible");
        MlFeedback f2 = createFeedback("f2", 2L, "pending");
        when(feedbackRepository.findByFeedbackId("f1")).thenReturn(Optional.of(f1));
        when(feedbackRepository.findByFeedbackId("f2")).thenReturn(Optional.of(f2));
        when(feedbackRepository.findByFeedbackId("missing")).thenReturn(Optional.empty());

        int consumed = service.consume(new MlFeedbackConsumeRequest(List.of("f1", "f2", "missing")));

        assertEquals(1, consumed);
        assertEquals("consumed", f1.getTrainingStatus());
        assertEquals("pending", f2.getTrainingStatus());
    }

    private static MlFeedback createFeedback(String feedbackId, Long id, String status) {
        MlFeedback feedback = new MlFeedback();
        feedback.setId(id);
        feedback.setFeedbackId(feedbackId);
        feedback.setTransactionId("42");
        feedback.setText("sample text");
        feedback.setPredictedCategory("shopping_retail");
        feedback.setCorrectedCategory("food_dining");
        feedback.setConfidence(0.85);
        feedback.setModelVersion("v1");
        feedback.setTrainingStatus(status);
        feedback.setCreatedAt(LocalDateTime.of(2026, 9, 18, 10, 0));
        return feedback;
    }
}
