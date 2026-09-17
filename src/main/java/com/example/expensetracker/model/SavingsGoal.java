package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * JPA entity representing a savings target or financial goal established by a user.
 *
 * <p>A {@code SavingsGoal} tracks targets like an Emergency Fund, Down Payment,
 * Vacation, or Gadget purchase, tracking the target amount, current accumulated
 * balance, target deadline date, and completion status.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see BaseEntity
 * @see User
 */
@Entity
@Table(name = "savings_goals", indexes = {
    @Index(name = "idx_savings_user", columnList = "user_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavingsGoal extends BaseEntity {

    /**
     * Surrogate primary key for the savings goal.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Descriptive name or label for the goal (e.g., Emergency Fund, Europe Trip).
     */
    @Column(nullable = false, length = 100)
    private String name;

    /**
     * Target monetary savings goal threshold.
     */
    @Column(name = "target_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal targetAmount;

    /**
     * Current total accumulated savings towards this target.
     */
    @Builder.Default
    @Column(name = "current_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal currentAmount = BigDecimal.ZERO;

    /**
     * Optional target completion deadline date.
     */
    @Column(name = "target_date")
    private LocalDate targetDate;

    /**
     * Goal lifecycle status (e.g. IN_PROGRESS, COMPLETED, PAUSED).
     */
    @Builder.Default
    @Column(length = 30)
    private String status = "IN_PROGRESS";

    /**
     * Flag indicating whether this savings goal has automated/recurring contributions (e.g. Chit fund, RD, SIP).
     */
    @Builder.Default
    @Column(name = "is_recurring")
    private Boolean isRecurring = false;

    /**
     * Recurring installment monetary amount.
     */
    @Column(name = "recurring_amount", precision = 12, scale = 2)
    private BigDecimal recurringAmount;

    /**
     * Recurrence frequency: DAILY, WEEKLY, BI_WEEKLY, MONTHLY, YEARLY, CUSTOM.
     */
    @Column(length = 20)
    private String frequency;

    /**
     * Interval in days when frequency is CUSTOM.
     */
    @Column(name = "interval_days")
    private Integer intervalDays;

    /**
     * Next scheduled installment date.
     */
    @Column(name = "next_due_date")
    private LocalDate nextDueDate;

    /**
     * Optional end date when recurring contributions should cease.
     */
    @Column(name = "end_date")
    private LocalDate endDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    public SavingsGoal(Long id, String name, BigDecimal targetAmount, BigDecimal currentAmount,
                       LocalDate targetDate, String status, User user) {
        this.id = id;
        this.name = name;
        this.targetAmount = targetAmount;
        this.currentAmount = currentAmount != null ? currentAmount : BigDecimal.ZERO;
        this.targetDate = targetDate;
        this.status = status != null ? status : "IN_PROGRESS";
        this.user = user;
    }

    public BigDecimal getCurrentAmount() {
        return currentAmount != null ? currentAmount : BigDecimal.ZERO;
    }

    public void setCurrentAmount(BigDecimal currentAmount) {
        this.currentAmount = currentAmount != null ? currentAmount : BigDecimal.ZERO;
    }

    public String getStatus() {
        return status != null ? status : "IN_PROGRESS";
    }

    public Boolean getIsRecurring() {
        return isRecurring != null ? isRecurring : false;
    }

    public void setIsRecurring(Boolean recurring) {
        this.isRecurring = recurring != null ? recurring : false;
    }
}
