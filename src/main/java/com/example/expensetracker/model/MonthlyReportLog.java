package com.example.expensetracker.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "monthly_report_logs", uniqueConstraints = {
    @UniqueConstraint(name = "uk_user_report_period", columnNames = {"user_id", "report_year", "report_month"})
})
public class MonthlyReportLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "report_year", nullable = false)
    private int reportYear;

    @Column(name = "report_month", nullable = false)
    private int reportMonth;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;

    @Column(name = "sent_successfully", nullable = false)
    private boolean sentSuccessfully;

    @Column(name = "error_message")
    private String errorMessage;

    public MonthlyReportLog() {}

    public MonthlyReportLog(User user, int reportYear, int reportMonth, LocalDateTime sentAt, boolean sentSuccessfully, String errorMessage) {
        this.user = user;
        this.reportYear = reportYear;
        this.reportMonth = reportMonth;
        this.sentAt = sentAt;
        this.sentSuccessfully = sentSuccessfully;
        this.errorMessage = errorMessage;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public int getReportYear() { return reportYear; }
    public void setReportYear(int reportYear) { this.reportYear = reportYear; }

    public int getReportMonth() { return reportMonth; }
    public void setReportMonth(int reportMonth) { this.reportMonth = reportMonth; }

    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }

    public boolean isSentSuccessfully() { return sentSuccessfully; }
    public void setSentSuccessfully(boolean sentSuccessfully) { this.sentSuccessfully = sentSuccessfully; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
