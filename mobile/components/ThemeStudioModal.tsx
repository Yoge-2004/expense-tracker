/**
 * @file ThemeStudioModal.tsx
 * @description Interactive Appearance & Theming Studio modal for the mobile app.
 *
 * Allows users to customize:
 * 1. Typography: Modern Grotesk, Editorial Serif, Financial Monospace, and System default fonts.
 * 2. Atmospheric Backgrounds: Curated luxury mesh presets or custom user-uploaded wallpapers / GIFs.
 * 3. Smart Palette Extraction: Zero-native-dependency client-side quantization extracting vibrant
 *    primary, accent, card surface tint, and border accents directly from background assets.
 * 4. Element Colors Customizer: Fine-tune or override individual UI element colors.
 */

import React, { useState, useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { usePreferences, BackgroundAssetConfig } from '../context/PreferencesContext';
import * as Font from 'expo-font';
import { FontChoice, FontPresets, CategoryPalette } from '../constants/theme';
import {
  PRESET_BACKGROUNDS,
  PresetBackground,
  extractPaletteFromImageUri,
  ExtractedPalette,
  adjustBrightness,
} from '../services/paletteExtractor';
import { ThemedScrollView } from './ThemedScrollbar';

interface ThemeStudioModalProps {
  visible: boolean;
  onClose: () => void;
}

type StudioTab = 'typography' | 'atmosphere' | 'colors';

export const ThemeStudioModal: React.FC<ThemeStudioModalProps> = ({ visible, onClose }) => {
  const {
    theme,
    toggleTheme,
    fontChoice,
    setFontChoice,
    customFontFamily,
    setCustomFont,
    backgroundAsset,
    setBackgroundAsset,
    customPalette,
    setCustomPalette,
    themeColors,
    resetAppearance,
  } = usePreferences();

  const { width } = useWindowDimensions();
  const isLight = theme === 'light';
  const c = themeColors;

  const [activeTab, setActiveTab] = useState<StudioTab>('typography');
  const [customUrl, setCustomUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);

  // Custom Color Picker & Target States
  const [customHexInput, setCustomHexInput] = useState(c.primary);
  const [colorTarget, setColorTarget] = useState<'primary' | 'accent' | 'highlight'>('primary');

  // Custom Font Import States
  const [isFontLoading, setIsFontLoading] = useState(false);
  const [fontStatusMsg, setFontStatusMsg] = useState<string | null>(null);

  const isWide = width >= 640;

  // Curated accent swatch choices for quick customization
  const QUICK_ACCENTS = useMemo(
    () => [
      { name: 'Imperial Gold', hex: '#C79A3E' },
      { name: 'Emerald Jade', hex: '#10B981' },
      { name: 'Galactic Amethyst', hex: '#8B5CF6' },
      { name: 'Cyber Cobalt', hex: '#38BDF8' },
      { name: 'Sunset Amber', hex: '#F59E0B' },
      { name: 'Crimson Flame', hex: '#EF4444' },
      { name: 'Vivid Rose', hex: '#EC4899' },
      { name: 'Persian Teal', hex: '#0D9488' },
      { name: 'Deep Indigo', hex: '#6366F1' },
      { name: 'Warm Umber', hex: '#8B5E34' },
    ],
    []
  );

  const handlePickLocalImage = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const picked = res.assets[0];

      const newConfig: BackgroundAssetConfig = {
        type: 'custom',
        uri: picked.uri,
        overlayOpacity: backgroundAsset.overlayOpacity ?? 0.35,
        blurIntensity: backgroundAsset.blurIntensity ?? 0,
      };

      await setBackgroundAsset(newConfig);

      // Automatically trigger smart color extraction
      await handleExtractFromUri(picked.uri);
    } catch (err) {
      console.warn('[ThemeStudio] Failed picking image:', err);
    }
  };

  const handleApplyCustomUrl = async () => {
    if (!customUrl.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const newConfig: BackgroundAssetConfig = {
      type: 'custom',
      uri: customUrl.trim(),
      overlayOpacity: backgroundAsset.overlayOpacity ?? 0.35,
      blurIntensity: backgroundAsset.blurIntensity ?? 0,
    };

    await setBackgroundAsset(newConfig);
    await handleExtractFromUri(customUrl.trim());
    setCustomUrl('');
  };

  const handleExtractFromUri = async (uri: string) => {
    try {
      setIsExtracting(true);
      setExtractSuccess(null);
      const palette = await extractPaletteFromImageUri(uri, isLight);
      await setCustomPalette(palette);
      setExtractSuccess('Colors harmonized from wallpaper!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.warn('[ThemeStudio] Extraction failed:', err);
    } finally {
      setIsExtracting(false);
      setTimeout(() => setExtractSuccess(null), 3000);
    }
  };

  const handleSelectPreset = async (preset: PresetBackground) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const newConfig: BackgroundAssetConfig = {
      type: 'preset',
      presetId: preset.id,
      overlayOpacity: backgroundAsset.overlayOpacity ?? 0.35,
      blurIntensity: 0,
    };
    await setBackgroundAsset(newConfig);
    // Clearing custom palette allows preset-calibrated palette to shine
    await setCustomPalette(null);
  };

  const handleImportCustomFont = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const picked = res.assets[0];
      const fileName = picked.name || 'custom-font.ttf';
      const ext = fileName.toLowerCase().split('.').pop();
      if (ext !== 'ttf' && ext !== 'otf') {
        setFontStatusMsg('Please select a valid .ttf or .otf font file');
        setTimeout(() => setFontStatusMsg(null), 3500);
        return;
      }

      setIsFontLoading(true);
      setFontStatusMsg(`Loading ${fileName}...`);

      const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const customFamilyKey = `UserCustom_${baseName}`;

      await Font.loadAsync({
        [customFamilyKey]: picked.uri,
      });

      await setCustomFont(customFamilyKey);
      setFontStatusMsg(`Imported & applied font: ${baseName}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      console.warn('[ThemeStudio] Font load error:', err);
      setFontStatusMsg(`Failed to import font: ${err.message || 'Unknown error'}`);
    } finally {
      setIsFontLoading(false);
      setTimeout(() => setFontStatusMsg(null), 4000);
    }
  };

  const handleApplyCustomHex = async (hexOverride?: string) => {
    let hex = (hexOverride || customHexInput).trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setExtractSuccess('Invalid Hex color (must be 6 hex characters, e.g. #C79A3E)');
      setTimeout(() => setExtractSuccess(null), 3000);
      return;
    }

    setCustomHexInput(hex);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const basePalette = customPalette || {
      primary: c.primary,
      primaryGradientEnd: c.primaryGradientEnd,
      accent: c.accent,
      highlight: c.highlight,
      card: c.card,
      surface: c.surface,
      borderAccent: c.borderAccent,
    };

    if (colorTarget === 'primary') {
      await setCustomPalette({
        ...basePalette,
        primary: hex,
        primaryGradientEnd: adjustBrightness(hex, 0.85),
        borderAccent: hex + '55',
      });
      setExtractSuccess(`Primary Brand color applied: ${hex.toUpperCase()}`);
    } else if (colorTarget === 'accent') {
      await setCustomPalette({
        ...basePalette,
        accent: hex,
      });
      setExtractSuccess(`Dynamic Accent color applied: ${hex.toUpperCase()}`);
    } else {
      await setCustomPalette({
        ...basePalette,
        highlight: hex,
      });
      setExtractSuccess(`Highlight Glow color applied: ${hex.toUpperCase()}`);
    }
    setTimeout(() => setExtractSuccess(null), 3000);
  };

  const handleSelectFont = async (font: FontChoice) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await setFontChoice(font);
  };

  const handleSetOverlayOpacity = async (opacity: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await setBackgroundAsset({
      ...backgroundAsset,
      overlayOpacity: opacity,
    });
  };

  const handleSelectQuickPrimary = async (hex: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const basePalette = customPalette || {
      primary: hex,
      primaryGradientEnd: adjustBrightness(hex, 0.85),
      accent: c.accent,
      highlight: c.highlight,
      card: c.card,
      surface: c.surface,
      borderAccent: hex + '55',
    };

    await setCustomPalette({
      ...basePalette,
      primary: hex,
      primaryGradientEnd: adjustBrightness(hex, 0.85),
      borderAccent: hex + '55',
    });
  };

  const handleSelectQuickAccent = async (hex: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const basePalette = customPalette || {
      primary: c.primary,
      primaryGradientEnd: c.primaryGradientEnd,
      accent: hex,
      highlight: c.highlight,
      card: c.card,
      surface: c.surface,
      borderAccent: c.borderAccent,
    };

    await setCustomPalette({
      ...basePalette,
      accent: hex,
    });
  };

  const handleResetDefaults = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    await resetAppearance();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isLight ? '#FFFFFF' : '#141712',
              borderColor: c.borderAccent,
              maxWidth: isWide ? 620 : '100%',
              height: isWide ? 680 : '88%',
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="color-palette-outline" size={20} color={c.primary} />
                <Text style={[styles.title, { color: c.text }]}>Appearance & Studio</Text>
              </View>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Typography, custom atmospheres & dynamic extracted palettes
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.closeBtn, { backgroundColor: c.inputBg }]}
              accessibilityRole="button"
              accessibilityLabel="Close Studio"
            >
              <Ionicons name="close" size={18} color={c.text} />
            </TouchableOpacity>
          </View>

          {/* Studio Navigation Tabs */}
          <View style={[styles.tabsBar, { backgroundColor: c.inputBg }]}>
            {(
              [
                { id: 'typography', label: 'Typography', icon: 'text-outline' },
                { id: 'atmosphere', label: 'Atmosphere', icon: 'image-outline' },
                { id: 'colors', label: 'Palette', icon: 'sparkles-outline' },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setActiveTab(tab.id);
                  }}
                  style={[
                    styles.tabItem,
                    isActive && { backgroundColor: c.card, borderColor: c.primary, borderWidth: 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Studio Tab: ${tab.label}`}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={14}
                    color={isActive ? c.primary : c.textMuted}
                  />
                  <Text
                    style={[
                      styles.tabItemText,
                      { color: isActive ? c.text : c.textMuted, fontWeight: isActive ? '700' : '500' },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tab Content */}
          <ThemedScrollView
            style={styles.scrollArea}
            containerStyle={{ flex: 1, width: '100%' }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. TYPOGRAPHY TAB */}
            {activeTab === 'typography' && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionHeading, { color: c.text }]}>Font Family Selection</Text>
                <Text style={[styles.sectionDescription, { color: c.textMuted }]}>
                  Choose the typographic personality that fits your financial workflow:
                </Text>

                <View style={styles.fontCardsList}>
                  {(
                    [
                      {
                        id: 'grotesk',
                        name: 'Modern Grotesk',
                        sub: 'Hanken Grotesk · Clean, crisp, high-density sans-serif',
                        sample: '₹142,850.00 · Portfolio Growth +14.2%',
                        fontFamily: 'HankenGrotesk_600SemiBold',
                      },
                      {
                        id: 'fraunces',
                        name: 'Editorial Serif',
                        sub: 'Fraunces · High-contrast luxury boutique editorial',
                        sample: '₹142,850.00 · Sovereign Wealth Reserve',
                        fontFamily: 'Fraunces_600SemiBold',
                      },
                      {
                        id: 'mono',
                        name: 'Financial Monospace',
                        sub: 'IBM Plex Mono · Columnar accounting & tabular digits',
                        sample: '₹142,850.00 · TX_94821 [RECONCILED]',
                        fontFamily: 'IBMPlexMono_600SemiBold',
                      },
                      {
                        id: 'system',
                        name: 'System Default',
                        sub: 'Platform Standard · Native iOS SF Pro / Android Roboto',
                        sample: '₹142,850.00 · Lightning native performance',
                        fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
                      },
                    ] as const
                  ).map((f) => {
                    const isSelected = fontChoice === f.id;
                    return (
                      <TouchableOpacity
                        key={f.id}
                        activeOpacity={0.8}
                        onPress={() => handleSelectFont(f.id)}
                        style={[
                          styles.fontCard,
                          {
                            backgroundColor: c.card,
                            borderColor: isSelected ? c.primary : c.border,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Font: ${f.name}`}
                      >
                        <View style={styles.fontCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fontCardTitle, { color: c.text }]}>{f.name}</Text>
                            <Text style={[styles.fontCardSub, { color: c.textMuted }]}>{f.sub}</Text>
                          </View>
                          {isSelected && (
                            <View style={[styles.checkBadge, { backgroundColor: c.primary }]}>
                              <Ionicons name="checkmark" size={14} color={isLight ? '#FFF' : '#10120E'} />
                            </View>
                          )}
                        </View>
                        <View style={[styles.sampleBox, { backgroundColor: c.inputBg }]}>
                          <Text
                            style={[
                              styles.sampleText,
                              { color: c.text, fontFamily: f.fontFamily as any },
                            ]}
                          >
                            {f.sample}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Outsourced Custom Font Import */}
                <Text style={[styles.subSectionTitle, { color: c.textMuted, marginTop: 18 }]}>
                  OUTSOURCED / CUSTOM FONT IMPORT (.TTF / .OTF)
                </Text>
                <View style={[styles.customBgCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <Text style={[styles.fontCardSub, { color: c.textMuted }]}>
                    Exported fonts from Google Fonts, Adobe, or your design agency can be imported directly into the mobile app runtime.
                  </Text>

                  {customFontFamily && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleSelectFont('custom')}
                      style={[
                        styles.fontCard,
                        {
                          backgroundColor: c.inputBg,
                          borderColor: fontChoice === 'custom' ? c.primary : c.border,
                          borderWidth: fontChoice === 'custom' ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={styles.fontCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fontCardTitle, { color: c.text }]}>
                            {customFontFamily.replace('UserCustom_', '')} (Imported)
                          </Text>
                          <Text style={[styles.fontCardSub, { color: c.textMuted }]}>
                            Active outsourced font family loaded into memory
                          </Text>
                        </View>
                        {fontChoice === 'custom' && (
                          <View style={[styles.checkBadge, { backgroundColor: c.primary }]}>
                            <Ionicons name="checkmark" size={14} color={isLight ? '#FFF' : '#10120E'} />
                          </View>
                        )}
                      </View>
                      <View style={[styles.sampleBox, { backgroundColor: c.card }]}>
                        <Text style={[styles.sampleText, { color: c.text, fontFamily: customFontFamily as any }]}>
                          ₹142,850.00 · Custom outsourced font rendered live
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleImportCustomFont}
                    disabled={isFontLoading}
                    style={[styles.uploadButton, { backgroundColor: c.primary }]}
                    accessibilityRole="button"
                    accessibilityLabel="Import Custom Font File from Device"
                  >
                    {isFontLoading ? (
                      <ActivityIndicator size="small" color={isLight ? '#FFF' : '#10120E'} />
                    ) : (
                      <Ionicons name="folder-open-outline" size={16} color={isLight ? '#FFF' : '#10120E'} />
                    )}
                    <Text style={[styles.uploadButtonText, { color: isLight ? '#FFF' : '#10120E' }]}>
                      {isFontLoading ? 'Loading Font...' : 'Import Font File from Device (.ttf / .otf)'}
                    </Text>
                  </TouchableOpacity>

                  {fontStatusMsg && (
                    <Text style={[styles.successBanner, { color: fontStatusMsg.includes('Failed') || fontStatusMsg.includes('valid') ? c.accent : c.success }]}>
                      {fontStatusMsg}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* 2. ATMOSPHERE TAB */}
            {activeTab === 'atmosphere' && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionHeading, { color: c.text }]}>Atmospheric Wallpaper & Presets</Text>
                <Text style={[styles.sectionDescription, { color: c.textMuted }]}>
                  Select from crafted ambient presets or upload a custom image/GIF wallpaper:
                </Text>

                {/* Preset Themes Carousel */}
                <Text style={[styles.subSectionTitle, { color: c.textMuted }]}>CURATED PRESETS</Text>
                <View style={styles.presetsGrid}>
                  {PRESET_BACKGROUNDS.map((preset) => {
                    const isSelected =
                      backgroundAsset.type === 'preset' &&
                      (backgroundAsset.presetId === preset.id ||
                        (!backgroundAsset.presetId && preset.id === 'default'));

                    return (
                      <TouchableOpacity
                        key={preset.id}
                        activeOpacity={0.8}
                        onPress={() => handleSelectPreset(preset)}
                        style={[
                          styles.presetCard,
                          {
                            backgroundColor: c.card,
                            borderColor: isSelected ? c.primary : c.border,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Preset: ${preset.name}`}
                      >
                        <View
                          style={[
                            styles.presetThumb,
                            { backgroundColor: preset.previewBg },
                          ]}
                        >
                          <View
                            style={[
                              styles.thumbOrb,
                              { backgroundColor: preset.previewPrimary + '80', left: 4, top: 4 },
                            ]}
                          />
                          <View
                            style={[
                              styles.thumbOrb,
                              { backgroundColor: preset.previewAccent + '80', right: 4, bottom: 4 },
                            ]}
                          />
                          {isSelected && (
                            <View style={[styles.checkCircle, { backgroundColor: c.primary }]}>
                              <Ionicons name="checkmark" size={12} color={isLight ? '#FFF' : '#10120E'} />
                            </View>
                          )}
                        </View>
                        <Text style={[styles.presetName, { color: c.text }]} numberOfLines={1}>
                          {preset.name}
                        </Text>
                        <Text style={[styles.presetSub, { color: c.textMuted }]} numberOfLines={1}>
                          {preset.subtitle}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Wallpaper Section */}
                <Text style={[styles.subSectionTitle, { color: c.textMuted, marginTop: 18 }]}>
                  CUSTOM WALLPAPER / GIF ASSET
                </Text>

                <View style={[styles.customBgCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  {backgroundAsset.type === 'custom' && backgroundAsset.uri && (
                    <View style={styles.previewContainer}>
                      <Image
                        source={{ uri: backgroundAsset.uri }}
                        style={styles.previewImage}
                        resizeMode="cover"
                      />
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: isLight ? '#FFFFFF' : '#000000',
                            opacity: backgroundAsset.overlayOpacity ?? 0.35,
                          },
                        ]}
                      />
                      <View style={styles.previewBadge}>
                        <Ionicons name="image" size={12} color="#FFF" />
                        <Text style={styles.previewBadgeText}>Active Wallpaper</Text>
                      </View>
                    </View>
                  )}

                  <View style={{ gap: 10 }}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handlePickLocalImage}
                      style={[styles.uploadButton, { backgroundColor: c.primary }]}
                      accessibilityRole="button"
                      accessibilityLabel="Pick Wallpaper from Device"
                    >
                      <Ionicons name="cloud-upload-outline" size={16} color={isLight ? '#FFF' : '#10120E'} />
                      <Text style={[styles.uploadButtonText, { color: isLight ? '#FFF' : '#10120E' }]}>
                        Pick Image / Wallpaper from Device
                      </Text>
                    </TouchableOpacity>

                    {/* Direct Image/GIF URL Input */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TextInput
                        value={customUrl}
                        onChangeText={setCustomUrl}
                        placeholder="Or enter image / GIF URL..."
                        placeholderTextColor={c.textMuted}
                        style={[
                          styles.urlInput,
                          { backgroundColor: c.inputBg, color: c.text, borderColor: c.inputBorder },
                        ]}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        onPress={handleApplyCustomUrl}
                        disabled={!customUrl.trim()}
                        style={[
                          styles.applyUrlBtn,
                          { backgroundColor: customUrl.trim() ? c.cardHover : c.inputBg },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Apply URL"
                      >
                        <Ionicons name="arrow-forward" size={16} color={customUrl.trim() ? c.primary : c.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Overlay Dimming Level */}
                    <Text style={[styles.dimmerLabel, { color: c.textMuted }]}>
                      WALLPAPER OVERLAY OPACITY
                    </Text>
                    <View style={styles.dimmerRow}>
                      {[0.15, 0.3, 0.45, 0.6, 0.75].map((val) => {
                        const isCurrent = Math.abs((backgroundAsset.overlayOpacity ?? 0.35) - val) < 0.08;
                        return (
                          <TouchableOpacity
                            key={val}
                            onPress={() => handleSetOverlayOpacity(val)}
                            style={[
                              styles.dimmerChip,
                              {
                                backgroundColor: isCurrent ? c.primary : c.inputBg,
                                borderColor: isCurrent ? c.primary : c.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.dimmerChipText,
                                { color: isCurrent ? (isLight ? '#FFF' : '#10120E') : c.text },
                              ]}
                            >
                              {Math.round(val * 100)}%
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {backgroundAsset.uri && (
                      <TouchableOpacity
                        onPress={() => handleExtractFromUri(backgroundAsset.uri!)}
                        disabled={isExtracting}
                        style={[
                          styles.extractActionBtn,
                          { backgroundColor: isLight ? '#F1F5F9' : '#1D2117', borderColor: c.primary },
                        ]}
                      >
                        {isExtracting ? (
                          <ActivityIndicator size="small" color={c.primary} />
                        ) : (
                          <Ionicons name="color-wand-outline" size={16} color={c.primary} />
                        )}
                        <Text style={[styles.extractActionText, { color: c.primary }]}>
                          {isExtracting ? 'Extracting Vibrant Palette...' : 'Re-Extract Colors from Wallpaper'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {extractSuccess && (
                      <Text style={[styles.successBanner, { color: c.success }]}>
                        {extractSuccess}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* 3. ELEMENT COLORS TAB */}
            {activeTab === 'colors' && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionHeading, { color: c.text }]}>Element Colors & Palette</Text>
                <Text style={[styles.sectionDescription, { color: c.textMuted }]}>
                  Harmonized element colors extracted from the background and active theme:
                </Text>

                {/* Swatches Grid (Tap to Select Target & Inspect) */}
                <View style={styles.swatchesCard}>
                  {[
                    { label: 'Primary Brand', hex: c.primary, role: 'Buttons, totals, active navigation', targetKey: 'primary' as const },
                    { label: 'Primary Gradient', hex: c.primaryGradientEnd, role: 'Shaded surfaces & card gradients', targetKey: 'primary' as const },
                    { label: 'Dynamic Accent', hex: c.accent, role: 'Outflows, warnings, negative cash flow', targetKey: 'accent' as const },
                    { label: 'Highlight Glow', hex: c.highlight, role: 'Tags, streaks, ambient aura orbs', targetKey: 'highlight' as const },
                  ].map((swatch, idx) => {
                    const isTarget = colorTarget === swatch.targetKey;
                    return (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.8}
                        onPress={() => {
                          setColorTarget(swatch.targetKey);
                          setCustomHexInput(swatch.hex);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }}
                        style={[
                          styles.swatchRow,
                          {
                            backgroundColor: c.card,
                            borderColor: isTarget ? c.primary : c.border,
                            borderWidth: isTarget ? 1.5 : 1,
                          },
                        ]}
                      >
                        <View style={[styles.swatchColorBox, { backgroundColor: swatch.hex }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.swatchTitle, { color: c.text }]}>{swatch.label}</Text>
                          <Text style={[styles.swatchRole, { color: c.textMuted }]}>{swatch.role}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <Text style={[styles.swatchHex, { color: isTarget ? c.primary : c.textMuted }]}>
                            {swatch.hex.toUpperCase()}
                          </Text>
                          {isTarget && (
                            <Text style={{ fontSize: 9, fontWeight: '800', color: c.primary }}>SELECTED TARGET</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ── CUSTOM COLOR PICKER & HEX INPUT ── */}
                <Text style={[styles.subSectionTitle, { color: c.textMuted, marginTop: 18 }]}>
                  CUSTOM COLOR PICKER & HEX INPUT
                </Text>
                <View style={[styles.customBgCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  {/* Target Selector Chips */}
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(
                      [
                        { id: 'primary', label: 'Primary Brand' },
                        { id: 'accent', label: 'Outflow Accent' },
                        { id: 'highlight', label: 'Highlight Glow' },
                      ] as const
                    ).map((t) => {
                      const isSelected = colorTarget === t.id;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          onPress={() => {
                            setColorTarget(t.id);
                            if (t.id === 'primary') setCustomHexInput(c.primary);
                            else if (t.id === 'accent') setCustomHexInput(c.accent);
                            else setCustomHexInput(c.highlight);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          }}
                          style={[
                            styles.dimmerChip,
                            {
                              backgroundColor: isSelected ? c.primary : c.inputBg,
                              borderColor: isSelected ? c.primary : c.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dimmerChipText,
                              { color: isSelected ? (isLight ? '#FFF' : '#10120E') : c.textMuted },
                            ]}
                          >
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Hex Input & Live Color Preview */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={[
                        styles.colorPreviewOrb,
                        { backgroundColor: customHexInput.startsWith('#') && customHexInput.length === 7 ? customHexInput : c.primary },
                      ]}
                    />
                    <TextInput
                      value={customHexInput}
                      onChangeText={(val) => setCustomHexInput(val.toUpperCase())}
                      placeholder="#C79A3E"
                      placeholderTextColor={c.textMuted}
                      maxLength={7}
                      style={[
                        styles.urlInput,
                        { backgroundColor: c.inputBg, color: c.text, borderColor: c.inputBorder, fontFamily: 'IBMPlexMono_600SemiBold' as any },
                      ]}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={() => handleApplyCustomHex()}
                      style={[styles.applyHexBtn, { backgroundColor: c.primary }]}
                      accessibilityRole="button"
                      accessibilityLabel="Apply Hex Color"
                    >
                      <Ionicons name="checkmark" size={16} color={isLight ? '#FFF' : '#10120E'} />
                      <Text style={[styles.applyHexBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>Apply</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 24-Color Luxury Palette Grid */}
                  <Text style={[styles.dimmerLabel, { color: c.textMuted, marginTop: 4 }]}>
                    OR TAP TO APPLY LUXURY PALETTE SWATCH
                  </Text>
                  <View style={styles.quickColorsRow}>
                    {CategoryPalette.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          setCustomHexInput(item.color);
                          handleApplyCustomHex(item.color);
                        }}
                        style={[
                          styles.quickColorDot,
                          { backgroundColor: item.color },
                          customHexInput.toLowerCase() === item.color.toLowerCase() && {
                            borderColor: isLight ? '#0F172A' : '#FFFFFF',
                            borderWidth: 2.5,
                            transform: [{ scale: 1.15 }],
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Apply color swatch ${idx + 1}`}
                      />
                    ))}
                  </View>

                  {extractSuccess && (
                    <Text style={[styles.successBanner, { color: extractSuccess.includes('Invalid') ? c.accent : c.success }]}>
                      {extractSuccess}
                    </Text>
                  )}
                </View>

                {/* Appearance Theme Toggle Card */}
                <View style={[styles.themeToggleCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fontCardTitle, { color: c.text }]}>
                      {isLight ? 'Light Theme Active' : 'Dark Theme Active'}
                    </Text>
                    <Text style={[styles.fontCardSub, { color: c.textMuted }]}>
                      Switch between day clarity and midnight luxury
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={toggleTheme}
                    style={[styles.themeSwitchBtn, { backgroundColor: c.inputBg }]}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle Day/Night Theme"
                  >
                    <Ionicons
                      name={isLight ? 'moon-outline' : 'sunny-outline'}
                      size={18}
                      color={c.primary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ThemedScrollView>

          {/* Footer Actions */}
          <View style={[styles.footerRow, { borderTopColor: c.border }]}>
            <TouchableOpacity
              onPress={handleResetDefaults}
              style={[styles.resetButton, { backgroundColor: c.inputBg }]}
              accessibilityRole="button"
              accessibilityLabel="Reset Appearance to Default"
            >
              <Ionicons name="refresh-outline" size={15} color={c.textMuted} />
              <Text style={[styles.resetButtonText, { color: c.textMuted }]}>Reset Defaults</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.doneButton, { backgroundColor: c.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={[styles.doneButtonText, { color: isLight ? '#FFF' : '#10120E' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    height: '88%',
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsBar: {
    flexDirection: 'row',
    padding: 6,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabItemText: {
    fontSize: 12,
  },
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    flexGrow: 1,
  },
  sectionWrap: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  fontCardsList: {
    gap: 10,
  },
  fontCard: {
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  fontCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fontCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  fontCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sampleText: {
    fontSize: 13,
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCard: {
    width: '48%',
    padding: 10,
    borderRadius: 14,
    gap: 4,
  },
  presetThumb: {
    height: 60,
    borderRadius: 10,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 4,
  },
  thumbOrb: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  checkCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetName: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  presetSub: {
    fontSize: 10,
  },
  customBgCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  previewContainer: {
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 4,
  },
  previewImage: {
    ...StyleSheet.absoluteFill,
  },
  previewBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  previewBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  urlInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 12,
  },
  applyUrlBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyHexBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  applyHexBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  colorPreviewOrb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  dimmerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  dimmerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dimmerChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  dimmerChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  extractActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  extractActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  successBanner: {
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  swatchesCard: {
    gap: 8,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  swatchColorBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  swatchTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  swatchRole: {
    fontSize: 10.5,
  },
  swatchHex: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  quickColorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 4,
  },
  quickColorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  themeToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
  },
  themeSwitchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  doneButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
