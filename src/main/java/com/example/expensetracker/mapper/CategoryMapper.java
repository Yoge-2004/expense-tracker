package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.CategoryDto;
import com.example.expensetracker.model.Category;

/**
 * Utility class for mapping {@link Category} entity objects to
 * {@link CategoryDto} data transfer objects.
 *
 * <p>This is a stateless utility class with only static methods.
 * Instantiation is prevented via a private constructor. It is used
 * by controllers and services to convert entity data into a
 * safe, serialisable form suitable for API responses.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see Category
 * @see CategoryDto
 */
public final class CategoryMapper {

    /**
     * Private constructor to prevent instantiation of this utility class.
     *
     * <p>All methods in this class are static and no instance is needed.</p>
     */
    private CategoryMapper() {
        // prevent instantiation
    }

    /**
     * Converts a {@link Category} entity to a {@link CategoryDto}.
     *
     * <p>Maps the entity's {@code id} and {@code name} fields to the DTO.
     * Returns {@code null} safely if the provided category is {@code null},
     * allowing callers to handle absent categories without a NullPointerException.</p>
     *
     * @param category the {@link Category} entity to convert; may be {@code null}
     * @return the corresponding {@link CategoryDto}, or {@code null} if input is {@code null}
     */
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
