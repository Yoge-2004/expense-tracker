package com.example.expensetracker.repository;

import com.example.expensetracker.model.MlFeedback;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MlFeedbackRepository extends JpaRepository<MlFeedback, Long> {
    long countByTrainingStatus(String trainingStatus);

    List<MlFeedback> findByTrainingStatusAndIdGreaterThanOrderByIdAsc(
            String trainingStatus, Long id, Pageable pageable);

    List<MlFeedback> findByTrainingStatusOrderByIdAsc(String trainingStatus, Pageable pageable);

    Optional<MlFeedback> findByFeedbackId(String feedbackId);
}
