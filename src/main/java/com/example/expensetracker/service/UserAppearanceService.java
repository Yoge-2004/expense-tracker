package com.example.expensetracker.service;

import com.example.expensetracker.dto.UserAppearanceDto;

public interface UserAppearanceService {
    UserAppearanceDto getAppearance(Long userId);
    UserAppearanceDto updateAppearance(Long userId, UserAppearanceDto dto);
}
