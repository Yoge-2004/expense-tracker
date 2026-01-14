package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.CategoryDto;
import com.example.expensetracker.model.Category;

public final class CategoryMapper {

    private CategoryMapper() {
        // prevent instantiation
    }

    public static CategoryDto toDto(Category category) {
        if (category == null) {
            return null;
        }

        return new CategoryDto(
                category.getId(),
                category.getName()
        );
    }
}
