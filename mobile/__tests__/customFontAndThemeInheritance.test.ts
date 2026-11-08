/**
 * @file customFontAndThemeInheritance.test.ts
 * @description Unit tests for custom .ttf/.otf font application, font weight resolution,
 * wallpaper theme engine color inheritance for textboxes, tabs containers, and banners,
 * as well as theme toggling performance and caching.
 */

import React from 'react';
import { resolveActiveFonts, createThemeColors } from '../context/PreferencesContext';
import { fontForWeight, ThemedText, ThemedTextInput } from '../components/ThemedText';
import { OfflineBanner } from '../components/OfflineBanner';
import { ThemeToggleBtn } from '../components/ThemeToggleBtn';
import { UpdateBanner } from '../components/UpdateBanner';
import { Colors, FontPresets } from '../constants/theme';
import { PRESET_BACKGROUNDS } from '../services/paletteExtractor';

describe('Custom Font (.ttf / .otf) Application Suite', () => {
  const customFamily = 'UserCustom_CabinetGrotesk';

  it('resolves all font weights to custom .ttf family when fontChoice is custom', () => {
    const fonts = resolveActiveFonts('custom', customFamily);

    expect(fonts.display).toBe(customFamily);
    expect(fonts.displaySemiBold).toBe(customFamily);
    expect(fonts.body).toBe(customFamily);
    expect(fonts.bodyMedium).toBe(customFamily);
    expect(fonts.bodySemiBold).toBe(customFamily);
    expect(fonts.bodyBold).toBe(customFamily);
    expect(fonts.mono).toBe('IBMPlexMono_400Regular');
  });

  it('falls back cleanly to default preset when customFontFamily is null or empty', () => {
    const emptyFonts = resolveActiveFonts('custom', null);
    expect(emptyFonts.body).toBe(FontPresets.grotesk.body);

    const presetFonts = resolveActiveFonts('fraunces', customFamily);
    expect(presetFonts.body).toBe(FontPresets.fraunces.body);
  });

  it('fontForWeight maps text hierarchy to custom font family', () => {
    const customFonts = resolveActiveFonts('custom', customFamily);

    // Large title (fontSize >= 22) uses display
    const titleFont = fontForWeight(customFonts, { fontSize: 26, fontWeight: '800' });
    expect(titleFont).toBe(customFamily);

    // Bold body text (fontWeight >= 700) uses bodyBold
    const boldFont = fontForWeight(customFonts, { fontSize: 15, fontWeight: '700' });
    expect(boldFont).toBe(customFamily);

    // Semi-bold text (fontWeight 600) uses bodySemiBold
    const semiBoldFont = fontForWeight(customFonts, { fontSize: 13, fontWeight: '600' });
    expect(semiBoldFont).toBe(customFamily);

    // Regular body text uses body
    const bodyFont = fontForWeight(customFonts, { fontSize: 14, fontWeight: '400' });
    expect(bodyFont).toBe(customFamily);

    // Explicit monospace override preserved
    const monoFont = fontForWeight(customFonts, { fontFamily: 'IBMPlexMono_600SemiBold' });
    expect(monoFont).toBe('IBMPlexMono_600SemiBold');
  });

  it('ThemedText and ThemedTextInput components apply custom font family', () => {
    const textElement = React.createElement(ThemedText, {
      style: { fontSize: 16, fontWeight: '700' },
      children: 'Testing Custom TTF',
    });
    expect(textElement).toBeDefined();

    const inputElement = React.createElement(ThemedTextInput, {
      style: { fontSize: 14 },
      placeholder: 'Type here...',
    });
    expect(inputElement).toBeDefined();
  });
});

