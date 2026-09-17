package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * JPA entity representing an income transaction received by a user.
 *
 * <p>Captures earnings from various sources such as salary, investments,
 * freelance work, business, gifts, etc. Every income record is owned by a {@link User}.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see BaseEntity
 * @see User
 */
@Entity
@Table(name = "incomes", indexes = {
    @Index(name = "idx_income_user_date", columnList = "user_id, income_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Income extends BaseEntity {

    /**
     * Unique surrogate primary key for the income record.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Monetary amount received (positive currency value).
     */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    /**
     * Source or channel of income (e.g., Salary, Freelance, Dividend, Bonus).
     */
    @Column(nullable = false, length = 100)
    private String source;

    /**
     * Optional textual description or notes regarding this income.
     */
    @Column(length = 255)
    private String description;

    /**
     * Calendar date on which this income was credited or received.
     */
    @Column(name = "income_date", nullable = false)
    private LocalDate incomeDate;

    /**
     * Flag indicating whether this income is expected to recur on a recurring schedule.
     */
    @Builder.Default
    @Column(name = "is_recurring")
    private Boolean isRecurring = false;

    /**
     * Recurrence frequency: DAILY, WEEKLY, MONTHLY, YEARLY, CUSTOM.
     */
    @Column(length = 20)
    private String frequency;

    /**
     * Interval in days when frequency is CUSTOM.
     */
    @Column(name = "interval_days")
    private Integer intervalDays;

    /**
     * Date when the next recurrence is due to be credited.
     */
    @Column(name = "next_due_date")
    private LocalDate nextDueDate;

    /**
     * The user account that owns this income entry.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    public Income(Long id, BigDecimal amount, String source, String description,
                  LocalDate incomeDate, Boolean isRecurring, User user) {
        this.id = id;
        this.amount = amount;
        this.source = source;
        this.description = description;
        this.incomeDate = incomeDate;
        this.isRecurring = isRecurring != null ? isRecurring : false;
        this.user = user;
    }

    public Boolean getIsRecurring() {
        return isRecurring != null && isRecurring;
    }
}
