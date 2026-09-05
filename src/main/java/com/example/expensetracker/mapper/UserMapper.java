package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.UserDto;
import com.example.expensetracker.model.User;

/**
 * Utility class for mapping {@link User} entity objects to
 * {@link UserDto} data transfer objects.
 *
 * <p>This is a stateless utility class with only static methods.
 * Instantiation is prevented via a private constructor. It is used
 * to project user entity data into a safe API-facing representation,
 * intentionally omitting sensitive fields such as the hashed password.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see User
 * @see UserDto
 */
public final class UserMapper {

    /**
     * Private constructor to prevent instantiation of this utility class.
     *
     * <p>All methods in this class are static and no instance is needed.</p>
     */
    private UserMapper() {
        // prevent instantiation
    }

    /**
     * Converts a {@link User} entity to a {@link UserDto}.
     *
     * <p>Maps the entity's {@code id}, {@code name}, {@code username}, {@code email},
     * {@code enabled}, and {@code currency} fields to the DTO. Sensitive fields such as
     * {@code password} and {@code accountLocked} are intentionally excluded from the output
     * to prevent exposure in API responses.</p>
     *
     * <p>Returns {@code null} safely if the provided user is {@code null}.</p>
     *
     * @param user the {@link User} entity to convert; may be {@code null}
     * @return the corresponding {@link UserDto}, or {@code null} if input is {@code null}
     */
    public static UserDto toDto(User user) {
        if (user == null) {
            return null;
        }

        return new UserDto(
                user.getId(),
                user.getName(),
                user.getUsername(),
                user.getEmail(),
                user.isEnabled(),
                user.getCurrency()
        );
    }
}
