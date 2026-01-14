package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Category;

public final class ExpenseMapper {

    private ExpenseMapper() {
        // prevent instantiation
    }

    public static ExpenseDto toDto(Expense expense) {
        if (expense == null) {
            return null;
        }

        Long categoryId = null;
        String categoryName = null;

        Category category = expense.getCategory();
        if (category != null) {
            categoryId = category.getId();
            categoryName = category.getName();
        }

        return new ExpenseDto(
                expense.getId(),
                expense.getAmount(),
                expense.getDescription(),
                expense.getExpenseDate(),
                categoryId,
                categoryName
        );
    }
}
