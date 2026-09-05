package com.example.expensetracker.model;

import jakarta.persistence.*;

import java.math.BigDecimal;

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
 * than creating a duplicate (handled in
 * {@link com.example.expensetracker.controller.ExpenseController#setBudget}).</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see com.example.expensetracker.repository.BudgetRepository
 */
@Entity
@Table(name = "budget", indexes = {
    @Index(name = "idx_budget_user_cat", columnList = "user_id, category_id")
})
public class Budget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private BigDecimal limitAmount;

    private String period = "MONTHLY"; // MONTHLY, WEEKLY, YEARLY, CUSTOM

    @Column(name = "interval_days")
    private Integer intervalDays;

    private java.time.LocalDate startDate;

    private java.time.LocalDate endDate;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    /**
     * Constructs an empty {@code Budget}.
     * Required by JPA and for Jackson deserialisation.
     */
    public Budget() {}

    /**
     * Constructs a {@code Budget} with all fields populated.
     *
     * @param id          the unique identifier for this budget record
     * @param limitAmount the monthly spending limit for the category
     * @param category    the category this budget applies to
     * @param user        the user who owns this budget
     */
    public Budget(Long id, BigDecimal limitAmount, Category category, User user) {
        this.id = id;
        this.limitAmount = limitAmount;
        this.category = category;
        this.user = user;
    }

    /**
     * Returns the unique identifier of this budget record.
     *
     * @return the budget ID
     */
    public Long getId() {
        return id;
    }

    /**
     * Sets the unique identifier of this budget record.
     *
     * @param id the budget ID to set
     */
    public void setId(Long id) {
        this.id = id;
    }

    /**
     * Returns the monthly spending limit for the associated category.
     *
     * @return the budget limit amount
     */
    public BigDecimal getLimitAmount() {
        return limitAmount;
    }

    /**
     * Sets the monthly spending limit for the associated category.
     *
     * @param limitAmount the limit amount to set; must be positive
     */
    public void setLimitAmount(BigDecimal limitAmount) {
        this.limitAmount = limitAmount;
    }

    /**
     * Returns the expense category to which this budget applies.
     *
     * @return the associated {@link Category}
     */
    public Category getCategory() {
        return category;
    }

    /**
     * Sets the expense category to which this budget applies.
     *
     * @param category the category to associate with this budget
     */
    public void setCategory(Category category) {
        this.category = category;
    }

    /**
     * Returns the user who owns this budget configuration.
     *
     * @return the owning {@link User}
     */
    public User getUser() {
        return user;
    }

    /**
     * Sets the user who owns this budget configuration.
     *
     * @param user the user to associate with this budget
     */
    public void setUser(User user) {
        this.user = user;
    }

    public String getPeriod() {
        return period != null ? period : "MONTHLY";
    }

    public void setPeriod(String period) {
        this.period = period;
    }

    public Integer getIntervalDays() {
        return intervalDays;
    }

    public void setIntervalDays(Integer intervalDays) {
        this.intervalDays = intervalDays;
    }

    public java.time.LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(java.time.LocalDate startDate) {
        this.startDate = startDate;
    }

    public java.time.LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(java.time.LocalDate endDate) {
        this.endDate = endDate;
    }
}
