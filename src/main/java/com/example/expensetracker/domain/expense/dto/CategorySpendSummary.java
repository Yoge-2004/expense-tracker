package com.example.expensetracker.domain.expense.dto;

import java.math.BigDecimal;

/**
 * Projection carrying aggregated expense spend per category for a date window.
 *
 * @param categoryId  identifier of the expense category
 * @param totalAmount sum of expense amounts for that category
 */
public record CategorySpendSummary(Long categoryId, BigDecimal totalAmount) {}
