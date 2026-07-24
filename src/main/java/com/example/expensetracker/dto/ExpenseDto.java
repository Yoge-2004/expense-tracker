package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Represents a single expense record in API responses (and recurring expense requests). */
@Schema(description = "An expense record — used as both a response body and a request body for recurring expenses")
public class ExpenseDto {

    @Schema(description = "Unique database ID of the expense", example = "42", accessMode = Schema.AccessMode.READ_ONLY)
    private Long id;

    @Schema(description = "Monetary amount of the expense", example = "19.99", requiredMode = Schema.RequiredMode.REQUIRED)
    private BigDecimal amount;

    @Schema(description = "Optional short description or note about the expense", example = "Monthly coffee subscription")
    private String description;

    @Schema(description = "Date the expense was incurred (ISO-8601: yyyy-MM-dd)", example = "2025-06-15", requiredMode = Schema.RequiredMode.REQUIRED)
    private LocalDate expenseDate;

    @Schema(description = "ID of the associated category (null = uncategorised)", example = "1")
    private Long categoryId;

    @Schema(description = "Human-readable name of the associated category", example = "Food", accessMode = Schema.AccessMode.READ_ONLY)
    private String categoryName;

    /** Recurrence pattern for a subscription: DAILY, WEEKLY, MONTHLY, YEARLY, or CUSTOM. */
    private String frequency;

    /** Number of days between charges when frequency is CUSTOM. */
    private Integer intervalDays;

    public ExpenseDto() {}

    public ExpenseDto(Long id, BigDecimal amount, String description,
                      LocalDate expenseDate, Long categoryId, String categoryName) {
        this.id           = id;
        this.amount       = amount;
        this.description  = description;
        this.expenseDate  = expenseDate;
        this.categoryId   = categoryId;
        this.categoryName = categoryName;
    }

    public Long        getId()                         { return id; }
    public void        setId(Long id)                  { this.id = id; }
    public BigDecimal  getAmount()                     { return amount; }
    public void        setAmount(BigDecimal amount)    { this.amount = amount; }
    public String      getDescription()                { return description; }
    public void        setDescription(String d)        { this.description = d; }
    public LocalDate   getExpenseDate()                { return expenseDate; }
    public void        setExpenseDate(LocalDate date)  { this.expenseDate = date; }
    public Long        getCategoryId()                 { return categoryId; }
    public void        setCategoryId(Long categoryId)  { this.categoryId = categoryId; }
    public String      getCategoryName()               { return categoryName; }
    public void        setCategoryName(String name)    { this.categoryName = name; }
    public String      getFrequency()                  { return frequency; }
    public void        setFrequency(String frequency)  { this.frequency = frequency; }
    public Integer     getIntervalDays()               { return intervalDays; }
    public void        setIntervalDays(Integer days)   { this.intervalDays = days; }
}
