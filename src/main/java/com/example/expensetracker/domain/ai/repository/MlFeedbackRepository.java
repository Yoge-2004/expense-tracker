package com.example.expensetracker.domain.ai.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.example.expensetracker.domain.ai.model.MlFeedback;
import com.example.expensetracker.domain.user.model.User;



public interface MlFeedbackRepository extends JpaRepository<MlFeedback, Long> {
    long countByTrainingStatus(String trainingStatus);

    long countByTrainingStatusIn(Collection<String> trainingStatuses);

    List<MlFeedback> findByTrainingStatusAndIdGreaterThanOrderByIdAsc(
            String trainingStatus, Long id, Pageable pageable);

    List<MlFeedback> findByTrainingStatusInAndIdGreaterThanOrderByIdAsc(
            Collection<String> trainingStatuses, Long id, Pageable pageable);

    List<MlFeedback> findByTrainingStatusOrderByIdAsc(String trainingStatus, Pageable pageable);

    List<MlFeedback> findByTrainingStatusInOrderByIdAsc(
            Collection<String> trainingStatuses, Pageable pageable);

    Page<MlFeedback> findAllByOrderByIdDesc(Pageable pageable);

    Optional<MlFeedback> findByFeedbackId(String feedbackId);

    void deleteByUser(com.example.expensetracker.domain.user.model.User user);
}
