package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * JPA entity representing a monthly spending budget for a specific expense category.
 *
 * <p>A {@code Budget} defines the maximum amount a {@link User} is allowed to spend
 * in a given {@link Category} within a calendar month. Budget status (spent vs. limit)
 * is calculated dynamically by the expense controller and returned via
 * {@link com.example.expensetracker.dto.BudgetStatusDto}.</p>
 *
 * <p>Each budget is uniquely scoped to a user–category pair. Attempting to create
 * a second budget for the same combination will update the existing one rather
 * than creating a duplicate.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see com.example.expensetracker.repository.BudgetRepository
 */
@Entity
@Table(name = "budget", indexes = {
    @Index(name = "idx_budget_user_cat", columnList = "user_id, category_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Budget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private BigDecimal limitAmount;

    @Builder.Default
    private String period = "MONTHLY"; // MONTHLY, WEEKLY, YEARLY, CUSTOM

    @Column(name = "interval_days")
    private Integer intervalDays;

    private LocalDate startDate;

    private LocalDate endDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    public Budget(Long id, BigDecimal limitAmount, Category category, User user) {
        this.id = id;
        this.limitAmount = limitAmount;
        this.category = category;
        this.user = user;
    }

    public String getPeriod() {
        return period != null ? period : "MONTHLY";
    }
}
