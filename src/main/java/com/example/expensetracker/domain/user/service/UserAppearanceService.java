package com.example.expensetracker.domain.user.service;

import com.example.expensetracker.domain.user.dto.UserAppearanceDto;


public interface UserAppearanceService {
    UserAppearanceDto getAppearance(Long userId);
    UserAppearanceDto updateAppearance(Long userId, UserAppearanceDto dto);
}
