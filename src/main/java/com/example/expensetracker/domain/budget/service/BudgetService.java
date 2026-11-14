package com.example.expensetracker.domain.budget.service;

import java.util.List;

import com.example.expensetracker.domain.budget.dto.BudgetDto;
import com.example.expensetracker.domain.budget.dto.BudgetStatusDto;



/**
 * Service interface defining business logic for budget management and utilization tracking.
 *
 * @author Yogeshwaran
 */
public interface BudgetService {

    /**
     * Sets or updates a budget limit for a category scoped to a specific user.
     *
     * @param userId the user ID setting the budget
     * @param dto    the budget configuration details
     */
    void setBudget(Long userId, BudgetDto dto);

    /**
     * Deletes a budget limit by its primary key ID after verifying user ownership.
     *
     * @param budgetId database ID of the budget to delete
     */
    void deleteBudgetById(Long budgetId);

    /**
     * Deletes the budget configured for a specific user and category.
     *
     * @param userId     the owning user ID
     * @param categoryId the category ID whose budget is to be removed
     */
    void deleteBudgetByCategory(Long userId, Long categoryId);

    /**
     * Calculates the budget status and utilization for all categories configured by the user.
     *
     * @param userId the user ID whose budget status is to be calculated
     * @return list of budget status details with computed expenditures, reimbursements, and percentages
     */
    List<BudgetStatusDto> getBudgetStatus(Long userId);
}
