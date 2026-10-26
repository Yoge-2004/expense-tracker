/**
 * @file PreferencesContext.tsx
 * @description React Context Provider managing UI preferences:
 * - Theme selection (dark / light) with system color scheme detection and persistence
 * - Stealth mode toggle for privacy in public spaces
 * - Currency preference (e.g. INR, USD, EUR)
 * - Dynamic Theming & Appearance Studio (Fonts, Background Assets & Auto-Extracted Palettes)
 *
 * Decoupled from AuthContext so UI cosmetic toggles do not trigger cascading
 * re-renders of authentication-dependent components.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { safeStorageGet, safeStorageSet, readSavedTheme, persistSavedTheme, apiRequest } from '../services/api';
import { Colors, ThemeColors, FontChoice, FontTokens, FontPresets } from '../constants/theme';
import { ExtractedPalette, PRESET_BACKGROUNDS, PresetBackground } from '../services/paletteExtractor';

export interface BackgroundAssetConfig {
  type: 'preset' | 'custom' | 'none';
  presetId?: string;
  uri?: string;
  overlayOpacity: number; // 0.0 - 0.9
  blurIntensity?: number; // 0 - 20
}

export const DEFAULT_BG_ASSET: BackgroundAssetConfig = {
  type: 'preset',
  presetId: 'default',
  overlayOpacity: 0.35,
  blurIntensity: 0,
};

export interface PreferencesContextType {
  theme: 'dark' | 'light';
  toggleTheme: () => Promise<void>;
  isStealthMode: boolean;
  toggleStealthMode: () => Promise<void>;
  currency: string;
  updateCurrency: (currency: string, userId?: string | null) => Promise<void>;
  setCurrencyState: (currency: string) => void;

  // Appearance & Studio properties
  fontChoice: FontChoice;
  setFontChoice: (font: FontChoice) => Promise<void>;
  customFontFamily: string | null;
  setCustomFont: (fontFamily: string) => Promise<void>;
  activeFonts: FontTokens;

  backgroundAsset: BackgroundAssetConfig;
  setBackgroundAsset: (config: BackgroundAssetConfig) => Promise<void>;

  customPalette: ExtractedPalette | null;
  setCustomPalette: (palette: ExtractedPalette | null) => Promise<void>;

  themeColors: ThemeColors;
  resetAppearance: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: 'dark' | 'light';
}) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<'dark' | 'light'>(
    initialTheme ?? (systemScheme === 'light' ? 'light' : 'dark')
  );
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [currency, setCurrency] = useState<string>('INR');
  const userToggledThemeRef = useRef(false);

  // Appearance Studio states
  const [fontChoice, setFontChoiceState] = useState<FontChoice>('grotesk');
  const [customFontFamily, setCustomFontFamilyState] = useState<string | null>(null);
  const [backgroundAsset, setBackgroundAssetState] = useState<BackgroundAssetConfig>(DEFAULT_BG_ASSET);
  const [customPalette, setCustomPaletteState] = useState<ExtractedPalette | null>(null);

  useEffect(() => {
    if (initialTheme && !userToggledThemeRef.current && initialTheme !== theme) {
      setTheme(initialTheme);
    }
  }, [initialTheme, theme]);

  useEffect(() => {
    let mounted = true;

    // Fast-path theme load first so UI state aligns before heavyweight crypto/network
    readSavedTheme()
      .then((savedTheme) => {
        if (mounted && !userToggledThemeRef.current && (savedTheme === 'light' || savedTheme === 'dark')) {
          setTheme(savedTheme);
        }
      })
      .catch(() => {});

    // Hydrate saved currency, stealth, and appearance preferences
    Promise.all([
      safeStorageGet('user_currency'),
      safeStorageGet('app_stealth_mode'),
      safeStorageGet('app_font_choice'),
      safeStorageGet('app_custom_font_family'),
      safeStorageGet('app_bg_asset'),
      safeStorageGet('app_custom_palette'),
    ])
      .then(([savedCurrency, savedStealth, savedFont, savedCustomFont, savedBg, savedPalette]) => {
        if (!mounted) return;
        if (savedStealth === 'true') {
          setIsStealthMode(true);
        }
        if (savedCurrency) {
          setCurrency(savedCurrency);
        }
        if (savedCustomFont) {
          setCustomFontFamilyState(savedCustomFont);
        }
        if (savedFont && ['grotesk', 'fraunces', 'mono', 'system', 'custom'].includes(savedFont)) {
          setFontChoiceState(savedFont as FontChoice);
        }
        if (savedBg) {
          try {
            const parsed = JSON.parse(savedBg);
            if (parsed && typeof parsed === 'object') {
              setBackgroundAssetState(parsed);
            }
          } catch {
            // Ignore parse errors
          }
        }
        if (savedPalette) {
          try {
            const parsed = JSON.parse(savedPalette);
            if (parsed && typeof parsed === 'object') {
              setCustomPaletteState(parsed);
            }
          } catch {
            // Ignore parse errors
          }
        }
      })
      .catch((e) => {
        console.warn('[PreferencesContext] Error hydrating preferences:', e);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const toggleTheme = useCallback(async (): Promise<void> => {
    userToggledThemeRef.current = true;
    setTheme((prevTheme) => {
      const nextTheme = prevTheme === 'dark' ? 'light' : 'dark';
      persistSavedTheme(nextTheme).catch((e) => {
        console.warn('[PreferencesContext] Failed to persist theme preference:', e);
      });
      return nextTheme;
    });
  }, []);

  const toggleStealthMode = useCallback(async (): Promise<void> => {
    setIsStealthMode((prev) => {
      const next = !prev;
      safeStorageSet('app_stealth_mode', next ? 'true' : 'false').catch(() => {});
      return next;
    });
  }, []);

  const updateCurrency = useCallback(async (newCurrency: string, userId?: string | null): Promise<void> => {
    const code = newCurrency.trim().toUpperCase();
    if (!code) return;

    if (userId) {
      await apiRequest(`/users/${userId}/currency`, {
        method: 'PUT',
        body: JSON.stringify({ currency: code }),
      });
    }

    setCurrency(code);
    try {
      await safeStorageSet('user_currency', code);
    } catch (e) {
      console.warn('[PreferencesContext] Failed to persist currency code:', e);
    }
  }, []);

  const setCurrencyState = useCallback((code: string) => {
    setCurrency(code);
  }, []);

  const setFontChoice = useCallback(async (font: FontChoice) => {
    setFontChoiceState(font);
    try {
      await safeStorageSet('app_font_choice', font);
    } catch (e) {
      console.warn('[PreferencesContext] Failed to save font choice:', e);
    }
  }, []);

  const setCustomFont = useCallback(async (fontFamily: string) => {
    setCustomFontFamilyState(fontFamily);
    setFontChoiceState('custom');
    try {
      await safeStorageSet('app_custom_font_family', fontFamily);
      await safeStorageSet('app_font_choice', 'custom');
    } catch (e) {
      console.warn('[PreferencesContext] Failed to save custom font:', e);
    }
  }, []);

  const setBackgroundAsset = useCallback(async (config: BackgroundAssetConfig) => {
    setBackgroundAssetState(config);
    try {
      await safeStorageSet('app_bg_asset', JSON.stringify(config));
    } catch (e) {
      console.warn('[PreferencesContext] Failed to save background asset:', e);
    }
  }, []);

  const setCustomPalette = useCallback(async (palette: ExtractedPalette | null) => {
    setCustomPaletteState(palette);
    try {
      if (palette) {
        await safeStorageSet('app_custom_palette', JSON.stringify(palette));
      } else {
        await safeStorageSet('app_custom_palette', '');
      }
    } catch (e) {
      console.warn('[PreferencesContext] Failed to save custom palette:', e);
    }
  }, []);

  const resetAppearance = useCallback(async () => {
    setFontChoiceState('grotesk');
    setCustomFontFamilyState(null);
    setBackgroundAssetState(DEFAULT_BG_ASSET);
    setCustomPaletteState(null);
    try {
      await safeStorageSet('app_font_choice', 'grotesk');
      await safeStorageSet('app_custom_font_family', '');
      await safeStorageSet('app_bg_asset', JSON.stringify(DEFAULT_BG_ASSET));
      await safeStorageSet('app_custom_palette', '');
    } catch (e) {
      console.warn('[PreferencesContext] Failed to reset appearance:', e);
    }
  }, []);

  const activeFonts = useMemo(() => {
    if (fontChoice === 'custom' && customFontFamily) {
      return {
        display: customFontFamily,
        displaySemiBold: customFontFamily,
        body: customFontFamily,
        bodyMedium: customFontFamily,
        bodySemiBold: customFontFamily,
        bodyBold: customFontFamily,
        mono: 'IBMPlexMono_400Regular',
        monoMedium: 'IBMPlexMono_500Medium',
        monoSemiBold: 'IBMPlexMono_600SemiBold',
      };
    }
    return FontPresets[fontChoice] || FontPresets.grotesk;
  }, [fontChoice, customFontFamily]);

  const activePreset: PresetBackground = useMemo(() => {
    return (
      PRESET_BACKGROUNDS.find((p) => p.id === backgroundAsset.presetId) ||
      PRESET_BACKGROUNDS[0]
    );
  }, [backgroundAsset.presetId]);

  const themeColors = useMemo<ThemeColors>(() => {
    const baseColors = Colors[theme];
    const activePalette =
      customPalette ??
      (theme === 'light' ? activePreset.lightPalette : activePreset.darkPalette);

    if (!activePalette) return baseColors;

    return {
      ...baseColors,
      primary: activePalette.primary || baseColors.primary,
      primaryGradientEnd: activePalette.primaryGradientEnd || baseColors.primaryGradientEnd,
      accent: activePalette.accent || baseColors.accent,
      highlight: activePalette.highlight || baseColors.highlight,
      card: activePalette.card || baseColors.card,
      surface: activePalette.surface || baseColors.surface,
      borderAccent: activePalette.borderAccent || baseColors.borderAccent,
      scrollThumb: activePalette.primary ? activePalette.primary + '80' : baseColors.scrollThumb,
      cardTotalBg: activePalette.primary ? activePalette.primary + '1F' : baseColors.cardTotalBg,
      cardTotalBorder: activePalette.primary ? activePalette.primary + '52' : baseColors.cardTotalBorder,
      cardCountBg: activePalette.accent ? activePalette.accent + '1F' : baseColors.cardCountBg,
      cardCountBorder: activePalette.accent ? activePalette.accent + '52' : baseColors.cardCountBorder,
    };
  }, [theme, customPalette, activePreset]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      isStealthMode,
      toggleStealthMode,
      currency,
      updateCurrency,
      setCurrencyState,
      fontChoice,
      setFontChoice,
      customFontFamily,
      setCustomFont,
      activeFonts,
      backgroundAsset,
      setBackgroundAsset,
      customPalette,
      setCustomPalette,
      themeColors,
      resetAppearance,
    }),
    [
      theme,
      toggleTheme,
      isStealthMode,
      toggleStealthMode,
      currency,
      updateCurrency,
      setCurrencyState,
      fontChoice,
      setFontChoice,
      activeFonts,
      backgroundAsset,
      setBackgroundAsset,
      customPalette,
      setCustomPalette,
      themeColors,
      resetAppearance,
    ]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
