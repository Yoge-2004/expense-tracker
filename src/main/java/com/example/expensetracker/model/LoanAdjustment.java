package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * JPA entity representing a peer loan, borrowing, or casual friend adjustment / bill split.
 *
 * <p>Separates casual peer debts and IOUs from regular operating living expenses
 * and salary income so that personal budgeting metrics, savings rates, and cash flow
 * calculations are not distorted.</p>
 *
 * @author Yogeshwaran
 */
@Entity
@Table(name = "loan_adjustments", indexes = {
    @Index(name = "idx_loan_user_date", columnList = "user_id, adjustment_date"),
    @Index(name = "idx_loan_user_settled", columnList = "user_id, is_settled"),
    @Index(name = "idx_loan_expense", columnList = "expense_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoanAdjustment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Name of the friend, acquaintance, or lender (e.g. "Rahul", "Priya", "John").
     */
    @Column(nullable = false, length = 120)
    private String counterparty;

    /**
     * Whether this is money lent to a friend (receivable) or borrowed from someone (payable).
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LoanType type;

    /**
     * Monetary value of the loan or adjustment. Must be positive.
     */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    /**
     * Date when the loan or adjustment was incurred.
     */
    @Column(name = "adjustment_date", nullable = false)
    private LocalDate adjustmentDate;

    /**
     * Optional expected settlement or return date.
     */
    @Column(name = "due_date")
    private LocalDate dueDate;

    /**
     * Optional notes describing the occasion or reason (e.g., "Goa trip hotel split", "Dinner at cafe").
     */
    @Column(length = 255)
    private String notes;

    /**
     * Whether the loan or adjustment has been fully settled / repaid.
     */
    @Builder.Default
    @Column(name = "is_settled", nullable = false)
    private Boolean isSettled = false;

    /**
     * Date when settlement was marked completed.
     */
    @Column(name = "settled_date")
    private LocalDate settledDate;

    /**
     * Optional link to the original expense that originated or is associated with this loan/adjustment.
     * (e.g. A restaurant dinner bill of ₹4,500 that was split with friends).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "expense_id")
    private Expense expense;

    /**
     * Whether reminder notifications are enabled for this loan adjustment.
     */
    @Builder.Default
    @Column(name = "reminder_enabled", nullable = false)
    private Boolean reminderEnabled = false;

    /**
     * Target date for the reminder notification.
     */
    @Column(name = "reminder_date")
    private LocalDate reminderDate;

    /**
     * Time of day for reminder (e.g. "10:00", "18:30").
     */
    @Column(name = "reminder_time", length = 10)
    private String reminderTime;

    /**
     * Recurrence frequency: "NONE", "ONCE", "DAILY", "WEEKLY", "MONTHLY".
     */
    @Column(name = "reminder_frequency", length = 20)
    private String reminderFrequency;

    /**
     * The user account that owns this record.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    public boolean isSettled() {
        return Boolean.TRUE.equals(isSettled);
    }
}
