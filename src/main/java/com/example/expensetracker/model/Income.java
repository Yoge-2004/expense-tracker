package com.example.expensetracker.model;

import jakarta.persistence.*;

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
    @Column(name = "is_recurring")
    private Boolean isRecurring = false;

    /**
     * The user account that owns this income entry.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * Default no-args constructor for JPA.
     */
    public Income() {}

    /**
     * Full parameterized constructor.
     *
     * @param id unique identifier
     * @param amount monetary value received
     * @param source channel or origin of income
     * @param description optional note or comment
     * @param incomeDate date of transaction
     * @param isRecurring whether recurring
     * @param user the owning user
     */
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

    /**
     * Retrieves the primary key.
     * @return income id
     */
    public Long getId() {
        return id;
    }

    /**
     * Sets the primary key.
     * @param id income id
     */
    public void setId(Long id) {
        this.id = id;
    }

    /**
     * Retrieves the monetary amount.
     * @return monetary amount
     */
    public BigDecimal getAmount() {
        return amount;
    }

    /**
     * Sets the monetary amount.
     * @param amount monetary amount
     */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    /**
     * Retrieves the source or channel.
     * @return income source
     */
    public String getSource() {
        return source;
    }

    /**
     * Sets the source or channel.
     * @param source income source
     */
    public void setSource(String source) {
        this.source = source;
    }

    /**
     * Retrieves the optional note or description.
     * @return description
     */
    public String getDescription() {
        return description;
    }

    /**
     * Sets the optional note or description.
     * @param description description
     */
    public void setDescription(String description) {
        this.description = description;
    }

    /**
     * Retrieves the transaction date.
     * @return income date
     */
    public LocalDate getIncomeDate() {
        return incomeDate;
    }

    /**
     * Sets the transaction date.
     * @param incomeDate income date
     */
    public void setIncomeDate(LocalDate incomeDate) {
        this.incomeDate = incomeDate;
    }

    /**
     * Checks if this income is recurring.
     * @return true if recurring, false otherwise
     */
    public Boolean getIsRecurring() {
        return isRecurring != null && isRecurring;
    }

    /**
     * Sets the recurring flag.
     * @param isRecurring whether recurring
     */
    public void setIsRecurring(Boolean isRecurring) {
        this.isRecurring = isRecurring;
    }

    /**
     * Retrieves the user who owns this record.
     * @return owning user
     */
    public User getUser() {
        return user;
    }

    /**
     * Associates this income with a user.
     * @param user owning user
     */
    public void setUser(User user) {
        this.user = user;
    }
}
