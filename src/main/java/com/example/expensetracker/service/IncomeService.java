package com.example.expensetracker.service;

import com.example.expensetracker.dto.CashFlowSummaryDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.model.User;

import java.util.List;

/**
 * Service interface for managing user income transactions and cash flow summaries.
 *
 * <p>Enforces strict multi-tenant ownership on all income operations and supports
 * cash flow balance calculations comparing total earnings against expenses.</p>
 *
 * @author Yogeshwaran
 */
public interface IncomeService {

    /**
     * Creates and records a new income transaction for the user.
     *
     * @param request the income details
     * @param user the owning user
     * @return the saved income as {@link IncomeDto}
     */
    IncomeDto createIncome(IncomeRequest request, User user);

    /**
     * Retrieves all income records belonging to the specified user.
     *
     * @param user the owning user
     * @return list of {@link IncomeDto} records
     */
    List<IncomeDto> getUserIncomes(User user);

    /**
     * Updates an existing income transaction owned by the user.
     *
     * @param incomeId ID of the income to update
     * @param request updated income details
     * @param user the owning user
     * @return the updated income as {@link IncomeDto}
     * @throws IllegalArgumentException if the record is not found or does not belong to the user
     */
    IncomeDto updateIncome(Long incomeId, IncomeRequest request, User user);

    /**
     * Permanently deletes an income transaction owned by the user.
     *
     * @param incomeId ID of the income to delete
     * @param user the owning user
     * @throws IllegalArgumentException if the record is not found or does not belong to the user
     */
    void deleteIncome(Long incomeId, User user);

    /**
     * Calculates monthly cash flow balance for the user, aggregating total incomes,
     * total expenses, net savings, and savings percentage rate.
     *
     * @param user the user
     * @param year the 4-digit calendar year
     * @param month the month number (1-12)
     * @return {@link CashFlowSummaryDto}
     */
    CashFlowSummaryDto getCashFlowSummary(User user, int year, int month);
}
