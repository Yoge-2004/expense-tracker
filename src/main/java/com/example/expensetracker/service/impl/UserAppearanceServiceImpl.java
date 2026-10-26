package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.UserAppearanceDto;
import com.example.expensetracker.model.User;
import com.example.expensetracker.model.UserAppearance;
import com.example.expensetracker.repository.UserAppearanceRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.UserAppearanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserAppearanceServiceImpl implements UserAppearanceService {

    private final UserAppearanceRepository userAppearanceRepository;
    private final UserRepository userRepository;

    private static final UserAppearanceDto DEFAULT_APPEARANCE = new UserAppearanceDto(
            "grotesk",
            null,
            null,
            "default",
            "#C79A3E",
            "#A97F2E",
            "#A23E32",
            "#4C7A78",
            "rgba(23, 26, 20, 0.88)",
            "#171A14",
            "rgba(199, 154, 62, 0.35)",
            "preset",
            null,
            0.35,
            0
    );

    @Override
    @Transactional(readOnly = true)
    public UserAppearanceDto getAppearance(Long userId) {
        return userAppearanceRepository.findByUserId(userId)
                .map(this::toDto)
                .orElse(DEFAULT_APPEARANCE);
    }

    @Override
    @Transactional
    public UserAppearanceDto updateAppearance(Long userId, UserAppearanceDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        UserAppearance appearance = userAppearanceRepository.findByUserId(userId)
                .orElseGet(() -> {
                    UserAppearance newApp = new UserAppearance();
                    newApp.setUser(user);
                    return newApp;
                });

        if (dto.fontChoice() != null) appearance.setFontChoice(dto.fontChoice());
        if (dto.customFontFamily() != null) appearance.setCustomFontFamily(dto.customFontFamily());
        if (dto.customFontData() != null) appearance.setCustomFontData(dto.customFontData());
        if (dto.presetId() != null) appearance.setPresetId(dto.presetId());
        if (dto.primaryColor() != null) appearance.setPrimaryColor(dto.primaryColor());
        if (dto.primaryGradientEnd() != null) appearance.setPrimaryGradientEnd(dto.primaryGradientEnd());
        if (dto.accentColor() != null) appearance.setAccentColor(dto.accentColor());
        if (dto.highlightColor() != null) appearance.setHighlightColor(dto.highlightColor());
        if (dto.cardSurface() != null) appearance.setCardSurface(dto.cardSurface());
        if (dto.surface() != null) appearance.setSurface(dto.surface());
        if (dto.borderAccent() != null) appearance.setBorderAccent(dto.borderAccent());
        if (dto.wallpaperType() != null) appearance.setWallpaperType(dto.wallpaperType());
        if (dto.wallpaperUri() != null) appearance.setWallpaperUri(dto.wallpaperUri());
        if (dto.overlayOpacity() != null) appearance.setOverlayOpacity(dto.overlayOpacity());
        if (dto.blurIntensity() != null) appearance.setBlurIntensity(dto.blurIntensity());

        UserAppearance saved = userAppearanceRepository.save(appearance);
        log.info("Updated user appearance preferences for userId={}: font={}, preset={}, primary={}",
                userId, saved.getFontChoice(), saved.getPresetId(), saved.getPrimaryColor());
        return toDto(saved);
    }

    private UserAppearanceDto toDto(UserAppearance entity) {
        return new UserAppearanceDto(
                entity.getFontChoice() != null ? entity.getFontChoice() : "grotesk",
                entity.getCustomFontFamily(),
                entity.getCustomFontData(),
                entity.getPresetId() != null ? entity.getPresetId() : "default",
                entity.getPrimaryColor() != null ? entity.getPrimaryColor() : "#C79A3E",
                entity.getPrimaryGradientEnd() != null ? entity.getPrimaryGradientEnd() : "#A97F2E",
                entity.getAccentColor() != null ? entity.getAccentColor() : "#A23E32",
                entity.getHighlightColor() != null ? entity.getHighlightColor() : "#4C7A78",
                entity.getCardSurface() != null ? entity.getCardSurface() : "rgba(23, 26, 20, 0.88)",
                entity.getSurface() != null ? entity.getSurface() : "#171A14",
                entity.getBorderAccent() != null ? entity.getBorderAccent() : "rgba(199, 154, 62, 0.35)",
                entity.getWallpaperType() != null ? entity.getWallpaperType() : "preset",
                entity.getWallpaperUri(),
                entity.getOverlayOpacity() != null ? entity.getOverlayOpacity() : 0.35,
                entity.getBlurIntensity() != null ? entity.getBlurIntensity() : 0
        );
    }
}
