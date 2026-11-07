package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Category;

/**
 * Utility class for mapping {@link Expense} entity objects to
 * {@link ExpenseDto} data transfer objects.
 *
 * <p>This is a stateless utility class with only static methods.
 * Instantiation is prevented via a private constructor. It safely
 * handles the case where an expense has no associated category by
 * defaulting {@code categoryId} to {@code null} and {@code categoryName}
 * to {@code "Uncategorized"}.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see Expense
 * @see ExpenseDto
 */
public final class ExpenseMapper {

    /**
     * Private constructor to prevent instantiation of this utility class.
     *
     * <p>All methods in this class are static and no instance is needed.</p>
     */
    private ExpenseMapper() {
        // prevent instantiation
    }

    /**
     * Converts an {@link Expense} entity to an {@link ExpenseDto}.
     *
     * <p>Maps the entity's core fields (id, amount, description, expenseDate)
     * along with category details if a category is associated. If the expense
     * has no category or the category proxy cannot be initialized,
     * {@code categoryId} will be {@code null} and {@code categoryName}
     * defaults to {@code "Uncategorized"} without throwing LazyInitializationException.</p>
     *
     * <p>Returns {@code null} safely if the provided expense is {@code null}.</p>
     *
     * @param expense the {@link Expense} entity to convert; may be {@code null}
     * @return the corresponding {@link ExpenseDto}, or {@code null} if input is {@code null}
     */
    public static ExpenseDto toDto(Expense expense) {
        if (expense == null) {
            return null;
        }

        Long categoryId = null;
        String categoryName = "Uncategorized";

        Category category = expense.getCategory();
        if (category != null) {
            try {
                categoryId = category.getId();
                if (category.getName() != null && !category.getName().isBlank()) {
                    categoryName = category.getName();
                }
            } catch (Exception ex) {
                try {
                    categoryId = category.getId();
                } catch (Exception ignored) {
                    categoryId = null;
                }
                categoryName = "Uncategorized";
            }
        }

        return new ExpenseDto(
                expense.getId(),
                expense.getAmount(),
                expense.getDescription(),
                expense.getExpenseDate(),
                categoryId,
                categoryName,
                null,
                null,
                expense.getCreatedAt(),
                expense.isRecurring()
        );
    }
}
