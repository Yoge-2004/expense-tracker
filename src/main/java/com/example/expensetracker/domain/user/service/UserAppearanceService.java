package com.example.expensetracker.domain.user.service;

import com.example.expensetracker.domain.user.dto.UserAppearanceDto;


/**
 * Service contract for reading and updating per-user theme and appearance preferences.
 */
public interface UserAppearanceService {
    UserAppearanceDto getAppearance(Long userId);
    UserAppearanceDto updateAppearance(Long userId, UserAppearanceDto dto);
}
