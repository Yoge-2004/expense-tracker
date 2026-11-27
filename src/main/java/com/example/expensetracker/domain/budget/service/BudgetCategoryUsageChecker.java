package com.example.expensetracker.domain.budget.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.service.CategoryUsageChecker;

/**
 * Reports whether an expense category is currently referenced by any user budget.
 */
@Component
@RequiredArgsConstructor
public class BudgetCategoryUsageChecker implements CategoryUsageChecker {

    private final BudgetRepository budgetRepository;

    @Override
    public boolean isCategoryInUse(Long categoryId) {
        return categoryId != null && budgetRepository.existsByCategory_Id(categoryId);
    }
}
