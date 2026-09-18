package com.example.expensetracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Persistent record of a user correction used by the ML feedback pipeline. */
@Entity
@Table(name = "ml_feedback", indexes = {
        @Index(name = "idx_ml_feedback_status_id", columnList = "training_status,id"),
        @Index(name = "idx_ml_feedback_user", columnList = "user_id")
})
public class MlFeedback extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "feedback_id", nullable = false, unique = true, length = 64)
    private String feedbackId;

    @Column(name = "transaction_id", nullable = false, length = 128)
    private String transactionId;

    @Column(nullable = false, length = 4000)
    private String text;

    @Column(name = "predicted_category", nullable = false, length = 64)
    private String predictedCategory;

    @Column(name = "corrected_category", nullable = false, length = 64)
    private String correctedCategory;

    @Column(nullable = false)
    private Double confidence;

    @Column(name = "model_version", nullable = false, length = 128)
    private String modelVersion;

    @Column(name = "training_status", nullable = false, length = 32)
    private String trainingStatus = "eligible";

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getFeedbackId() { return feedbackId; }
    public void setFeedbackId(String feedbackId) { this.feedbackId = feedbackId; }
    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getPredictedCategory() { return predictedCategory; }
    public void setPredictedCategory(String predictedCategory) { this.predictedCategory = predictedCategory; }
    public String getCorrectedCategory() { return correctedCategory; }
    public void setCorrectedCategory(String correctedCategory) { this.correctedCategory = correctedCategory; }
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }
    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }
    public String getTrainingStatus() { return trainingStatus; }
    public void setTrainingStatus(String trainingStatus) { this.trainingStatus = trainingStatus; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
}
