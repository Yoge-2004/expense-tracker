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
}
