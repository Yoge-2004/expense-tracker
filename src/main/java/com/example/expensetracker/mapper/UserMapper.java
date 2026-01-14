package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.UserDto;
import com.example.expensetracker.model.User;

public final class UserMapper {

    private UserMapper() {
        // prevent instantiation
    }

    public static UserDto toDto(User user) {
        if (user == null) {
            return null;
        }

        return new UserDto(
                user.getId(),
                user.getEmail(),
                user.isEnabled()
        );
    }
}
