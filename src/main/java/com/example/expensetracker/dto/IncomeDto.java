package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Data Transfer Object representing an income transaction response.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Response payload representing an income record")
public class IncomeDto {

    @Schema(description = "Unique ID of income record", example = "1")
    private Long id;

    @Schema(description = "Monetary income amount", example = "75000.00")
    private BigDecimal amount;

    @Schema(description = "Income channel or origin source", example = "Tech Corp Salary")
    private String source;

    @Schema(description = "Optional context notes or description", example = "August monthly remuneration")
    private String description;

    @Schema(description = "Calendar date when income was received", example = "2026-08-01")
    private LocalDate incomeDate;

    @Schema(description = "Indicates whether income is periodic/recurring", example = "true")
    private Boolean isRecurring;

    @Schema(description = "Timestamp when record was created", example = "2026-08-01T10:15:30")
    private LocalDateTime createdAt;

    @Schema(description = "Recurrence frequency (DAILY, WEEKLY, MONTHLY, YEARLY, CUSTOM)", example = "MONTHLY")
    private String frequency;

    @Schema(description = "Interval in days for CUSTOM frequency", example = "14")
    private Integer intervalDays;

    @Schema(description = "Next scheduled recurrence date", example = "2026-09-01")
    private LocalDate nextDueDate;

    /**
     * Default constructor.
     */
    public IncomeDto() {}

    /**
     * Parameterized constructor.
     *
     * @param id unique ID
     * @param amount monetary value
     * @param source source category
     * @param description note
     * @param incomeDate date
     * @param isRecurring whether recurring
     * @param createdAt creation timestamp
     */
    public IncomeDto(Long id, BigDecimal amount, String source, String description,
                     LocalDate incomeDate, Boolean isRecurring, LocalDateTime createdAt) {
        this.id = id;
        this.amount = amount;
        this.source = source;
        this.description = description;
        this.incomeDate = incomeDate;
        this.isRecurring = isRecurring;
        this.createdAt = createdAt;
    }

    /** @return Record identifier */
    public Long getId() {
        return id;
    }

    /** @param id Record identifier */
    public void setId(Long id) {
        this.id = id;
    }

    /** @return Monetary value */
    public BigDecimal getAmount() {
        return amount;
    }

    /** @param amount Monetary value */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    /** @return Source channel */
    public String getSource() {
        return source;
    }

    /** @param source Source channel */
    public void setSource(String source) {
        this.source = source;
    }

    /** @return Context description */
    public String getDescription() {
        return description;
    }

    /** @param description Context description */
    public void setDescription(String description) {
        this.description = description;
    }

    /** @return Transaction date */
    public LocalDate getIncomeDate() {
        return incomeDate;
    }

    /** @param incomeDate Transaction date */
    public void setIncomeDate(LocalDate incomeDate) {
        this.incomeDate = incomeDate;
    }

    /** @return Recurring flag */
    public Boolean getIsRecurring() {
        return isRecurring != null && isRecurring;
    }

    /** @param isRecurring Recurring flag */
    public void setIsRecurring(Boolean isRecurring) {
        this.isRecurring = isRecurring;
    }

    /** @return Creation timestamp */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /** @param createdAt Creation timestamp */
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    /** @return Frequency */
    public String getFrequency() {
        return frequency;
    }

    /** @param frequency Frequency */
    public void setFrequency(String frequency) {
        this.frequency = frequency;
    }

    /** @return Interval in days */
    public Integer getIntervalDays() {
        return intervalDays;
    }

    /** @param intervalDays Interval in days */
    public void setIntervalDays(Integer intervalDays) {
        this.intervalDays = intervalDays;
    }

    /** @return Next due date */
    public LocalDate getNextDueDate() {
        return nextDueDate;
    }

    /** @param nextDueDate Next due date */
    public void setNextDueDate(LocalDate nextDueDate) {
        this.nextDueDate = nextDueDate;
    }
}
