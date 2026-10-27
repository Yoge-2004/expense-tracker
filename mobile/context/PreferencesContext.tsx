/**
 * @file PreferencesContext.tsx
 * @description React Context Provider managing UI preferences:
 * - Theme selection (dark / light) with system color scheme detection and persistence
 * - Stealth mode toggle for privacy in public spaces
 * - Currency preference (e.g. INR, USD, EUR)
 * - Dynamic Theming & Appearance Studio (Fonts, Background Assets & Auto-Extracted Palettes)
 * - Bidirectional Cross-Device Cloud Synchronization with Spring Boot backend
 *
 * Decoupled from AuthContext so UI cosmetic toggles do not trigger cascading
 * re-renders of authentication-dependent components.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useColorScheme } from 'react-native';
import * as Font from 'expo-font';
import { safeStorageGet, safeStorageSet, readSavedTheme, persistSavedTheme, apiRequest, getSession } from '../services/api';
import { Colors, ThemeColors, FontChoice, FontTokens, FontPresets, ensureColorContrast } from '../constants/theme';
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
  appearanceLoaded: boolean;
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
  setCustomFont: (fontFamily: string, fontUri?: string) => Promise<void>;
  activeFonts: FontTokens;

  backgroundAsset: BackgroundAssetConfig;
  setBackgroundAsset: (config: BackgroundAssetConfig) => Promise<void>;

  customPalette: ExtractedPalette | null;
  setCustomPalette: (palette: ExtractedPalette | null) => Promise<void>;

  themeColors: ThemeColors;
  resetAppearance: () => Promise<void>;

  // Cloud sync
  syncAppearanceFromCloud: (explicitUserId?: string | null) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

function blendThemeSurface(base: string, requested: string, amount = 0.18): string {
  const channels = (value: string) => {
    const hex = value.match(/^#([0-9a-f]{6})$/i)?.[1];
    if (hex) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    const rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : [23, 26, 20];
  };
  const a = channels(base), b = channels(requested);
  return '#' + a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, '0')).join('');
}

function readableTextForSurfaces(...surfaces: string[]): string {
  const luminance = (color: string) => {
    const hex = color.match(/^#([0-9a-f]{6})$/i)?.[1];
    const rgb = hex
      ? [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
      : (color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)?.slice(1, 4).map(Number) || [23, 26, 20]);
    const linear = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const contrast = (foreground: string, background: string) => {
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const minimumContrast = (foreground: string) => Math.min(...surfaces.map((surface) => contrast(foreground, surface)));
  return minimumContrast('#FFFFFF') >= minimumContrast('#0F172A') ? '#FFFFFF' : '#0F172A';
}

export function createThemeColors(
  theme: 'dark' | 'light',
  customPalette: ExtractedPalette | null,
  presetId = 'default'
): ThemeColors {
  const baseColors = Colors[theme];
  const preset = PRESET_BACKGROUNDS.find((item) => item.id === presetId) || PRESET_BACKGROUNDS[0];
  const activePalette = customPalette ?? (theme === 'light' ? preset.lightPalette : preset.darkPalette);
  if (!activePalette) return baseColors;

  const surfaceTint = customPalette ? 0.62 : 0.18;
  const appSurface = blendThemeSurface(baseColors.bg, activePalette.surface || baseColors.bg, surfaceTint);
  const cardSurface = blendThemeSurface(baseColors.card, activePalette.card || baseColors.card, surfaceTint);
  const primary = ensureColorContrast(
    ensureColorContrast(activePalette.primary || baseColors.primary, appSurface),
    cardSurface
  );
  const accent = ensureColorContrast(
    ensureColorContrast(activePalette.accent || baseColors.accent, appSurface),
    cardSurface
  );
  const highlight = ensureColorContrast(
    ensureColorContrast(activePalette.highlight || baseColors.highlight, appSurface),
    cardSurface
  );
  const success = ensureColorContrast(highlight, cardSurface);
  const warning = ensureColorContrast(activePalette.primaryGradientEnd || baseColors.warning, cardSurface);
  const danger = ensureColorContrast(baseColors.danger, cardSurface);
  const onPrimary = readableTextForSurfaces(primary);
  const textColor = readableTextForSurfaces(appSurface, cardSurface);
  const mutedText = ensureColorContrast(baseColors.textMuted, appSurface, 4.5);
  const primaryGradientEnd = ensureColorContrast(activePalette.primaryGradientEnd || baseColors.primaryGradientEnd, onPrimary);
  const sourcePalette = activePalette.paletteColors?.filter((color) => /^#[0-9a-f]{6}$/i.test(color)) || [];
  const paletteColors = (sourcePalette.length >= 3 ? sourcePalette : [primary, accent, highlight, primaryGradientEnd])
    .map((color) => ensureColorContrast(color, cardSurface));

  return {
    ...baseColors,
    primary,
    primaryGradientEnd,
    onPrimary,
    accent,
    highlight,
    paletteColors,
    success,
    warning,
    danger,
    gold: primary,
    oxblood: danger,
    teal: highlight,
    sage: success,
    text: textColor,
    ink: textColor,
    textMuted: mutedText,
    inkDim: mutedText,
    card: cardSurface,
    cardHover: blendThemeSurface(baseColors.cardHover, primary, 0.08),
    surface: appSurface,
    surfaceHover: blendThemeSurface(baseColors.surfaceHover, primary, 0.08),
    bg: appSurface,
    inputBg: blendThemeSurface(baseColors.inputBg, cardSurface, 0.10),
    borderAccent: primary + '80',
    scrollThumb: primary + '80',
    cardTotalBg: primary + '1F',
    cardTotalBorder: primary + '52',
    cardCountBg: accent + '1F',
    cardCountBorder: accent + '52',
  };
}

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
  const [appearanceLoaded, setAppearanceLoaded] = useState(false);

  useEffect(() => {
    if (initialTheme && !userToggledThemeRef.current && initialTheme !== theme) {
      setTheme(initialTheme);
    }
  }, [initialTheme, theme]);

  const activePreset: PresetBackground = useMemo(() => {
    return (
      PRESET_BACKGROUNDS.find((p) => p.id === backgroundAsset.presetId) ||
      PRESET_BACKGROUNDS[0]
    );
  }, [backgroundAsset.presetId]);

  // Push appearance to cloud backend (non-blocking)
  const pushAppearanceToCloud = useCallback(
    async (overrides?: {
      font?: FontChoice;
      customFont?: string | null;
      bg?: BackgroundAssetConfig;
      palette?: ExtractedPalette | null;
    }) => {
      try {
        const session = await getSession();
        if (!session || !session.userId) return;

        const f = overrides && 'font' in overrides ? overrides.font : fontChoice;
        const cf = overrides && 'customFont' in overrides ? overrides.customFont : customFontFamily;
        const bg = overrides && 'bg' in overrides ? overrides.bg : backgroundAsset;
        const pal = overrides && 'palette' in overrides ? overrides.palette : customPalette;

        const activePal =
          pal ?? (theme === 'light' ? activePreset.lightPalette : activePreset.darkPalette);

        const payload = {
          fontChoice: f,
          customFontFamily: cf,
          presetId: bg?.presetId || 'default',
          primaryColor: activePal?.primary,
          primaryGradientEnd: activePal?.primaryGradientEnd,
          accentColor: activePal?.accent,
          highlightColor: activePal?.highlight,
          cardSurface: activePal?.card,
          surface: activePal?.surface,
          borderAccent: activePal?.borderAccent,
          wallpaperType: bg?.type || 'preset',
          wallpaperUri: bg?.uri || null,
          overlayOpacity: bg?.overlayOpacity ?? 0.35,
          blurIntensity: bg?.blurIntensity ?? 0,
        };

        await apiRequest(`/users/${session.userId}/appearance`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.warn('[PreferencesContext] Cloud appearance push skipped/failed:', e);
      }
    },
    [fontChoice, customFontFamily, backgroundAsset, customPalette, theme, activePreset]
  );

  // Pull appearance from cloud backend
  const syncAppearanceFromCloud = useCallback(
    async (explicitUserId?: string | null) => {
      try {
        const uid = explicitUserId || (await getSession()).userId;
        if (!uid) return;

        const remote = await apiRequest(`/users/${uid}/appearance`);
        if (!remote) return;

        if (
          remote.fontChoice &&
          ['grotesk', 'fraunces', 'mono', 'system', 'custom'].includes(remote.fontChoice)
        ) {
          setFontChoiceState(remote.fontChoice as FontChoice);
          safeStorageSet('app_font_choice', remote.fontChoice).catch(() => {});
        }
        if (remote.customFontFamily) {
          setCustomFontFamilyState(remote.customFontFamily);
          safeStorageSet('app_custom_font_family', remote.customFontFamily).catch(() => {});
        }
        if (remote.primaryColor) {
          const pal: ExtractedPalette = {
            primary: remote.primaryColor,
            primaryGradientEnd: remote.primaryGradientEnd || remote.primaryColor,
            accent: remote.accentColor || '#A23E32',
            highlight: remote.highlightColor || '#4C7A78',
            card: remote.cardSurface || 'rgba(23, 26, 20, 0.88)',
            surface: remote.surface || '#171A14',
            borderAccent: remote.borderAccent || 'rgba(199, 154, 62, 0.35)',
          };
          setCustomPaletteState(pal);
          safeStorageSet('app_custom_palette', JSON.stringify(pal)).catch(() => {});
        }
        if (remote.wallpaperType) {
          const bg: BackgroundAssetConfig = {
            type: (remote.wallpaperType as 'preset' | 'custom' | 'none') || 'preset',
            presetId: remote.presetId || 'default',
            uri: remote.wallpaperUri || undefined,
            overlayOpacity:
              typeof remote.overlayOpacity === 'number' ? remote.overlayOpacity : 0.35,
            blurIntensity:
              typeof remote.blurIntensity === 'number' ? remote.blurIntensity : 0,
          };
          setBackgroundAssetState(bg);
          safeStorageSet('app_bg_asset', JSON.stringify(bg)).catch(() => {});
        }
      } catch (e) {
        console.warn('[PreferencesContext] Cloud appearance pull skipped/failed:', e);
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    // Hydrate saved currency, stealth, and appearance preferences
    Promise.all([
      readSavedTheme(),
      safeStorageGet('user_currency'),
      safeStorageGet('app_stealth_mode'),
      safeStorageGet('app_font_choice'),
      safeStorageGet('app_custom_font_family'),
      safeStorageGet('app_custom_font_uri'),
      safeStorageGet('app_bg_asset'),
      safeStorageGet('app_custom_palette'),
    ])
      .then(async ([savedTheme, savedCurrency, savedStealth, savedFont, savedCustomFont, savedCustomFontUri, savedBg, savedPalette]) => {
        if (!mounted) return;
        let customFontAvailable = false;
        if (savedCustomFont && savedCustomFontUri) {
          try {
            await Font.loadAsync({ [savedCustomFont]: savedCustomFontUri });
            customFontAvailable = true;
          } catch (e) {
            console.warn('[PreferencesContext] Saved custom font could not be restored:', e);
            safeStorageSet('app_custom_font_family', '').catch(() => {});
            safeStorageSet('app_custom_font_uri', '').catch(() => {});
          }
        }
        if (!mounted) return;
        if (!userToggledThemeRef.current && (savedTheme === 'light' || savedTheme === 'dark')) setTheme(savedTheme);
        if (savedStealth === 'true') {
          setIsStealthMode(true);
        }
        if (savedCurrency) {
          setCurrency(savedCurrency);
        }
        if (savedCustomFont && customFontAvailable) {
          setCustomFontFamilyState(savedCustomFont);
        }
        if (savedFont && ['grotesk', 'fraunces', 'mono', 'system', 'custom'].includes(savedFont)) {
          setFontChoiceState(savedFont === 'custom' && !customFontAvailable ? 'grotesk' : savedFont as FontChoice);
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

        // Let the app render once local theme, colors and wallpaper are in place.
        setAppearanceLoaded(true);

        // Check if authenticated session can pull remote appearance
        getSession()
          .then((session) => {
            if (mounted && session?.userId) {
              syncAppearanceFromCloud(session.userId).catch(() => {});
            }
          })
          .catch(() => {});
      })
      .catch((e) => {
        console.warn('[PreferencesContext] Error hydrating preferences:', e);
        if (mounted) setAppearanceLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, [syncAppearanceFromCloud]);

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
    void pushAppearanceToCloud({ font });
  }, [pushAppearanceToCloud]);

  const setCustomFont = useCallback(async (fontFamily: string, fontUri?: string) => {
    setCustomFontFamilyState(fontFamily);
    setFontChoiceState('custom');
    try {
      await safeStorageSet('app_custom_font_family', fontFamily);
      await safeStorageSet('app_font_choice', 'custom');
      if (fontUri) await safeStorageSet('app_custom_font_uri', fontUri);
    } catch (e) {
      console.warn('[PreferencesContext] Failed to save custom font:', e);
    }
    void pushAppearanceToCloud({ font: 'custom', customFont: fontFamily });
  }, [pushAppearanceToCloud]);

  const setBackgroundAsset = useCallback(async (config: BackgroundAssetConfig) => {
    setBackgroundAssetState(config);
    try {
      await safeStorageSet('app_bg_asset', JSON.stringify(config));
    } catch (e) {
      console.warn('[PreferencesContext] Failed to save background asset:', e);
    }
    void pushAppearanceToCloud({ bg: config });
  }, [pushAppearanceToCloud]);

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
    void pushAppearanceToCloud({ palette });
  }, [pushAppearanceToCloud]);

  const resetAppearance = useCallback(async () => {
    setFontChoiceState('grotesk');
    setCustomFontFamilyState(null);
    setBackgroundAssetState(DEFAULT_BG_ASSET);
    setCustomPaletteState(null);
    try {
      await safeStorageSet('app_font_choice', 'grotesk');
      await safeStorageSet('app_custom_font_family', '');
      await safeStorageSet('app_custom_font_uri', '');
      await safeStorageSet('app_bg_asset', JSON.stringify(DEFAULT_BG_ASSET));
      await safeStorageSet('app_custom_palette', '');
    } catch (e) {
      console.warn('[PreferencesContext] Failed to reset appearance:', e);
    }
    void pushAppearanceToCloud({
      font: 'grotesk',
      customFont: null,
      bg: DEFAULT_BG_ASSET,
      palette: null,
    });
  }, [pushAppearanceToCloud]);

  const activeFonts = useMemo(() => {
    if (fontChoice === 'custom' && customFontFamily && Font.isLoaded(customFontFamily)) {
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

  const themeColors = useMemo(
    () => createThemeColors(theme, customPalette, backgroundAsset.presetId),
    [theme, customPalette, backgroundAsset.presetId]
  );

  const value = useMemo(
    () => ({
      theme,
      appearanceLoaded,
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
      syncAppearanceFromCloud,
    }),
    [
      theme,
      appearanceLoaded,
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
      syncAppearanceFromCloud,
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

export function useOptionalActiveFonts(): FontTokens {
  const context = useContext(PreferencesContext);
  return context?.activeFonts || FontPresets.grotesk;
}