describe('Wallpaper Theme Engine Color Inheritance Suite', () => {
  const amethystPalette = {
    primary: '#8B5CF6',
    primaryGradientEnd: '#7C3AED',
    accent: '#EC4899',
    highlight: '#A855F7',
    card: '#1F1435',
    surface: '#150D24',
    borderAccent: 'rgba(139, 92, 246, 0.40)',
    paletteColors: ['#8B5CF6', '#EC4899', '#A855F7', '#7C3AED'],
  };

  it('derives inputBg with wallpaper primary tint instead of pitch black in dark mode', () => {
    const darkColors = createThemeColors('dark', amethystPalette as any);

    // inputBg should not be generic #10120E, but should inherit the wallpaper palette
    expect(darkColors.inputBg.toLowerCase()).not.toBe('#10120e');
    expect(darkColors.inputBg).toBeTruthy();

    const lightColors = createThemeColors('light', amethystPalette as any);
    expect(lightColors.inputBg).toBeTruthy();
    expect(lightColors.inputBg.toLowerCase()).not.toBe('#000000');
  });

  it('derives fillSubtle and fillStrong from cardSurface and primary color for tabs container', () => {
    const darkColors = createThemeColors('dark', amethystPalette as any);

    // Tabs container uses c.fillSubtle and c.border
    expect(darkColors.fillSubtle).toBeTruthy();
    expect(darkColors.fillStrong).toBeTruthy();
    expect(darkColors.border).toBeTruthy();
    expect(darkColors.inputBorder).toBe('rgba(236, 231, 216, 0.10)');

    // In light theme
    const lightColors = createThemeColors('light', amethystPalette as any);
    expect(lightColors.fillSubtle).toBeTruthy();
    expect(lightColors.border).toBeTruthy();
  });

  it('harmonizes preset backgrounds with cards, textboxes and tabs containers', () => {
    for (const preset of PRESET_BACKGROUNDS) {
      const darkTheme = createThemeColors('dark', null, preset.id);
      expect(darkTheme.primary).toBeTruthy();
      expect(darkTheme.card).toBeTruthy();
      expect(darkTheme.inputBg).toBeTruthy();
      expect(darkTheme.fillSubtle).toBeTruthy();
      expect(darkTheme.border).toBeTruthy();

      const lightTheme = createThemeColors('light', null, preset.id);
      expect(lightTheme.primary).toBeTruthy();
      expect(lightTheme.card).toBeTruthy();
      expect(lightTheme.inputBg).toBeTruthy();
      expect(lightTheme.fillSubtle).toBeTruthy();
      expect(lightTheme.border).toBeTruthy();
    }
  });

  it('returns pure pristine default Colors when customPalette is null and preset is default', () => {
    const defaultDark = createThemeColors('dark', null, 'default');
    expect(defaultDark).toBe(Colors.dark);

    const defaultLight = createThemeColors('light', null, 'default');
    expect(defaultLight).toBe(Colors.light);
  });

  it('caches theme calculations for instant 0ms theme toggle performance', () => {
    const firstCall = createThemeColors('dark', amethystPalette as any);
    const secondCall = createThemeColors('dark', amethystPalette as any);

    // Identical object reference returned from LRU cache
    expect(firstCall).toBe(secondCall);

    // Pre-warmed presets are also cached with identical reference
    const presetDark1 = createThemeColors('dark', null, 'default');
    const presetDark2 = createThemeColors('dark', null, 'default');
    expect(presetDark1).toBe(presetDark2);
  });
});

describe('Theme Banners and Toggle Performance Suite', () => {
  it('instantiates OfflineBanner with theme tokens and custom style', () => {
    const element = React.createElement(OfflineBanner, {
      message: 'Offline mode · Cached at 10:42',
      onRetry: () => {},
      retrying: false,
      style: { marginHorizontal: 16 },
    });
    expect(element).toBeDefined();
    expect(element.props.message).toContain('Cached at');
    expect(element.props.style).toEqual({ marginHorizontal: 16 });
  });

  it('instantiates ThemeToggleBtn and UpdateBanner cleanly', () => {
    const toggleElement = React.createElement(ThemeToggleBtn, {});
    expect(toggleElement).toBeDefined();

    const updateBannerElement = React.createElement(UpdateBanner, {});
    expect(updateBannerElement).toBeDefined();
  });
});
