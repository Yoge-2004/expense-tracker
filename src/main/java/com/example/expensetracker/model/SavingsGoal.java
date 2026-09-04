package com.example.expensetracker.model;

import jakarta.persistence.*;

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
    @Column(length = 30)
    private String status = "IN_PROGRESS";

    /**
     * The user account that established this savings goal.
     */
    /**
     * Flag indicating whether this savings goal has automated/recurring contributions (e.g. Chit fund, RD, SIP).
     */
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

    /**
     * Default no-args constructor for JPA.
     */
    public SavingsGoal() {}

    /**
     * Full parameterized constructor.
     *
     * @param id unique identifier
     * @param name goal name
     * @param targetAmount target financial objective
     * @param currentAmount current accumulated savings
     * @param targetDate target target deadline
     * @param status lifecycle status
     * @param user owner user
     */
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

    /**
     * Retrieves primary key id.
     * @return id
     */
    public Long getId() {
        return id;
    }

    /**
     * Sets primary key id.
     * @param id id
     */
    public void setId(Long id) {
        this.id = id;
    }

    /**
     * Retrieves goal name.
     * @return goal name
     */
    public String getName() {
        return name;
    }

    /**
     * Sets goal name.
     * @param name goal name
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Retrieves target monetary amount.
     * @return target amount
     */
    public BigDecimal getTargetAmount() {
        return targetAmount;
    }

    /**
     * Sets target monetary amount.
     * @param targetAmount target amount
     */
    public void setTargetAmount(BigDecimal targetAmount) {
        this.targetAmount = targetAmount;
    }

    /**
     * Retrieves currently accumulated amount.
     * @return current amount
     */
    public BigDecimal getCurrentAmount() {
        return currentAmount != null ? currentAmount : BigDecimal.ZERO;
    }

    /**
     * Sets current amount.
     * @param currentAmount current amount
     */
    public void setCurrentAmount(BigDecimal currentAmount) {
        this.currentAmount = currentAmount != null ? currentAmount : BigDecimal.ZERO;
    }

    /**
     * Retrieves target completion deadline date.
     * @return target date
     */
    public LocalDate getTargetDate() {
        return targetDate;
    }

    /**
     * Sets target completion deadline date.
     * @param targetDate target date
     */
    public void setTargetDate(LocalDate targetDate) {
        this.targetDate = targetDate;
    }

    /**
     * Retrieves lifecycle status.
     * @return status (IN_PROGRESS, COMPLETED, PAUSED)
     */
    public String getStatus() {
        return status != null ? status : "IN_PROGRESS";
    }

    /**
     * Sets lifecycle status.
     * @param status status
     */
    public void setStatus(String status) {
        this.status = status;
    }

    /**
     * Retrieves owner user.
     * @return owning user
     */
    public User getUser() {
        return user;
    }

    /**
     * Sets owner user.
     * @param user owning user
     */
    public void setUser(User user) {
        this.user = user;
    }
    public Boolean getIsRecurring() {
        return isRecurring != null ? isRecurring : false;
    }

    public void setIsRecurring(Boolean recurring) {
        isRecurring = recurring != null ? recurring : false;
    }

    public BigDecimal getRecurringAmount() {
        return recurringAmount;
    }

    public void setRecurringAmount(BigDecimal recurringAmount) {
        this.recurringAmount = recurringAmount;
    }

    public String getFrequency() {
        return frequency;
    }

    public void setFrequency(String frequency) {
        this.frequency = frequency;
    }

    public Integer getIntervalDays() {
        return intervalDays;
    }

    public void setIntervalDays(Integer intervalDays) {
        this.intervalDays = intervalDays;
    }

    public LocalDate getNextDueDate() {
        return nextDueDate;
    }

    public void setNextDueDate(LocalDate nextDueDate) {
        this.nextDueDate = nextDueDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }
}
