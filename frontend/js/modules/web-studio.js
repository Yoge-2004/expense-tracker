/**
 * @file web-studio.js
 * @description Dynamic Theme Studio & Appearance Engine for Web:
 * - Real-time typography switching & outsourced font file upload (.ttf / .otf / .woff2) via FontFace API
 * - Interactive Custom Hex Color Picker, target selector (Primary / Accent / Highlight), and 24-color palette
 * - Wallpaper & atmosphere controls with opacity and blur
 * - Zero-flicker immediate CSS variable injection
 * - Bidirectional cross-device Cloud Synchronization with Spring Boot backend
 */

(function () {
    'use strict';

    // ─── 1. PRESETS & SWATCHES ────────────────────────────────────────────────

    const STUDIO_PRESETS = [
        {
            id: 'default',
            name: 'Imperial Gold & Onyx',
            subtitle: 'Classic signature luxury identity',
            primary: '#C79A3E',
            primaryGradientEnd: '#A97F2E',
            accent: '#A23E32',
            highlight: '#4C7A78',
            cardSurface: 'rgba(23, 26, 20, 0.88)',
            surface: '#171A14',
            borderAccent: 'rgba(199, 154, 62, 0.35)',
            paletteColors: ['#C79A3E', '#A23E32', '#4C7A78', '#5B8C5A', '#8B5E34', '#B06B5C', '#3B82F6', '#8B5CF6'],
            dark: {
                primary: '#C79A3E',
                primaryGradientEnd: '#A97F2E',
                accent: '#A23E32',
                highlight: '#4C7A78',
                cardSurface: 'rgba(23, 26, 20, 0.88)',
                surface: '#171A14',
                borderAccent: 'rgba(199, 154, 62, 0.35)',
                paletteColors: ['#C79A3E', '#A23E32', '#4C7A78', '#5B8C5A', '#8B5E34', '#B06B5C', '#3B82F6', '#8B5CF6'],
            },
            light: {
                primary: '#D4AF37',
                primaryGradientEnd: '#B38F22',
                accent: '#E74C3C',
                highlight: '#0EA5E9',
                cardSurface: '#FFFFFF',
                surface: '#F8F9FA',
                borderAccent: 'rgba(212, 175, 55, 0.45)',
                paletteColors: ['#D4AF37', '#E74C3C', '#0EA5E9', '#10B981', '#8B5CF6', '#DB2777', '#059669', '#D97706'],
            },
        },
        {
            id: 'emerald-aurora',
            name: 'Emerald Aurora',
            subtitle: 'Prosperity and lush forest mist tones',
            primary: '#10B981',
            primaryGradientEnd: '#059669',
            accent: '#34D399',
            highlight: '#06B6D4',
            cardSurface: 'rgba(13, 26, 20, 0.90)',
            surface: '#0F2119',
            borderAccent: 'rgba(16, 185, 129, 0.35)',
            paletteColors: ['#10B981', '#34D399', '#06B6D4', '#059669', '#14B8A6', '#22C55E', '#38BDF8', '#84CC16'],
            dark: {
                primary: '#10B981',
                primaryGradientEnd: '#059669',
                accent: '#34D399',
                highlight: '#06B6D4',
                cardSurface: 'rgba(13, 26, 20, 0.90)',
                surface: '#0F2119',
                borderAccent: 'rgba(16, 185, 129, 0.35)',
                paletteColors: ['#10B981', '#34D399', '#06B6D4', '#059669', '#14B8A6', '#22C55E', '#38BDF8', '#84CC16'],
            },
            light: {
                primary: '#059669',
                primaryGradientEnd: '#047857',
                accent: '#10B981',
                highlight: '#0D9488',
                cardSurface: '#FFFFFF',
                surface: '#F0FDF4',
                borderAccent: 'rgba(5, 150, 105, 0.40)',
                paletteColors: ['#059669', '#10B981', '#0D9488', '#047857', '#06B6D4', '#15803D', '#65A30D', '#0284C7'],
            },
        },
        {
            id: 'royal-amethyst',
            name: 'Royal Sovereign',
            subtitle: 'Deep galactic amethyst & electric rose',
            primary: '#8B5CF6',
            primaryGradientEnd: '#7C3AED',
            accent: '#EC4899',
            highlight: '#A855F7',
            cardSurface: 'rgba(22, 17, 36, 0.90)',
            surface: '#1A142C',
            borderAccent: 'rgba(139, 92, 246, 0.35)',
            paletteColors: ['#8B5CF6', '#EC4899', '#A855F7', '#7C3AED', '#6366F1', '#D946EF', '#F43F5E', '#3B82F6'],
            dark: {
                primary: '#8B5CF6',
                primaryGradientEnd: '#7C3AED',
                accent: '#EC4899',
                highlight: '#A855F7',
                cardSurface: 'rgba(22, 17, 36, 0.90)',
                surface: '#1A142C',
                borderAccent: 'rgba(139, 92, 246, 0.35)',
                paletteColors: ['#8B5CF6', '#EC4899', '#A855F7', '#7C3AED', '#6366F1', '#D946EF', '#F43F5E', '#3B82F6'],
            },
            light: {
                primary: '#7C3AED',
                primaryGradientEnd: '#6D28D9',
                accent: '#DB2777',
                highlight: '#9333EA',
                cardSurface: '#FFFFFF',
                surface: '#FAF5FF',
                borderAccent: 'rgba(124, 58, 237, 0.40)',
                paletteColors: ['#7C3AED', '#DB2777', '#9333EA', '#6D28D9', '#4F46E5', '#C026D3', '#E11D48', '#2563EB'],
            },
        },
        {
            id: 'cyber-cobalt',
            name: 'Cyber Cobalt',
            subtitle: 'Precision cyan, sapphire & deep ocean',
            primary: '#38BDF8',
            primaryGradientEnd: '#0284C7',
            accent: '#6366F1',
            highlight: '#06B6D4',
            cardSurface: 'rgba(14, 23, 40, 0.90)',
            surface: '#111B30',
            borderAccent: 'rgba(56, 189, 248, 0.35)',
            paletteColors: ['#38BDF8', '#6366F1', '#06B6D4', '#0284C7', '#818CF8', '#0EA5E9', '#A855F7', '#2DD4BF'],
            dark: {
                primary: '#38BDF8',
                primaryGradientEnd: '#0284C7',
                accent: '#6366F1',
                highlight: '#06B6D4',
                cardSurface: 'rgba(14, 23, 40, 0.90)',
                surface: '#111B30',
                borderAccent: 'rgba(56, 189, 248, 0.35)',
                paletteColors: ['#38BDF8', '#6366F1', '#06B6D4', '#0284C7', '#818CF8', '#0EA5E9', '#A855F7', '#2DD4BF'],
            },
            light: {
                primary: '#0284C7',
                primaryGradientEnd: '#0369A1',
                accent: '#4F46E5',
                highlight: '#0891B2',
                cardSurface: '#FFFFFF',
                surface: '#F0F9FF',
                borderAccent: 'rgba(2, 132, 199, 0.40)',
                paletteColors: ['#0284C7', '#4F46E5', '#0891B2', '#0369A1', '#6366F1', '#0284C7', '#7C3AED', '#0D9488'],
            },
        },
        {
            id: 'sunset-amber',
            name: 'Sunset Velvet',
            subtitle: 'Warm terracotta, bright amber & crimson',
            primary: '#F59E0B',
            primaryGradientEnd: '#D97706',
            accent: '#EF4444',
            highlight: '#FB923C',
            cardSurface: 'rgba(28, 18, 12, 0.90)',
            surface: '#241710',
            borderAccent: 'rgba(245, 158, 11, 0.35)',
            paletteColors: ['#F59E0B', '#EF4444', '#FB923C', '#D97706', '#F43F5E', '#EA580C', '#EAB308', '#B45309'],
            dark: {
                primary: '#F59E0B',
                primaryGradientEnd: '#D97706',
                accent: '#EF4444',
                highlight: '#FB923C',
                cardSurface: 'rgba(28, 18, 12, 0.90)',
                surface: '#241710',
                borderAccent: 'rgba(245, 158, 11, 0.35)',
                paletteColors: ['#F59E0B', '#EF4444', '#FB923C', '#D97706', '#F43F5E', '#EA580C', '#EAB308', '#B45309'],
            },
            light: {
                primary: '#D97706',
                primaryGradientEnd: '#B45309',
                accent: '#DC2626',
                highlight: '#EA580C',
                cardSurface: '#FFFFFF',
                surface: '#FFF7ED',
                borderAccent: 'rgba(217, 119, 6, 0.40)',
                paletteColors: ['#D97706', '#DC2626', '#EA580C', '#B45309', '#E11D48', '#C2410C', '#CA8A04', '#9A3412'],
            },
        },
        {
            id: 'golden-champagne',
            name: 'Gilded Champagne',
            subtitle: 'Radiant sparkling gold & warm silk',
            primary: '#FBBF24',
            primaryGradientEnd: '#EAB308',
            accent: '#F43F5E',
            highlight: '#F59E0B',
            cardSurface: 'rgba(27, 23, 14, 0.90)',
            surface: '#221D12',
            borderAccent: 'rgba(251, 191, 36, 0.35)',
            paletteColors: ['#FBBF24', '#F43F5E', '#F59E0B', '#EAB308', '#FB7185', '#F97316', '#FCD34D', '#D97706'],
            dark: {
                primary: '#FBBF24',
                primaryGradientEnd: '#EAB308',
                accent: '#F43F5E',
                highlight: '#F59E0B',
                cardSurface: 'rgba(27, 23, 14, 0.90)',
                surface: '#221D12',
                borderAccent: 'rgba(251, 191, 36, 0.35)',
                paletteColors: ['#FBBF24', '#F43F5E', '#F59E0B', '#EAB308', '#FB7185', '#F97316', '#FCD34D', '#D97706'],
            },
            light: {
                primary: '#CA8A04',
                primaryGradientEnd: '#A16207',
                accent: '#E11D48',
                highlight: '#D97706',
                cardSurface: '#FFFFFF',
                surface: '#FEFCE8',
                borderAccent: 'rgba(202, 138, 4, 0.40)',
                paletteColors: ['#CA8A04', '#E11D48', '#D97706', '#A16207', '#F43F5E', '#EA580C', '#EAB308', '#B45309'],
            },
        },
    ];

    const LUXURY_SWATCHES = [
        '#C79A3E', '#D4AF37', '#F59E0B', '#EAB308',
        '#10B981', '#059669', '#14B8A6', '#06B6D4',
        '#38BDF8', '#0284C7', '#6366F1', '#8B5CF6',
        '#A855F7', '#EC4899', '#F43F5E', '#EF4444',
        '#DC2626', '#B45309', '#78350F', '#94A3B8',
        '#64748B', '#475569', '#1E293B', '#F8F9FA'
    ];

    const FONT_PRESETS = {
        grotesk: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fraunces: "'Fraunces', Georgia, serif",
        mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    };

    // ─── 2. UTILITY FUNCTIONS ────────────────────────────────────────────────

    function hexToRgb(hex) {
        if (!hex) return { r: 16, g: 24, b: 20 };
        const rgbaMatch = String(hex).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1], 10),
                g: parseInt(rgbaMatch[2], 10),
                b: parseInt(rgbaMatch[3], 10)
            };
        }
        const clean = String(hex).replace('#', '').trim();
        if (clean.length === 3) {
            return {
                r: parseInt(clean[0] + clean[0], 16) || 0,
                g: parseInt(clean[1] + clean[1], 16) || 0,
                b: parseInt(clean[2] + clean[2], 16) || 0,
            };
        }
        return {
            r: parseInt(clean.substring(0, 2), 16) || 0,
            g: parseInt(clean.substring(2, 4), 16) || 0,
            b: parseInt(clean.substring(4, 6), 16) || 0,
        };
    }

    function adjustBrightness(color, factor) {
        const { r, g, b } = hexToRgb(color);
        const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
        const alphaMatch = String(color || '').match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/i);
        if (alphaMatch) {
            return `rgba(${clamp(r * factor)}, ${clamp(g * factor)}, ${clamp(b * factor)}, ${alphaMatch[1]})`;
        }
        return '#' + [clamp(r * factor), clamp(g * factor), clamp(b * factor)]
            .map(x => x.toString(16).padStart(2, '0')).join('');
    }


    function isValidHex(hex) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
    }

    function colorChannels(color) {
        if (isValidHex(color)) return Object.values(hexToRgb(color));
        const rgb = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        return rgb ? rgb.slice(1, 4).map(Number) : [23, 26, 20];
    }

    function colorLuminance(color) {
        return colorChannels(color).map(value => {
            const c = value / 255;
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    }

    function contrastRatio(a, b) {
        const l1 = colorLuminance(a), l2 = colorLuminance(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    function ensureContrast(color, background, ratio = 4.5) {
        if (contrastRatio(color, background) >= ratio) return color;
        const target = colorLuminance(background) < 0.45 ? 255 : 0;
        const channels = colorChannels(color);
        for (let amount = 0.05; amount <= 1; amount += 0.05) {
            const candidate = '#' + channels.map(value => Math.round(value + (target - value) * amount).toString(16).padStart(2, '0')).join('');
            if (contrastRatio(candidate, background) >= ratio) return candidate;
        }
        return colorLuminance(background) < 0.45 ? '#FFFFFF' : '#0F172A';
    }

    function readableTextAcross(...backgrounds) {
        const worstContrast = (foreground) => Math.min(...backgrounds.map(background => contrastRatio(foreground, background)));
        return worstContrast('#FFFFFF') >= worstContrast('#0F172A') ? '#FFFFFF' : '#0F172A';
    }

    function mixSurface(base, requested, amount = 0.18) {
        const a = colorChannels(base), b = colorChannels(requested);
        return '#' + a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, '0')).join('');
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60;
        }
        return { h: (h + 360) % 360, s, l };
    }

    function hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        let r1 = 0, g1 = 0, b1 = 0;
        if (h >= 0 && h < 60) { r1 = c; g1 = x; b1 = 0; }
        else if (h >= 60 && h < 120) { r1 = x; g1 = c; b1 = 0; }
        else if (h >= 120 && h < 180) { r1 = 0; g1 = c; b1 = x; }
        else if (h >= 180 && h < 240) { r1 = 0; g1 = x; b1 = c; }
        else if (h >= 240 && h < 300) { r1 = x; g1 = 0; b1 = c; }
        else { r1 = c; g1 = 0; b1 = x; }
        return {
            r: Math.round((r1 + m) * 255),
            g: Math.round((g1 + m) * 255),
            b: Math.round((b1 + m) * 255)
        };
    }

    function hslToHex(h, s, l) {
        const { r, g, b } = hslToRgb(h, s, l);
        return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
    }

    function hueDistance(h1, h2) {
        const diff = Math.abs(h1 - h2) % 360;
        return diff > 180 ? 360 - diff : diff;
    }

    function sameColor(a, b) {
        return String(a || '').replace(/\s+/g, '').toLowerCase() === String(b || '').replace(/\s+/g, '').toLowerCase();
    }

    // ─── 3. STATE ─────────────────────────────────────────────────────────────

    const DEFAULT_PALETTE = { primary: '#C79A3E', end: '#A97F2E', accent: '#A23E32', highlight: '#4C7A78' };
    const DEFAULT_CARD_SURFACES = ['#171a14', 'rgba(23, 26, 20, 0.88)'];
    const DEFAULT_APP_SURFACES = ['#10120e', '#171a14'];
    const paletteVarNames = new Set();

    function setPaletteVar(name, value) {
        paletteVarNames.add(name);
        document.documentElement.style.setProperty(name, value);
    }

    function clearPaletteVars() {
        const root = document.documentElement;
        paletteVarNames.forEach(name => root.style.removeProperty(name));
        paletteVarNames.clear();
        for (let i = 1; i <= 8; i++) {
            root.style.removeProperty('--palette-' + i);
            root.style.removeProperty('--palette-' + i + '-rgb');
            root.style.removeProperty('--palette-' + i + '-glow');
        }
    }

    /** True while nothing has been changed from the shipped look, so the stylesheet should rule. */
    function isDefaultPalette() {
        return (currentPresetId === 'default' || !currentPresetId)
            && currentWallpaperType === 'preset'
            && sameColor(currentPrimary, DEFAULT_PALETTE.primary)
            && sameColor(currentPrimaryEnd, DEFAULT_PALETTE.end)
            && sameColor(currentAccent, DEFAULT_PALETTE.accent)
            && sameColor(currentHighlight, DEFAULT_PALETTE.highlight)
            && (!currentCardSurface || DEFAULT_CARD_SURFACES.some(v => sameColor(currentCardSurface, v)))
            && (!currentAppSurface || DEFAULT_APP_SURFACES.some(v => sameColor(currentAppSurface, v)));
    }

    let isCustomApplied = localStorage.getItem('app_custom_applied') === 'true' || (localStorage.getItem('app_custom_applied') !== 'false' && Boolean(localStorage.getItem('app_custom_palette')));

    function autoSaveCurrentState() {
        localStorage.setItem('app_font_choice', currentFontChoice);
        if (currentCustomFontFamily) localStorage.setItem('app_custom_font_family', currentCustomFontFamily);
        if (currentCustomFontData) localStorage.setItem('app_custom_font_data', currentCustomFontData);
        localStorage.setItem('app_custom_palette', JSON.stringify({
            primary: currentPrimary,
            primaryGradientEnd: currentPrimaryEnd,
            accent: currentAccent,
            highlight: currentHighlight,
            cardSurface: currentCardSurface,
            surface: currentAppSurface,
            paletteColors: currentExtractedPalette,
            presetId: currentPresetId,
        }));
        localStorage.setItem('app_bg_asset', JSON.stringify({
            type: currentWallpaperType,
            presetId: currentPresetId,
            uri: currentWallpaperUri,
            sourceUri: wallpaperSourceUri,
            overlayOpacity: currentOverlayOpacity,
            blurIntensity: currentBlurIntensity,
        }));
    }

    let currentFontChoice = localStorage.getItem('app_font_choice') || 'grotesk';
    let currentCustomFontFamily = localStorage.getItem('app_custom_font_family') || null;
    let currentCustomFontData = localStorage.getItem('app_custom_font_data') || null;
    let currentPresetId = 'default';

    let currentPrimary = DEFAULT_PALETTE.primary;
    let currentPrimaryEnd = DEFAULT_PALETTE.end;
    let currentAccent = DEFAULT_PALETTE.accent;
    let currentHighlight = DEFAULT_PALETTE.highlight;
    let currentCardSurface = '#171A14';
    let currentAppSurface = '#10120E';

    let currentWallpaperType = 'preset';
    let currentWallpaperUri = '';
    let wallpaperSourceUri = '';
    let wallpaperSourceImage = null;
    let currentOverlayOpacity = 0.35;
    let currentBlurIntensity = 0;
    let cropRect = { x: 0, y: 0, width: 1, height: 1 };
    let currentExtractedPalette = [];
    let savedProfiles = [];
    try { savedProfiles = JSON.parse(localStorage.getItem('app_theme_profiles') || '[]'); } catch { savedProfiles = []; }

    let activeColorTarget = 'primary';
    let syncUiControls = () => {};

    function loadImage(uri) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            if (/^https?:/i.test(uri)) img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image could not be loaded. Check the URL and access permissions.'));
            img.src = uri;
        });
    }

    function applyCustomTheme() {
        isCustomApplied = true;
        localStorage.setItem('app_custom_applied', 'true');
        autoSaveCurrentState();
        applyTypography(currentFontChoice, currentCustomFontFamily, currentCustomFontData);
        autoSaveCurrentState();
        if (isCustomApplied) {
            applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight, currentExtractedPalette);
            applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
        }
        syncUiControls();
        void saveAppearanceToCloud();
        if (typeof window.showToast === 'function') {
            window.showToast('Theme applied successfully!', 'success');
        }
    }

    function deactivateCustomTheme() {
        isCustomApplied = false;
        localStorage.setItem('app_custom_applied', 'false');
        clearPaletteVars();
        document.body?.classList.remove('has-custom-wallpaper');
        document.documentElement.style.removeProperty('--custom-wallpaper-bg');
        document.body?.style.removeProperty('background-image');
        document.body?.style.removeProperty('background-size');
        document.body?.style.removeProperty('background-position');
        document.body?.style.removeProperty('background-attachment');
        document.body?.style.removeProperty('background-repeat');
    }

    async function cropAndExtractWallpaper(uri) {
        const img = await loadImage(uri);
        wallpaperSourceImage = img;
        const sw = img.width * cropRect.width, sh = img.height * cropRect.height;
        const sx = img.width * cropRect.x, sy = img.height * cropRect.y;
        const canvas = document.createElement('canvas');
        const outputScale = Math.min(1, 1920 / sw, 1920 / sh);
        canvas.width = Math.max(1, Math.round(sw * outputScale));
        canvas.height = Math.max(1, Math.round(sh * outputScale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Image processing is unavailable in this browser.');
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const sample = document.createElement('canvas');
        sample.width = 80; sample.height = 80;
        const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
        if (!sampleCtx) throw new Error('Could not sample image colors.');
        sampleCtx.drawImage(canvas, 0, 0, sample.width, sample.height);
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const pixels = sampleCtx.getImageData(0, 0, sample.width, sample.height);

        // Multi-Hue Spectrum Clustering across 16 angular sectors in HSL space
        const HUE_SECTORS = 16;
        const sectorWidth = 360 / HUE_SECTORS;
        const hueBins = Array.from({ length: HUE_SECTORS }, () => ({
            rSum: 0, gSum: 0, bSum: 0, wSum: 0, count: 0, hSum: 0, sSum: 0, lSum: 0
        }));

        let neutralRSum = 0, neutralGSum = 0, neutralBSum = 0, neutralWSum = 0, neutralCount = 0;

        for (let i = 0; i < pixels.data.length; i += 4) {
            const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2], a = pixels.data[i + 3];
            if (a < 128) continue;

            const hsl = rgbToHsl(r, g, b);
            // Extreme luminance or near-zero saturation pixels count toward neutral base
            if (hsl.s < 0.12 || hsl.l < 0.08 || hsl.l > 0.94) {
                neutralRSum += r;
                neutralGSum += g;
                neutralBSum += b;
                neutralWSum += 1;
                neutralCount++;
                continue;
            }

            // Chromatic pixel: determine hue sector with 11.25 deg offset so sector 0 centers around pure Red (0 deg)
            const sectorIdx = Math.floor(((hsl.h + sectorWidth / 2) % 360) / sectorWidth) % HUE_SECTORS;
            // Vibrant, well-lit colors receive higher weighting for executive readability
            const vibrancyWeight = 1.0 + Math.pow(hsl.s, 1.2) * 2.5 + (1.0 - Math.abs(hsl.l - 0.5) * 1.4) * 1.5;

            const bin = hueBins[sectorIdx];
            bin.rSum += r * vibrancyWeight;
            bin.gSum += g * vibrancyWeight;
            bin.bSum += b * vibrancyWeight;
            bin.hSum += hsl.h * vibrancyWeight;
            bin.sSum += hsl.s * vibrancyWeight;
            bin.lSum += hsl.l * vibrancyWeight;
            bin.wSum += vibrancyWeight;
            bin.count++;
        }

        // Build list of valid color clusters
        const clusters = [];
        for (let idx = 0; idx < HUE_SECTORS; idx++) {
            const bin = hueBins[idx];
            if (bin.count < 3 || bin.wSum <= 0) continue;
            const avgR = Math.round(bin.rSum / bin.wSum);
            const avgG = Math.round(bin.gSum / bin.wSum);
            const avgB = Math.round(bin.bSum / bin.wSum);
            const avgHsl = rgbToHsl(avgR, avgG, avgB);
            const score = bin.wSum * Math.pow(avgHsl.s, 1.2) * (1.0 - Math.abs(avgHsl.l - 0.5) * 1.2);
            clusters.push({
                r: avgR,
                g: avgG,
                b: avgB,
                h: avgHsl.h,
                s: avgHsl.s,
                l: avgHsl.l,
                score,
                count: bin.count
            });
        }

        // Sort by prominence and vibrancy
        clusters.sort((a, b) => b.score - a.score);

        // Fallback for monochrome / black-and-white images
        const defaultHue = 42; // Imperial Gold default
        let primaryH = defaultHue, primaryS = 0.65, primaryL = 0.52;
        let primaryHex = '#C79A3E';

        if (clusters.length > 0) {
            const top = clusters[0];
            primaryH = top.h;
            primaryS = Math.min(0.92, Math.max(0.48, top.s * 1.1));
            primaryL = isLight ? Math.min(0.50, Math.max(0.38, top.l)) : Math.min(0.64, Math.max(0.48, top.l));
            primaryHex = hslToHex(primaryH, primaryS, primaryL);
        } else if (neutralCount > 0) {
            const avgLum = (neutralRSum * 299 + neutralGSum * 587 + neutralBSum * 114) / (neutralCount * 255000);
            primaryHex = avgLum > 0.5 ? '#2563EB' : '#D4AF37';
            const hsl = rgbToHsl(...Object.values(hexToRgb(primaryHex)));
            primaryH = hsl.h; primaryS = hsl.s; primaryL = hsl.l;
        }

        // Accent Selection: Guarantee distinct hue separation (at least 45 deg, ideally 60-180 deg)
        let accentHex = null;
        let accentH = (primaryH + 150) % 360;
        let bestAccentCluster = null;
        for (const cand of clusters) {
            const dist = hueDistance(cand.h, primaryH);
            if (dist >= 45) {
                bestAccentCluster = cand;
                break;
            }
        }
        if (bestAccentCluster) {
            accentH = bestAccentCluster.h;
            const accS = Math.min(0.95, Math.max(0.52, bestAccentCluster.s * 1.15));
            const accL = isLight ? Math.min(0.50, Math.max(0.36, bestAccentCluster.l)) : Math.min(0.66, Math.max(0.48, bestAccentCluster.l));
            accentHex = hslToHex(accentH, accS, accL);
        } else {
            // Synthesize harmonious complementary/triadic accent
            accentHex = hslToHex(accentH, Math.max(0.60, primaryS), isLight ? 0.44 : 0.58);
        }

        // Highlight Selection: Guarantee distinct hue separation from BOTH Primary and Accent (>= 32 deg)
        let highlightHex = null;
        let highlightH = (primaryH + 75) % 360;
        let bestHighlightCluster = null;
        for (const cand of clusters) {
            const distP = hueDistance(cand.h, primaryH);
            const distA = hueDistance(cand.h, accentH);
            if (distP >= 32 && distA >= 32) {
                bestHighlightCluster = cand;
                break;
            }
        }
        if (bestHighlightCluster) {
            highlightH = bestHighlightCluster.h;
            const hlS = Math.min(0.92, Math.max(0.48, bestHighlightCluster.s * 1.1));
            const hlL = isLight ? Math.min(0.48, Math.max(0.35, bestHighlightCluster.l)) : Math.min(0.65, Math.max(0.48, bestHighlightCluster.l));
            highlightHex = hslToHex(highlightH, hlS, hlL);
        } else {
            // Synthesize harmonious triad/tetrad highlight
            highlightHex = hslToHex(highlightH, Math.max(0.55, primaryS), isLight ? 0.45 : 0.56);
        }

        // 8-Color Spectrum Extraction (--palette-1 to --palette-8)
        // Ensure ALL 8 slots are distinct, diverse hues covering the spectrum
        const extractedHues = [primaryH, accentH, highlightH];
        const colors = [primaryHex, accentHex, highlightHex];

        for (const cand of clusters) {
            if (colors.length >= 8) break;
            const isDistinct = extractedHues.every(h => hueDistance(cand.h, h) >= 22);
            if (isDistinct) {
                extractedHues.push(cand.h);
                const tunedS = Math.min(0.92, Math.max(0.50, cand.s * 1.1));
                const tunedL = isLight ? Math.min(0.50, Math.max(0.36, cand.l)) : Math.min(0.66, Math.max(0.48, cand.l));
                colors.push(hslToHex(cand.h, tunedS, tunedL));
            }
        }

        // If fewer than 8 distinct hue clusters in the wallpaper, supplement with harmonious color wheel chords
        const wheelOffsets = [35, -35, 95, -95, 140, 210, 270, 315];
        for (const offset of wheelOffsets) {
            if (colors.length >= 8) break;
            const chordH = (primaryH + offset + 360) % 360;
            if (extractedHues.every(h => hueDistance(chordH, h) >= 20)) {
                extractedHues.push(chordH);
                colors.push(hslToHex(chordH, Math.max(0.58, primaryS), isLight ? 0.46 : 0.58));
            }
        }
        while (colors.length < 8) {
            const fallbackH = (primaryH + colors.length * 45) % 360;
            colors.push(hslToHex(fallbackH, 0.65, isLight ? 0.46 : 0.58));
        }

        currentExtractedPalette = colors;
        currentPrimary = primaryHex;
        currentPrimaryEnd = adjustBrightness(primaryHex, isLight ? 0.85 : 0.80);
        currentAccent = accentHex;
        currentHighlight = highlightHex;
        currentCardSurface = isLight
            ? hslToHex(primaryH, Math.min(0.20, Math.max(0.08, primaryS * 0.28)), 0.98)
            : hslToHex(primaryH, Math.min(0.42, Math.max(0.18, primaryS * 0.55)), 0.14);
        currentAppSurface = isLight
            ? hslToHex(primaryH, Math.min(0.25, Math.max(0.10, primaryS * 0.35)), 0.94)
            : hslToHex(primaryH, Math.min(0.40, Math.max(0.16, primaryS * 0.50)), 0.08);
        currentWallpaperType = 'custom';
        currentWallpaperUri = canvas.toDataURL('image/jpeg', 0.88);

        // Immediate persistence so the extracted palette propagates across all pages & reloads
        localStorage.setItem('app_custom_palette', JSON.stringify({
            primary: currentPrimary,
            primaryGradientEnd: currentPrimaryEnd,
            accent: currentAccent,
            highlight: currentHighlight,
            cardSurface: currentCardSurface,
            surface: currentAppSurface,
            paletteColors: currentExtractedPalette,
        }));
        localStorage.setItem('app_bg_asset', JSON.stringify({
            type: currentWallpaperType,
            presetId: currentPresetId,
            uri: currentWallpaperUri,
            sourceUri: wallpaperSourceUri,
            overlayOpacity: currentOverlayOpacity,
            blurIntensity: currentBlurIntensity,
        }));

        autoSaveCurrentState();
        if (isCustomApplied) {
            applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight, currentExtractedPalette);
            applyAtmosphere('custom', currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
        }
        syncUiControls();
    }

    function profileSnapshot(name) {
        return { id: String(Date.now()), name, fontChoice: currentFontChoice,
            customFontFamily: currentCustomFontFamily, customFontData: currentCustomFontData, primary: currentPrimary,
            primaryEnd: currentPrimaryEnd, accent: currentAccent, highlight: currentHighlight,
            cardSurface: currentCardSurface, surface: currentAppSurface,
            wallpaperType: currentWallpaperType, wallpaperUri: currentWallpaperUri,
            overlayOpacity: currentOverlayOpacity, blurIntensity: currentBlurIntensity, presetId: currentPresetId };
    }

    function applyProfile(profile) {
        currentFontChoice = profile.fontChoice || 'grotesk'; currentPrimary = profile.primary || '#C79A3E';
        currentCustomFontFamily = profile.customFontFamily || null; currentCustomFontData = profile.customFontData || null;
        currentPrimaryEnd = profile.primaryEnd || adjustBrightness(currentPrimary, 0.85);
        currentAccent = profile.accent || '#A23E32'; currentHighlight = profile.highlight || '#4C7A78';
        currentCardSurface = profile.cardSurface || '#171A14'; currentAppSurface = profile.surface || '#10120E';
        currentWallpaperType = profile.wallpaperType || 'preset'; currentWallpaperUri = profile.wallpaperUri || '';
        currentPresetId = profile.presetId || 'default';
        currentOverlayOpacity = profile.overlayOpacity ?? 0.35; currentBlurIntensity = profile.blurIntensity || 0;
        localStorage.setItem('app_font_choice', currentFontChoice);
        if (currentCustomFontFamily) localStorage.setItem('app_custom_font_family', currentCustomFontFamily);
        if (currentCustomFontData) localStorage.setItem('app_custom_font_data', currentCustomFontData);
        localStorage.setItem('app_custom_palette', JSON.stringify({ primary: currentPrimary, primaryGradientEnd: currentPrimaryEnd, accent: currentAccent, highlight: currentHighlight, cardSurface: currentCardSurface, surface: currentAppSurface }));
        localStorage.setItem('app_bg_asset', JSON.stringify({ type: currentWallpaperType, presetId: currentPresetId, uri: currentWallpaperUri, sourceUri: wallpaperSourceUri, overlayOpacity: currentOverlayOpacity, blurIntensity: currentBlurIntensity }));
        autoSaveCurrentState();
        applyCustomTheme();
    }

    // Try reading cached custom palette
    try {
        const savedPalette = localStorage.getItem('app_custom_palette');
        if (savedPalette) {
            const parsed = JSON.parse(savedPalette);
            if (parsed.presetId) {
                currentPresetId = parsed.presetId;
            } else if (parsed.primary && !sameColor(parsed.primary, DEFAULT_PALETTE.primary)) {
                currentPresetId = 'custom';
            }
            if (parsed.primary) currentPrimary = parsed.primary;
            if (parsed.primaryGradientEnd) currentPrimaryEnd = parsed.primaryGradientEnd;
            if (parsed.accent) currentAccent = parsed.accent;
            if (parsed.highlight) currentHighlight = parsed.highlight;
            if (parsed.cardSurface) currentCardSurface = parsed.cardSurface;
            if (parsed.surface) currentAppSurface = parsed.surface;
            if (Array.isArray(parsed.paletteColors) && parsed.paletteColors.length > 0) {
                currentExtractedPalette = parsed.paletteColors;
            }
        }
    } catch {}

    // Try reading cached background asset
    try {
        const savedBg = localStorage.getItem('app_bg_asset');
        if (savedBg) {
            const parsed = JSON.parse(savedBg);
            if (parsed.type) currentWallpaperType = parsed.type;
            if (parsed.presetId) {
                if (currentPresetId === 'default' || !currentPresetId) {
                    currentPresetId = parsed.presetId;
                }
            }
            if (parsed.uri) currentWallpaperUri = parsed.uri;
            if (parsed.sourceUri) wallpaperSourceUri = parsed.sourceUri;
            else if (parsed.uri && /^https?:\/\//i.test(parsed.uri)) wallpaperSourceUri = parsed.uri;
            if (typeof parsed.overlayOpacity === 'number') currentOverlayOpacity = parsed.overlayOpacity;
            if (typeof parsed.blurIntensity === 'number') currentBlurIntensity = parsed.blurIntensity;
        }
    } catch {}

    if (!sameColor(currentPrimary, DEFAULT_PALETTE.primary) && currentPresetId === 'default') {
        currentPresetId = 'custom';
    }

    // ─── 4. CSS VARIABLE APPLICATION (ZERO FLICKER) ──────────────────────────

    function applyTypography(fontChoice, customFamily, customData) {
        const root = document.documentElement;

        if (fontChoice === 'custom' && customFamily) {
            const fallbackFont = FONT_PRESETS.grotesk;
            let fontCss = fallbackFont;
            if (customData) {
                try {
                    const fontFace = new FontFace(customFamily, `url("${customData}")`);
                    fontFace.load().then(loaded => {
                        document.fonts.add(loaded);
                        root.style.setProperty('--font-sans', `"${customFamily}", sans-serif`);
                        root.style.setProperty('--font-body', `"${customFamily}", sans-serif`);
                        root.style.setProperty('--font-main', `"${customFamily}", sans-serif`);
                        root.style.setProperty('--font-display', `"${customFamily}", sans-serif`);
                    }).catch(err => {
                        console.warn('[WebStudio] FontFace load error:', err);
                    });
                } catch (e) {
                    console.warn('[WebStudio] Could not create FontFace:', e);
                }
                fontCss = `"${customFamily}", ${fallbackFont}`;
            } else if (document.fonts.check(`12px "${customFamily}"`)) {
                fontCss = `"${customFamily}", ${fallbackFont}`;
            }
            root.style.setProperty('--font-sans', fontCss);
            root.style.setProperty('--font-body', fontCss);
            root.style.setProperty('--font-main', fontCss);
            root.style.setProperty('--font-display', fontCss);
            return;
        }

        const fontCss = FONT_PRESETS[fontChoice] || FONT_PRESETS.grotesk;
        root.style.setProperty('--font-sans', fontCss);
        root.style.setProperty('--font-body', fontCss);
        root.style.setProperty('--font-main', fontCss);
        if (fontChoice === 'fraunces') {
            root.style.setProperty('--font-display', fontCss);
        } else {
            root.style.setProperty('--font-display', fontCss);
        }
    }

    // ─── Palette ownership ────────────────────────────────────────────────────
    // The palette is written as INLINE styles on <html>, which always beat the stylesheet's
    // [data-theme="light"] / [data-theme="dark"] token blocks. So the studio must only own those
    // variables while the user has actually customised the palette, and must recompute them whenever
    // the theme changes (they depend on the theme at the moment they are computed).


    function applyPalette(primaryHex, primaryEndHex, accentHex, highlightHex, paletteColors) {
        const root = document.documentElement;
        const isLight = root.getAttribute('data-theme') === 'light';
        const cardBase = isLight ? '#FFFFFF' : '#171A14';
        const surfaceBase = isLight ? '#F8F9FA' : '#10120E';

        const surfaceAmount = (requested) => {
            const isDefault = DEFAULT_CARD_SURFACES.concat(DEFAULT_APP_SURFACES).some(v => sameColor(requested, v));
            if (isDefault) return 0;
            // In light mode, if the requested surface is dark, do not contaminate light mode
            if (isLight && colorLuminance(requested) < 0.4) return 0;
            // In dark mode, if the requested surface is bright, do not contaminate dark mode
            if (!isLight && colorLuminance(requested) > 0.6) return 0;
            return isValidHex(requested) ? 0.7 : 0.18;
        };

        const safeCard = mixSurface(cardBase, currentCardSurface, surfaceAmount(currentCardSurface));
        const safeSurface = mixSurface(surfaceBase, currentAppSurface, surfaceAmount(currentAppSurface));

        const effPrimary = ensureContrast(primaryHex, safeCard);
        const onPrimary = contrastRatio('#FFFFFF', effPrimary) >= contrastRatio('#10120E', effPrimary) ? '#FFFFFF' : '#10120E';
        const effPrimaryEnd = ensureContrast(primaryEndHex || adjustBrightness(effPrimary, 0.85), safeCard);
        const effAccent = ensureContrast(accentHex || currentAccent, safeCard);
        const effHighlight = ensureContrast(highlightHex || currentHighlight, safeCard);
        const readableText = isLight ? '#0F172A' : '#ECE7D8';
        const readableMuted = isLight ? '#475569' : '#A8A395';
        const safeRgb = hexToRgb(effPrimary);
        const end = effPrimaryEnd;

        setPaletteVar('--primary', effPrimary);
        setPaletteVar('--primary-rgb', `${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}`);
        setPaletteVar('--primary-gradient', `linear-gradient(135deg, ${effPrimary} 0%, ${end} 100%)`);
        setPaletteVar('--primary-glow', `rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.22)`);
        setPaletteVar('--border-accent', `rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.55)`);
        setPaletteVar('--shadow-glow', `0 12px 35px -8px rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.3)`);
        setPaletteVar('--shadow-premium', isLight
            ? `0 20px 45px -12px rgba(15, 23, 42, 0.1), 0 0 20px rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.11)`
            : `0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 18px rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.12)`);
        if (!window.matchMedia?.('(pointer: coarse)').matches) {
            const defSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 3L20 11L12 14L9 22L4 3Z" fill="${effPrimary}" stroke="${onPrimary}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="4" cy="3" r="1.5" fill="${onPrimary}"/></svg>`;
            const pointer = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M4 3L18 10L11 13L8 20L4 3Z" fill="${effPrimary}" stroke="${onPrimary}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="11" cy="13" r="2" fill="${onPrimary}"/></svg>`;
            const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><g stroke="${effPrimary}" stroke-width="2.2" stroke-linecap="round"><line x1="14" y1="4" x2="14" y2="24"/><line x1="9" y1="4" x2="19" y2="4"/><line x1="9" y1="24" x2="19" y2="24"/></g></svg>`;
            const clicked = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M4 3L18 10L11 13L8 20L4 3Z" fill="${effAccent}" stroke="${onPrimary}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="11" cy="13" r="2" fill="${onPrimary}"/></svg>`;
            setPaletteVar('--cursor-default', `url("data:image/svg+xml,${encodeURIComponent(defSvg)}") 4 3, auto`);
            setPaletteVar('--cursor-pointer', `url("data:image/svg+xml,${encodeURIComponent(pointer)}") 4 3, pointer`);
            setPaletteVar('--cursor-text', `url("data:image/svg+xml,${encodeURIComponent(textSvg)}") 14 14, text`);
            setPaletteVar('--cursor-clicked', `url("data:image/svg+xml,${encodeURIComponent(clicked)}") 4 3, pointer`);
        }
        setPaletteVar('--card-bg', safeCard);
        setPaletteVar('--card-bg-hover', isLight ? '#F8FAFC' : adjustBrightness(safeCard, 1.15));
        setPaletteVar('--bg-dark', safeSurface);
        setPaletteVar('--input-bg', mixSurface(safeCard, safeSurface, 0.35));
        setPaletteVar('--text-main', readableText);
        setPaletteVar('--text-muted', readableMuted);
        setPaletteVar('--on-primary', onPrimary);

        // Disentangled financial semantics: Inflow = Green, Outflow = Red, Savings = Amber
        const metricInflow = ensureContrast(isLight ? '#059669' : '#10B981', safeCard);
        const metricOutflow = ensureContrast(isLight ? '#DC2626' : '#EF4444', safeCard);
        const metricSavings = ensureContrast(isLight ? '#D97706' : '#F59E0B', safeCard);
        const metricNetflow = ensureContrast(isLight ? '#2563EB' : '#3B82F6', safeCard);
        const metricSubs = ensureContrast(isLight ? '#7C3AED' : '#8B5CF6', safeCard);

        const metricColors = {
            inflow: metricInflow,
            outflow: metricOutflow,
            netflow: metricNetflow,
            savings: metricSavings,
            subs: metricSubs,
        };
        Object.entries(metricColors).forEach(([name, color]) => {
            const rgb = hexToRgb(color);
            setPaletteVar(`--metric-${name}`, color);
            setPaletteVar(`--metric-${name}-rgb`, `${rgb.r}, ${rgb.g}, ${rgb.b}`);
            setPaletteVar(`--metric-${name}-glow`, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
        });
        setPaletteVar('--metric-subs-text', metricColors.subs);
        setPaletteVar('--success', metricInflow);
        setPaletteVar('--success-rgb', `${hexToRgb(metricInflow).r}, ${hexToRgb(metricInflow).g}, ${hexToRgb(metricInflow).b}`);
        setPaletteVar('--warning', metricSavings);
        setPaletteVar('--warning-rgb', `${hexToRgb(metricSavings).r}, ${hexToRgb(metricSavings).g}, ${hexToRgb(metricSavings).b}`);
        setPaletteVar('--danger', metricOutflow);
        setPaletteVar('--danger-rgb', `${hexToRgb(metricOutflow).r}, ${hexToRgb(metricOutflow).g}, ${hexToRgb(metricOutflow).b}`);

        setPaletteVar('--fill-subtle', mixSurface(safeCard, readableText, 0.05));
        setPaletteVar('--fill-medium', mixSurface(safeCard, readableText, 0.09));
        setPaletteVar('--fill-strong', mixSurface(safeCard, readableText, 0.14));
        setPaletteVar('--fill-active', mixSurface(safeCard, readableText, 0.2));
        setPaletteVar('--inset-bg', isLight ? mixSurface(safeCard, readableText, 0.06) : mixSurface(safeCard, '#000000', 0.32));
        setPaletteVar('--line-soft', mixSurface(safeCard, readableText, 0.12));
        setPaletteVar('--on-success', readableTextAcross(metricColors.inflow, metricColors.inflow));
        setPaletteVar('--on-warning', readableTextAcross(metricColors.savings, metricColors.savings));
        setPaletteVar('--on-danger', readableTextAcross(metricColors.outflow, metricColors.outflow));

        if (accentHex) {
            const accRgb = hexToRgb(effAccent);
            setPaletteVar('--accent', effAccent);
            setPaletteVar('--accent-rgb', `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);
            setPaletteVar('--accent-glow', `rgba(${accRgb.r}, ${accRgb.g}, ${accRgb.b}, 0.25)`);
            setPaletteVar('--accent-text', effAccent);
            setPaletteVar('--accent-gradient', `linear-gradient(135deg, ${effAccent} 0%, ${adjustBrightness(effAccent, 0.82)} 100%)`);
        }

        if (highlightHex) {
            const hlRgb = hexToRgb(effHighlight);
            setPaletteVar('--highlight', effHighlight);
            setPaletteVar('--highlight-rgb', `${hlRgb.r}, ${hlRgb.g}, ${hlRgb.b}`);
            setPaletteVar('--highlight-glow', `rgba(${hlRgb.r}, ${hlRgb.g}, ${hlRgb.b}, 0.22)`);
            setPaletteVar('--highlight-gradient', `linear-gradient(135deg, ${effHighlight} 0%, ${adjustBrightness(effHighlight, 0.82)} 100%)`);
        }

        // Propagate all extracted spectrum tokens (--palette-1 to --palette-8)
        const fullPalette = Array.isArray(paletteColors) && paletteColors.length > 0
            ? paletteColors
            : (Array.isArray(currentExtractedPalette) && currentExtractedPalette.length > 0 ? currentExtractedPalette : [effPrimary, effAccent, effHighlight]);
        fullPalette.slice(0, 8).forEach((col, idx) => {
            if (isValidHex(col)) {
                const rgb = hexToRgb(col);
                setPaletteVar(`--palette-${idx + 1}`, col);
                setPaletteVar(`--palette-${idx + 1}-rgb`, `${rgb.r}, ${rgb.g}, ${rgb.b}`);
                setPaletteVar(`--palette-${idx + 1}-glow`, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20)`);
            }
        });

        // Propagate dynamic border tokens derived from theme primary
        setPaletteVar('--border', isLight
            ? `rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.24)`
            : `rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.16)`);
        setPaletteVar('--border-subtle', isLight
            ? `rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.12)`
            : `rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.08)`);

        if (isDefaultPalette()) {
            clearPaletteVars();
        }
        document.dispatchEvent(new CustomEvent('palettechange'));
    }

    function applyAtmosphere(type, uri, opacity, blur) {
        const bgs = document.querySelectorAll('.hero-bg, .auth-hero-bg');
        if (!bgs.length) return;

        const isLight = document.documentElement.getAttribute("data-theme") === "light";
        const hasWallpaper = Boolean(uri && type !== 'none' && isCustomApplied);

        if (hasWallpaper) {
            document.body?.classList.add("has-custom-wallpaper");
            document.documentElement.style.setProperty('--card-bg', isLight ? 'rgba(255, 255, 255, 0.78)' : 'rgba(23, 26, 20, 0.82)');
            document.documentElement.style.setProperty('--card-bg-hover', isLight ? 'rgba(255, 255, 255, 0.90)' : 'rgba(32, 36, 28, 0.90)');
            const tint = isLight ? "255, 255, 255" : "0, 0, 0";
            const bgRule = uri.startsWith('linear-gradient') || uri.startsWith('radial-gradient')
                ? uri
                : `linear-gradient(rgba(${tint}, ${opacity}), rgba(${tint}, ${opacity})), url("${uri}")`;
            document.documentElement.style.setProperty("--custom-wallpaper-bg", bgRule);
            document.body?.style.setProperty("background-image", bgRule, "important");
            document.body?.style.setProperty("background-size", "cover", "important");
            document.body?.style.setProperty("background-position", "center", "important");
            document.body?.style.setProperty("background-attachment", "fixed", "important");
            document.body?.style.setProperty("background-repeat", "no-repeat", "important");
        } else {
            document.body?.classList.remove("has-custom-wallpaper");
            document.documentElement.style.removeProperty("--custom-wallpaper-bg");
            document.body?.style.removeProperty("background-image");
            document.body?.style.removeProperty("background-size");
            document.body?.style.removeProperty("background-position");
            document.body?.style.removeProperty("background-attachment");
            document.body?.style.removeProperty("background-repeat");
            if (isDefaultPalette()) {
                document.documentElement.style.removeProperty('--card-bg');
                document.documentElement.style.removeProperty('--card-bg-hover');
            } else if (isLight) {
                document.documentElement.style.setProperty('--card-bg', '#FFFFFF');
                document.documentElement.style.setProperty('--card-bg-hover', '#F8FAFC');
            } else {
                const cSurf = (currentCardSurface && !DEFAULT_CARD_SURFACES.some(v => sameColor(currentCardSurface, v)))
                    ? currentCardSurface : '#171A14';
                document.documentElement.style.setProperty('--card-bg', cSurf);
                document.documentElement.style.setProperty('--card-bg-hover', adjustBrightness(cSurf, 1.15));
            }
        }

        bgs.forEach(heroBg => {
            if (type === 'none') {
                heroBg.style.backgroundImage = 'none';
                heroBg.style.filter = 'none';
            } else if (hasWallpaper) {
                const tint = isLight ? "255, 255, 255" : "0, 0, 0";
                const bgRule = uri.startsWith('linear-gradient') || uri.startsWith('radial-gradient')
                    ? uri
                    : `linear-gradient(rgba(${tint}, ${opacity}), rgba(${tint}, ${opacity})), url("${uri}")`;
                heroBg.style.setProperty("background-image", bgRule, "important");
                heroBg.style.setProperty("background-size", "cover", "important");
                heroBg.style.setProperty("background-position", "center", "important");
                heroBg.style.setProperty("background-repeat", "no-repeat", "important");
                heroBg.style.setProperty("opacity", "1", "important");
                heroBg.style.filter = blur > 0 ? `blur(${blur}px)` : "none";
            } else {
                // Preset / default ambient gradients constructed from current theme colors
                const pRgb = hexToRgb(currentPrimary);
                const aRgb = hexToRgb(currentAccent);
                const hRgb = hexToRgb(currentHighlight);
                if (isLight) {
                    heroBg.style.backgroundImage = `radial-gradient(circle at 12% 14%, rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.18) 0%, transparent 48%),
                        radial-gradient(circle at 88% 18%, rgba(${aRgb.r}, ${aRgb.g}, ${aRgb.b}, 0.12) 0%, transparent 50%),
                        radial-gradient(circle at 50% 82%, rgba(${hRgb.r}, ${hRgb.g}, ${hRgb.b}, 0.12) 0%, transparent 54%),
                        radial-gradient(circle at 78% 76%, rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.12) 0%, transparent 44%)`;
                } else {
                    heroBg.style.backgroundImage = `radial-gradient(circle at 14% 16%, rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.18) 0%, transparent 48%),
                        radial-gradient(circle at 86% 20%, rgba(${aRgb.r}, ${aRgb.g}, ${aRgb.b}, 0.14) 0%, transparent 50%),
                        radial-gradient(circle at 46% 86%, rgba(${hRgb.r}, ${hRgb.g}, ${hRgb.b}, 0.12) 0%, transparent 54%),
                        radial-gradient(circle at 80% 78%, rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.10) 0%, transparent 42%)`;
                }
                heroBg.style.backgroundSize = '';
                heroBg.style.backgroundPosition = '';
                heroBg.style.opacity = '1';
                heroBg.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
            }
        });
    }


    

    function selectPreset(presetId) {
        const preset = STUDIO_PRESETS.find(x => x.id === presetId);
        if (!preset) return;

        currentPresetId = preset.id;
        currentWallpaperType = 'preset';
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const sub = (isLight && preset.light) ? preset.light : (preset.dark || preset);
        currentPrimary = sub.primary;
        currentPrimaryEnd = sub.primaryGradientEnd;
        currentAccent = sub.accent;
        currentHighlight = sub.highlight;
        currentCardSurface = sub.cardSurface;
        currentAppSurface = sub.surface;
        currentExtractedPalette = sub.paletteColors || [currentPrimary, currentAccent, currentHighlight];

        localStorage.setItem('app_custom_palette', JSON.stringify({
            primary: currentPrimary,
            primaryGradientEnd: currentPrimaryEnd,
            accent: currentAccent,
            highlight: currentHighlight,
            cardSurface: currentCardSurface,
            surface: currentAppSurface,
            paletteColors: currentExtractedPalette,
        }));
        localStorage.setItem('app_bg_asset', JSON.stringify({
            type: 'preset',
            presetId: currentPresetId,
            overlayOpacity: currentOverlayOpacity,
            blurIntensity: currentBlurIntensity,
        }));

        applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight, currentExtractedPalette);
        applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
        syncUiControls();
    }

    // Immediate application on script load: typography is applied, but custom palette/wallpaper only if isCustomApplied
    applyTypography(currentFontChoice, currentCustomFontFamily, currentCustomFontData);
    if (isCustomApplied && !isDefaultPalette()) {
        applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight, currentExtractedPalette);
        applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
    } else {
        clearPaletteVars();
        document.body?.classList.remove("has-custom-wallpaper");
        document.documentElement.style.removeProperty("--custom-wallpaper-bg");
    }

    new MutationObserver(() => {
        if (!isCustomApplied) {
            clearPaletteVars();
            document.body?.classList.remove("has-custom-wallpaper");
            document.documentElement.style.removeProperty("--custom-wallpaper-bg");
            return;
        }
        if (currentWallpaperType === 'preset' && currentPresetId && currentPresetId !== 'default' && currentPresetId !== 'custom') {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            const preset = STUDIO_PRESETS.find(x => x.id === currentPresetId);
            if (preset) {
                const sub = (isLight && preset.light) ? preset.light : (preset.dark || preset);
                currentPrimary = sub.primary;
                currentPrimaryEnd = sub.primaryGradientEnd;
                currentAccent = sub.accent;
                currentHighlight = sub.highlight;
                currentCardSurface = sub.cardSurface;
                currentAppSurface = sub.surface;
                currentExtractedPalette = sub.paletteColors || [currentPrimary, currentAccent, currentHighlight];
            }
        }
        applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight, currentExtractedPalette);
        applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
        syncUiControls();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // ─── 5. CLOUD SYNCHRONIZATION ─────────────────────────────────────────────

    async function fetchAppearanceFromCloud(userId) {
        if (!userId || typeof window.apiRequest !== 'function') return;
        try {
            const remote = await window.apiRequest(`/users/${userId}/appearance`);
            if (!remote) return;

            let dirty = false;

            if (remote.fontChoice) {
                currentFontChoice = remote.fontChoice;
                localStorage.setItem('app_font_choice', currentFontChoice);
                dirty = true;
            }
            if (remote.customFontFamily) {
                currentCustomFontFamily = remote.customFontFamily;
                localStorage.setItem('app_custom_font_family', currentCustomFontFamily);
                dirty = true;
            }
            if (remote.customFontData) {
                currentCustomFontData = remote.customFontData;
                localStorage.setItem('app_custom_font_data', currentCustomFontData);
                dirty = true;
            }
            if (remote.primaryColor) {
                currentPrimary = remote.primaryColor;
                currentPrimaryEnd = remote.primaryGradientEnd || adjustBrightness(currentPrimary, 0.85);
                currentAccent = remote.accentColor || currentAccent;
                currentHighlight = remote.highlightColor || currentHighlight;
                currentCardSurface = remote.cardSurface || currentCardSurface;
                currentAppSurface = remote.surface || currentAppSurface;
                currentPresetId = remote.presetId || currentPresetId;
                localStorage.setItem('app_custom_palette', JSON.stringify({
                    primary: currentPrimary,
                    primaryGradientEnd: currentPrimaryEnd,
                    accent: currentAccent,
                    highlight: currentHighlight,
                    cardSurface: currentCardSurface,
                    surface: currentAppSurface
                }));
                dirty = true;
            }
            if (remote.wallpaperType) {
                currentWallpaperType = remote.wallpaperType;
                currentWallpaperUri = remote.wallpaperUri || '';
                currentOverlayOpacity = remote.overlayOpacity != null ? remote.overlayOpacity : 0.35;
                currentBlurIntensity = remote.blurIntensity != null ? remote.blurIntensity : 0;
                localStorage.setItem('app_bg_asset', JSON.stringify({
                    type: currentWallpaperType,
                    presetId: currentPresetId,
                    uri: currentWallpaperUri,
                    overlayOpacity: currentOverlayOpacity,
                    blurIntensity: currentBlurIntensity
                }));
                dirty = true;
            }

            if (dirty) {
                applyTypography(currentFontChoice, currentCustomFontFamily, currentCustomFontData);
                applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight, currentExtractedPalette);
                applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
                syncUiControls();
            }
        } catch (e) {
            console.warn('[WebStudio] Could not fetch remote appearance:', e);
        }
    }

    async function saveAppearanceToCloud() {
        const userId = localStorage.getItem('userId');
        const syncDot = document.getElementById('studioSyncDot');
        const syncText = document.getElementById('studioSyncText');

        if (syncDot) syncDot.classList.add('syncing');
        if (syncText) syncText.textContent = 'Syncing...';

        const payload = {
            fontChoice: currentFontChoice,
            customFontFamily: currentCustomFontFamily,
            customFontData: currentCustomFontData,
            presetId: currentPresetId,
            primaryColor: currentPrimary,
            primaryGradientEnd: currentPrimaryEnd,
            accentColor: currentAccent,
            highlightColor: currentHighlight,
            cardSurface: currentCardSurface,
            surface: currentAppSurface,
            borderAccent: `rgba(${hexToRgb(currentPrimary).r}, ${hexToRgb(currentPrimary).g}, ${hexToRgb(currentPrimary).b}, 0.35)`,
            wallpaperType: currentWallpaperType,
            wallpaperUri: currentWallpaperUri,
            overlayOpacity: currentOverlayOpacity,
            blurIntensity: currentBlurIntensity
        };

        if (!userId || typeof window.apiRequest !== 'function') {
            if (syncDot) syncDot.classList.remove('syncing');
            if (syncText) syncText.textContent = 'Saved on this device';
            if (typeof window.showToast === 'function') {
                window.showToast('Appearance saved on this device. Sign in to sync across devices.', 'info');
            }
            return false;
        }

        try {
            await window.apiRequest(`/users/${userId}/appearance`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (syncDot) syncDot.classList.remove('syncing');
            if (syncText) syncText.textContent = 'Synced with Cloud';
            if (typeof window.showToast === 'function') {
                window.showToast('Studio appearance synced across all devices!', 'success');
            }
            return true;
        } catch {
            if (syncDot) syncDot.classList.remove('syncing');
            if (syncText) syncText.textContent = 'Saved locally (offline)';
            if (typeof window.showToast === 'function') {
                window.showToast('Saved locally. Will sync when online.', 'info');
            }
            return false;
        }
    }

    // ─── 6. MODAL DOM INJECTION & BINDINGS ────────────────────────────────────

    function injectStudioModal() {
        if (document.getElementById('themeStudioModal')) return;

        const modalHtml = `
        <div class="modal-overlay" id="themeStudioModal" role="dialog" aria-modal="true" aria-labelledby="studioModalTitle">
            <div class="modal studio-modal">
                <div class="studio-modal-header">
                    <div class="studio-header-title-wrap">
                        <div class="studio-icon-badge">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
                                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
                                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
                                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
                                <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 id="studioModalTitle" class="studio-modal-heading">Studio & Appearance</h3>
                            <p class="studio-modal-subheading">Personalize typography, live colors, and cross-device theme sync</p>
                        </div>
                    </div>
                    <button type="button" class="modal-close" id="closeStudioModalBtn" aria-label="Close Studio Modal">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div class="studio-modal-tabs">
                    <button type="button" class="studio-tab-btn active" data-tab="palette">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20"/></svg>
                        Palette & Colors
                    </button>
                    <button type="button" class="studio-tab-btn" data-tab="typography">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                        Typography & Fonts
                    </button>
                    <button type="button" class="studio-tab-btn" data-tab="atmosphere">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        Atmosphere & Wallpaper
                    </button>
                </div>

                <div class="studio-modal-body">
                    <!-- TAB 1: PALETTE & ACCENT -->
                    <div class="studio-tab-pane active" id="pane-palette">
                        <span class="studio-section-label">Active Color Target</span>
                        <div class="studio-color-picker-box">
                            <div class="studio-target-chips">
                                <button type="button" class="studio-target-chip active" data-target="primary">Primary Brand</button>
                                <button type="button" class="studio-target-chip" data-target="accent">Accent / Outflow</button>
                                <button type="button" class="studio-target-chip" data-target="highlight">Highlight</button>
                                <button type="button" class="studio-target-chip" data-target="card">Card Surface</button>
                                <button type="button" class="studio-target-chip" data-target="surface">App Surface</button>
                            </div>
                            <div class="studio-hex-input-row">
                                <div class="studio-color-orb-wrapper" id="studioColorOrbWrapper" title="Click to open system color picker wheel">
                                    <div class="studio-color-orb-preview" id="studioOrbPreview"></div>
                                    <input type="color" class="studio-native-color-input" id="studioNativeColorInput" value="#C79A3E">
                                </div>
                                <input type="text" class="studio-hex-field" id="studioHexInput" value="#C79A3E" maxlength="7" placeholder="#RRGGBB" spellcheck="false">
                            </div>
                        </div>

                        <span class="studio-section-label">24-Color Luxury Swatches</span>
                        <div class="studio-swatches-grid" id="studioSwatchesGrid"></div>

                        <span class="studio-section-label">Curated Themes & Atmospheric Presets</span>
                        <div class="studio-presets-grid" id="studioPresetsGrid"></div>
                        <span class="studio-section-label">My Theme Profiles</span>
                        <div class="studio-wallpaper-input-row mb-10">
                            <input type="text" id="studioProfileName" class="studio-wallpaper-field" maxlength="40" placeholder="Name this theme profile">
                            <button type="button" class="btn-secondary" id="studioSaveProfileBtn">Save Profile</button>
                        </div>
                        <div id="studioProfilesList" class="studio-presets-grid"></div>
                    </div>

                    <!-- TAB 2: TYPOGRAPHY & OUTSOURCED FONTS -->
                    <div class="studio-tab-pane" id="pane-typography">
                        <span class="studio-section-label">Select Workspace Font</span>
                        <div class="studio-font-cards" id="studioFontCards">
                            <div class="studio-font-card active" data-font="grotesk">
                                <div class="studio-font-title font-preview-hanken">Hanken Grotesk</div>
                                <div class="studio-font-sample">Modern neo-grotesque Swiss sans-serif for sharp financial readouts.</div>
                            </div>
                            <div class="studio-font-card" data-font="fraunces">
                                <div class="studio-font-title font-preview-fraunces">Fraunces Luxury Serif</div>
                                <div class="studio-font-sample">Refined editorial serif evoking bespoke private wealth ledgers.</div>
                            </div>
                            <div class="studio-font-card" data-font="mono">
                                <div class="studio-font-title font-preview-mono">IBM Plex Mono</div>
                                <div class="studio-font-sample">Technical terminal tabular precision for quantitative analysis.</div>
                            </div>
                            <div class="studio-font-card" data-font="system">
                                <div class="studio-font-title font-preview-system">Native System UI</div>
                                <div class="studio-font-sample">Clean zero-latency native operating system font stack (San Francisco / Segoe).</div>
                            </div>
                        </div>

                        <span class="studio-section-label">Import Outsourced Font (.ttf / .otf / .woff2)</span>
                        <div class="studio-font-upload-box" id="studioFontDropzone">
                            <input type="file" id="studioFontFileInput" accept=".ttf,.otf,.woff,.woff2">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <h4>Drop your font file here or click to browse</h4>
                            <p>Upload any outsourced brand font (.ttf, .otf, .woff2) to apply across the system</p>
                            <div id="studioCustomFontStatus"></div>
                        </div>

                        <span class="studio-section-label">Live Typography & Numbers Preview</span>
                        <div class="studio-live-preview" id="studioLivePreviewBox">
                            <div class="studio-preview-heading">Ledger & Lumina Private Wealth</div>
                            <div class="studio-preview-body">The quick brown fox jumps over the lazy dog. Real-time expense auditing and high-fidelity telemetry.</div>
                            <div class="studio-preview-nums">$1,234,567.89 &bull; ₹98,76,543.21 &bull; €45,678.00</div>
                        </div>
                    </div>

                    <!-- TAB 3: ATMOSPHERE & WALLPAPER -->
                    <div class="studio-tab-pane" id="pane-atmosphere">
                        <span class="studio-section-label">Atmosphere Background Mode</span>
                        <div class="studio-target-chips mb-16">
                            <button type="button" class="studio-target-chip active" id="bgModePreset">Ambient Gradients</button>
                            <button type="button" class="studio-target-chip" id="bgModeCustom">Custom Image URL</button>
                            <button type="button" class="studio-target-chip" id="bgModeNone">Clean Minimal</button>
                        </div>

                        <div id="studioCustomWallpaperGroup">
                            <label class="studio-section-label" for="studioWallpaperUrlInput">Wallpaper Image URL or File</label>
                            <div class="studio-wallpaper-input-row">
                                <input type="url" id="studioWallpaperUrlInput" class="studio-wallpaper-field" placeholder="Paste image URL (https://...) or choose Browse">
                                <button type="button" class="btn-secondary" id="studioLoadWallpaperUrlBtn">Load & Extract</button>
                                <button type="button" class="btn-secondary" id="studioBrowseWallpaperBtn">Browse File</button>
                                <input type="file" id="studioWallpaperFileInput" accept="image/*">
                            </div>
                            <p class="studio-crop-instructions">Drag across the image to select an area. Drag inside the selection to move it; use the corner handle to resize.</p>
                            <div class="studio-crop-frame" id="studioCropFrame" aria-label="Select wallpaper crop area" hidden>
                                <img id="studioCropPreviewImage" alt="Image crop preview">
                                <div class="studio-crop-selection" id="studioCropSelection" aria-hidden="true">
                                    <span class="studio-crop-resize-handle"></span>
                                </div>
                            </div>
                            <button type="button" class="btn-secondary" id="studioApplyCropBtn" disabled>Apply Crop & Extract Palette</button>
                            <span class="studio-section-label mt-12">Extracted Image Colors · Tap to apply to the selected target</span>
                            <div id="studioExtractedPalette" class="studio-extracted-palette" aria-live="polite"></div>
                            <small id="studioWallpaperStatus" role="status"></small>
                        </div>

                        <div class="studio-slider-row">
                            <div class="studio-slider-label">
                                <span>Overlay Tint Opacity</span>
                                <span id="studioOpacityValue">35%</span>
                            </div>
                            <input type="range" class="studio-range-slider" id="studioOpacitySlider" min="0" max="90" value="35">
                        </div>

                        <div class="studio-slider-row">
                            <div class="studio-slider-label">
                                <span>Background Blur Intensity</span>
                                <span id="studioBlurValue">0px</span>
                            </div>
                            <input type="range" class="studio-range-slider" id="studioBlurSlider" min="0" max="20" value="0">
                        </div>
                    </div>
                </div>

                <div class="studio-modal-footer">
                    <div class="studio-sync-status">
                        <span class="studio-sync-dot" id="studioSyncDot"></span>
                        <span id="studioSyncText">Ready</span>
                    </div>
                    <div class="studio-footer-actions">
                        <button type="button" class="btn-secondary" id="studioResetBtn">Reset Defaults</button>
                        <button type="button" class="btn-primary" id="studioSaveSyncBtn">Apply Theme</button>
                    </div>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // ─── 7. UI CONTROLLER ─────────────────────────────────────────────────────

    function initStudioController() {
        injectStudioModal();

        const modal = document.getElementById('themeStudioModal');
        const closeBtn = document.getElementById('closeStudioModalBtn');
        const tabs = document.querySelectorAll('.studio-tab-btn');
        const panes = document.querySelectorAll('.studio-tab-pane');

        const targetChips = document.querySelectorAll('.studio-target-chip[data-target]');
        const orbPreview = document.getElementById('studioOrbPreview');
        const nativeColorInput = document.getElementById('studioNativeColorInput');
        const hexInput = document.getElementById('studioHexInput');
        const swatchesGrid = document.getElementById('studioSwatchesGrid');
        const presetsGrid = document.getElementById('studioPresetsGrid');

        const fontCards = document.querySelectorAll('.studio-font-card');
        const dropzone = document.getElementById('studioFontDropzone');
        const fileInput = document.getElementById('studioFontFileInput');
        const customFontStatus = document.getElementById('studioCustomFontStatus');

        const bgModePreset = document.getElementById('bgModePreset');
        const bgModeCustom = document.getElementById('bgModeCustom');
        const bgModeNone = document.getElementById('bgModeNone');
        const customWallpaperGroup = document.getElementById('studioCustomWallpaperGroup');
        const wallpaperUrlInput = document.getElementById('studioWallpaperUrlInput');
        const wallpaperFileInput = document.getElementById('studioWallpaperFileInput');
        const browseWallpaperBtn = document.getElementById('studioBrowseWallpaperBtn');
        const loadWallpaperUrlBtn = document.getElementById('studioLoadWallpaperUrlBtn');
        const wallpaperStatus = document.getElementById('studioWallpaperStatus');
        const extractedPaletteView = document.getElementById('studioExtractedPalette');
        const cropFrame = document.getElementById('studioCropFrame');
        const cropPreviewImage = document.getElementById('studioCropPreviewImage');
        const cropSelection = document.getElementById('studioCropSelection');
        const applyCropBtn = document.getElementById('studioApplyCropBtn');
        const profileNameInput = document.getElementById('studioProfileName');
        const profilesList = document.getElementById('studioProfilesList');
        const saveProfileBtn = document.getElementById('studioSaveProfileBtn');
        let editingProfileId = null;
        const opacitySlider = document.getElementById('studioOpacitySlider');
        const opacityValue = document.getElementById('studioOpacityValue');
        const blurSlider = document.getElementById('studioBlurSlider');
        const blurValue = document.getElementById('studioBlurValue');

        const resetBtn = document.getElementById('studioResetBtn');
        const saveSyncBtn = document.getElementById('studioSaveSyncBtn');

        // Render 24 Swatches
        if (swatchesGrid) {
            swatchesGrid.innerHTML = LUXURY_SWATCHES.map(color => `
                <button type="button" class="studio-swatch-btn ${color.toLowerCase() === currentPrimary.toLowerCase() ? 'active' : ''}"
                    data-color="${color}" title="${color}"></button>
            `).join('');

            swatchesGrid.querySelectorAll('.studio-swatch-btn').forEach(btn => {
                const color = btn.getAttribute('data-color');
                btn.style.backgroundColor = color;
                btn.addEventListener('click', () => {
                    applyColorChange(color);
                });
            });
        }

        // Render Presets
        if (presetsGrid) {
            presetsGrid.innerHTML = STUDIO_PRESETS.map(p => `
                <div class="studio-preset-card ${p.id === currentPresetId ? 'active' : ''}" data-preset-id="${p.id}">
                    <div class="studio-preset-dots">
                        <span class="studio-preset-dot" data-bg="${p.primary}"></span>
                        <span class="studio-preset-dot" data-bg="${p.accent}"></span>
                        <span class="studio-preset-dot" data-bg="${p.highlight}"></span>
                    </div>
                    <div class="studio-preset-name">${p.name}</div>
                    <div class="studio-preset-sub">${p.subtitle}</div>
                </div>
            `).join('');

            presetsGrid.querySelectorAll('.studio-preset-dot').forEach(dot => {
                dot.style.background = dot.getAttribute('data-bg');
            });

            presetsGrid.querySelectorAll('.studio-preset-card').forEach(card => {
                card.addEventListener('click', () => {
                    selectPreset(card.getAttribute('data-preset-id'));
                });
            });
        }

        // Tab Switching
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.getAttribute('data-tab');
                const pane = document.getElementById(`pane-${target}`);
                if (pane) pane.classList.add('active');
            });
        });

        // Target Chip Selector
        targetChips.forEach(chip => {
            chip.addEventListener('click', () => {
                targetChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activeColorTarget = chip.getAttribute('data-target');
                updateColorPickerInputs();
            });
        });

        function getActiveTargetColor() {
            if (activeColorTarget === 'accent') return currentAccent;
            if (activeColorTarget === 'highlight') return currentHighlight;
            if (activeColorTarget === 'card') return /^#[0-9a-f]{6}$/i.test(currentCardSurface) ? currentCardSurface : '#171A14';
            if (activeColorTarget === 'surface') return /^#[0-9a-f]{6}$/i.test(currentAppSurface) ? currentAppSurface : '#10120E';
            return currentPrimary;
        }

        function updateColorPickerInputs() {
            const activeColor = getActiveTargetColor();
            if (orbPreview) orbPreview.style.backgroundColor = activeColor;
            if (nativeColorInput) nativeColorInput.value = activeColor;
            if (hexInput) hexInput.value = activeColor.toUpperCase();
        }

        function applyColorChange(newHex) {
            if (!isValidHex(newHex)) return;
            newHex = newHex.toUpperCase();

            if (activeColorTarget === 'primary') {
                currentPrimary = newHex;
                currentPrimaryEnd = adjustBrightness(newHex, 0.85);
            } else if (activeColorTarget === 'accent') {
                currentAccent = newHex;
            } else if (activeColorTarget === 'highlight') {
                currentHighlight = newHex;
            } else if (activeColorTarget === 'card') {
                currentCardSurface = newHex;
            } else if (activeColorTarget === 'surface') {
                currentAppSurface = newHex;
            }

            autoSaveCurrentState();
            if (isCustomApplied) {
                applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight, currentExtractedPalette);
            }
            updateColorPickerInputs();

            // Highlight active swatch if matches
            if (swatchesGrid) {
                swatchesGrid.querySelectorAll('.studio-swatch-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-color').toUpperCase() === newHex);
                });
            }
        }

        // Native Color Picker Input
        nativeColorInput?.addEventListener('input', (e) => {
            applyColorChange(e.target.value);
        });

        // Hex Input Field
        hexInput?.addEventListener('input', (e) => {
            let val = e.target.value.trim();
            if (!val.startsWith('#')) val = '#' + val;
            if (isValidHex(val)) {
                applyColorChange(val);
            }
        });

        // Typography Card Selection
        fontCards.forEach(card => {
            card.addEventListener('click', () => {
                const fontKey = card.getAttribute('data-font');
                currentFontChoice = fontKey;
                autoSaveCurrentState();
                if (isCustomApplied) {
                    applyTypography(currentFontChoice, currentCustomFontFamily, currentCustomFontData);
                }
                syncUiControls();
            });
        });

        // Outsourced Font Upload
        dropzone?.addEventListener('click', (e) => {
            if (e.target.closest('.studio-remove-font-btn')) return;
            fileInput?.click();
        });

        dropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone?.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer?.files?.[0];
            if (file) handleFontFileUpload(file);
        });

        fileInput?.addEventListener('change', (e) => {
            const file = e.target?.files?.[0];
            if (file) handleFontFileUpload(file);
        });

        function handleFontFileUpload(file) {
            const allowed = ['.ttf', '.otf', '.woff', '.woff2'];
            const lowerName = file.name.toLowerCase();
            const valid = allowed.some(ext => lowerName.endsWith(ext));
            if (!valid) {
                if (typeof window.showToast === 'function') {
                    window.showToast('Please select a valid font file (.ttf, .otf, .woff, .woff2)', 'error');
                }
                return;
            }

            const cleanFamily = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '');
            const reader = new FileReader();

            reader.onload = (ev) => {
                const dataUrl = ev.target?.result;
                if (!dataUrl) return;

                currentCustomFontFamily = cleanFamily;
                currentCustomFontData = dataUrl;
                currentFontChoice = 'custom';

                localStorage.setItem('app_custom_font_family', cleanFamily);
                localStorage.setItem('app_custom_font_data', dataUrl);
                localStorage.setItem('app_font_choice', 'custom');

                applyTypography('custom', cleanFamily, dataUrl);
                syncUiControls();

                if (typeof window.showToast === 'function') {
                    window.showToast(`Custom font "${cleanFamily}" loaded successfully!`, 'success');
                }
            };

            reader.readAsDataURL(file);
        }

        // Atmosphere Sliders
        opacitySlider?.addEventListener('input', (e) => {
            const val = Number(e.target.value);
            currentOverlayOpacity = val / 100;
            if (opacityValue) opacityValue.textContent = `${val}%`;
            autoSaveCurrentState();
            if (isCustomApplied) {
                applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
            }
        });

        blurSlider?.addEventListener('input', (e) => {
            const val = Number(e.target.value);
            currentBlurIntensity = val;
            if (blurValue) blurValue.textContent = `${val}px`;
            autoSaveCurrentState();
            if (isCustomApplied) {
                applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
            }
        });

        // Atmosphere Mode Toggles
        bgModePreset?.addEventListener('click', () => {
            currentWallpaperType = 'preset';
            syncAtmosphereMode();
            autoSaveCurrentState();
            if (isCustomApplied) {
                applyAtmosphere('preset', currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
            }
        });

        bgModeCustom?.addEventListener('click', () => {
            currentWallpaperType = 'custom';
            syncAtmosphereMode();
            autoSaveCurrentState();
            if (isCustomApplied) {
                applyAtmosphere('custom', currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
            }
        });

        bgModeNone?.addEventListener('click', () => {
            currentWallpaperType = 'none';
            syncAtmosphereMode();
            autoSaveCurrentState();
            if (isCustomApplied) {
                applyAtmosphere('none', '', 0, 0);
            }
        });

        wallpaperUrlInput?.addEventListener('input', (e) => {
            // Keep unverified URLs out of persisted appearance state until they load successfully.
            const candidate = e.target.value.trim();
            e.target.setAttribute('aria-invalid', 'false');
            if (currentWallpaperType === 'custom' && /^https?:\/\//i.test(candidate) && candidate !== wallpaperSourceUri) {
                if (wallpaperStatus) wallpaperStatus.textContent = 'Load & extract this URL before saving it as your wallpaper.';
            }
        });

        function updateCropPreview() {
            if (!wallpaperSourceImage || !cropFrame || !cropPreviewImage || !cropSelection) return;
            cropFrame.hidden = false;
            const naturalAspect = wallpaperSourceImage.naturalWidth / wallpaperSourceImage.naturalHeight;
            const frameWidth = Math.min(cropFrame.parentElement.clientWidth, 360 * naturalAspect);
            const frameHeight = frameWidth / naturalAspect;
            cropFrame.style.width = `${frameWidth}px`;
            cropFrame.style.height = `${frameHeight}px`;
            cropFrame.style.aspectRatio = String(naturalAspect);
            cropPreviewImage.src = wallpaperSourceImage.src;
            cropPreviewImage.style.width = '100%';
            cropPreviewImage.style.height = '100%';
            cropSelection.style.left = `${cropRect.x * 100}%`;
            cropSelection.style.top = `${cropRect.y * 100}%`;
            cropSelection.style.width = `${cropRect.width * 100}%`;
            cropSelection.style.height = `${cropRect.height * 100}%`;
            if (applyCropBtn) applyCropBtn.disabled = false;
        }

        let cropPointerState = null;
        cropFrame?.addEventListener('pointerdown', (event) => {
            if (!wallpaperSourceImage || !cropFrame || !cropSelection) return;
            event.preventDefault();
            cropFrame.setPointerCapture(event.pointerId);
            const bounds = cropFrame.getBoundingClientRect();
            const point = { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
            const resizing = event.target.closest('.studio-crop-resize-handle');
            const selectionIsWholeImage = cropRect.width > 0.98 && cropRect.height > 0.98;
            const moving = !resizing && !selectionIsWholeImage && event.target.closest('.studio-crop-selection');
            cropPointerState = {
                mode: resizing ? 'resize' : moving ? 'move' : 'select',
                start: point,
                original: { ...cropRect },
            };
            if (cropPointerState.mode === 'select') cropRect = { x: point.x, y: point.y, width: 0.04, height: 0.04 };
            updateCropPreview();
        });

        cropFrame?.addEventListener('pointermove', (event) => {
            if (!cropPointerState || !cropFrame) return;
            const bounds = cropFrame.getBoundingClientRect();
            const point = {
                x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
                y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
            };
            const dx = point.x - cropPointerState.start.x, dy = point.y - cropPointerState.start.y;
            const original = cropPointerState.original;
            if (cropPointerState.mode === 'move') {
                cropRect.x = Math.max(0, Math.min(1 - original.width, original.x + dx));
                cropRect.y = Math.max(0, Math.min(1 - original.height, original.y + dy));
            } else if (cropPointerState.mode === 'resize') {
                cropRect.width = Math.max(0.04, Math.min(1 - original.x, original.width + dx));
                cropRect.height = Math.max(0.04, Math.min(1 - original.y, original.height + dy));
            } else {
                cropRect = {
                    x: Math.min(cropPointerState.start.x, point.x),
                    y: Math.min(cropPointerState.start.y, point.y),
                    width: Math.max(0.04, Math.abs(dx)),
                    height: Math.max(0.04, Math.abs(dy)),
                };
                cropRect.width = Math.min(cropRect.width, 1 - cropRect.x);
                cropRect.height = Math.min(cropRect.height, 1 - cropRect.y);
            }
            updateCropPreview();
        });
        const finishCropPointer = () => { cropPointerState = null; };
        cropFrame?.addEventListener('pointerup', finishCropPointer);
        cropFrame?.addEventListener('pointercancel', finishCropPointer);

        async function processWallpaper(uri) {
            if (window.WebStudio) window.WebStudio.processWallpaper = processWallpaper;
            if (!/^https?:\/\//i.test(uri) && !uri.startsWith('data:')) {
                if (wallpaperStatus) wallpaperStatus.textContent = 'Enter a valid http or https image URL.';
                return;
            }
            wallpaperLoadPending = true;
            if (wallpaperStatus) wallpaperStatus.textContent = 'Loading image and extracting its palette…';
            if (applyCropBtn) applyCropBtn.disabled = true;
            if (saveSyncBtn) saveSyncBtn.disabled = true;
            try {
                if (uri !== wallpaperSourceUri) cropRect = { x: 0, y: 0, width: 1, height: 1 };
                wallpaperSourceUri = uri;
                await cropAndExtractWallpaper(uri);
                currentWallpaperType = 'custom';
                syncAtmosphereMode(); syncUiControls(); updateCropPreview();
                if (extractedPaletteView) {
                    extractedPaletteView.innerHTML = currentExtractedPalette.map((color, index) =>
                        `<button type="button" class="studio-extracted-swatch" data-extracted-color="${color}" title="Apply ${color} to the selected color target"><i data-color="${color}"></i>Color ${index + 1} <code>${color}</code></button>`
                    ).join('');
                    extractedPaletteView.querySelectorAll('[data-extracted-color]').forEach((swatch) => {
                        const icon = swatch.querySelector('i');
                        if (icon) icon.style.background = icon.getAttribute('data-color');
                        swatch.addEventListener('click', () => applyColorChange(swatch.getAttribute('data-extracted-color')));
                    });
                }
                if (wallpaperStatus) wallpaperStatus.textContent = 'Image loaded and palette extracted. Use Save & Sync to keep this wallpaper.';
            } catch (err) {
                wallpaperSourceUri = '';
                wallpaperSourceImage = null;
                if (cropFrame) cropFrame.hidden = true;
            const corsBlocked = err.name === 'SecurityError' || /taint|cross-origin|security/i.test(err.message || '');
            if (wallpaperStatus) wallpaperStatus.textContent = corsBlocked
                ? 'This image host blocks browser color extraction. Download the image and use Browse File.'
                : (err.message || 'Could not load or extract colors from this image.');
            } finally {
                wallpaperLoadPending = false;
                if (saveSyncBtn) saveSyncBtn.disabled = false;
                if (applyCropBtn) applyCropBtn.disabled = !wallpaperSourceImage;
            }
        }

        let wallpaperLoadTimer = null;
        let wallpaperLoadPending = false;
        const queueWallpaperLoad = () => {
            clearTimeout(wallpaperLoadTimer);
            if (/^https?:\/\//i.test(wallpaperUrlInput.value.trim())) {
                wallpaperLoadPending = true;
                if (saveSyncBtn) saveSyncBtn.disabled = true;
                if (wallpaperStatus) wallpaperStatus.textContent = 'Loading pasted image URL…';
            }
            wallpaperLoadTimer = setTimeout(() => {
            const uri = wallpaperUrlInput.value.trim();
            if (uri) void processWallpaper(uri);
            else { wallpaperLoadPending = false; if (saveSyncBtn) saveSyncBtn.disabled = false; }
            }, 120);
        };
        wallpaperUrlInput?.addEventListener('paste', queueWallpaperLoad);
        wallpaperUrlInput?.addEventListener('change', queueWallpaperLoad);

        browseWallpaperBtn?.addEventListener('click', () => {
            wallpaperFileInput?.click();
        });

        wallpaperFileInput?.addEventListener('change', (e) => {
            const file = e.target?.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result;
                if (!dataUrl) return;
                wallpaperSourceUri = 'local:' + (file.name || 'image');
                if (wallpaperUrlInput) {
                    wallpaperUrlInput.value = '';
                    wallpaperUrlInput.placeholder = 'Uploaded file: ' + (file.name || 'image');
                }
                void processWallpaper(dataUrl);
            };
            reader.readAsDataURL(file);
        });

        loadWallpaperUrlBtn?.addEventListener('click', () => {
            const uri = wallpaperUrlInput?.value.trim();
            if (uri) void processWallpaper(uri);
        });
        applyCropBtn?.addEventListener('click', () => {
            if (wallpaperSourceUri) void processWallpaper(wallpaperSourceUri);
        });
        wallpaperUrlInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); loadWallpaperUrlBtn?.click(); }
        });

        function renderProfiles() {
            if (!profilesList) return;
            profilesList.innerHTML = savedProfiles.map((profile) => `<div class="studio-preset-card" data-profile="${profile.id}">
                <div class="studio-preset-dots"><span class="studio-preset-dot" data-bg="${profile.primary}"></span><span class="studio-preset-dot" data-bg="${profile.accent}"></span><span class="studio-preset-dot" data-bg="${profile.highlight}"></span></div>
                <div class="studio-preset-name">${String(profile.name).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</div>
                <div class="studio-preset-sub"><button type="button" data-action="apply">Apply</button> <button type="button" data-action="edit">Edit</button> <button type="button" data-action="delete">Delete</button></div>
            </div>`).join('') || '<small>No saved profiles yet.</small>';
            profilesList.querySelectorAll('.studio-preset-dot').forEach((dot) => {
                dot.style.background = dot.getAttribute('data-bg');
            });
            profilesList.querySelectorAll('[data-profile]').forEach((card) => card.addEventListener('click', (event) => {
                const action = event.target.closest('[data-action]')?.getAttribute('data-action');
                if (!action) return;
                const profile = savedProfiles.find((item) => item.id === card.getAttribute('data-profile'));
                if (!profile) return;
                if (action === 'apply') applyProfile(profile);
                if (action === 'edit') { applyProfile(profile); editingProfileId = profile.id; profileNameInput.value = profile.name; saveProfileBtn.textContent = 'Update Profile'; }
                if (action === 'delete') {
                    savedProfiles = savedProfiles.filter((item) => item.id !== profile.id);
                    localStorage.setItem('app_theme_profiles', JSON.stringify(savedProfiles));
                    if (editingProfileId === profile.id) { editingProfileId = null; profileNameInput.value = ''; saveProfileBtn.textContent = 'Save Profile'; }
                    renderProfiles();
                }
            }));
        }
        saveProfileBtn?.addEventListener('click', () => {
            const name = profileNameInput?.value.trim();
            if (!name) { profileNameInput?.focus(); return; }
            const profile = profileSnapshot(name);
            if (editingProfileId) {
                profile.id = editingProfileId;
                savedProfiles = savedProfiles.map((item) => item.id === editingProfileId ? profile : item);
            } else savedProfiles = [...savedProfiles, profile];
            localStorage.setItem('app_theme_profiles', JSON.stringify(savedProfiles));
            editingProfileId = null; profileNameInput.value = ''; saveProfileBtn.textContent = 'Save Profile'; renderProfiles();
        });
        renderProfiles();

        function syncAtmosphereMode() {
            bgModePreset?.classList.toggle('active', currentWallpaperType === 'preset');
            bgModeCustom?.classList.toggle('active', currentWallpaperType === 'custom');
            bgModeNone?.classList.toggle('active', currentWallpaperType === 'none');
            if (customWallpaperGroup) {
                customWallpaperGroup.style.display = currentWallpaperType === 'custom' ? 'block' : 'none';
            }
        }

        // Reset to Defaults
        function resetToDefault() {
            currentFontChoice = 'grotesk';
            currentCustomFontFamily = null;
            currentCustomFontData = null;
            currentPresetId = 'default';
            currentPrimary = '#C79A3E';
            currentPrimaryEnd = '#A97F2E';
            currentAccent = '#A23E32';
            currentHighlight = '#4C7A78';
            currentCardSurface = '#171A14';
            currentAppSurface = '#10120E';
            currentWallpaperType = 'preset';
            currentWallpaperUri = '';
            currentOverlayOpacity = 0.35;
            currentBlurIntensity = 0;

            localStorage.removeItem('app_font_choice');
            localStorage.removeItem('app_custom_font_family');
            localStorage.removeItem('app_custom_font_data');
            localStorage.removeItem('app_custom_palette');
            localStorage.removeItem('app_bg_asset');
            localStorage.setItem('app_custom_applied', 'false');
            isCustomApplied = false;

            clearPaletteVars();
            applyAtmosphere('preset', '', 0.35, 0);
            document.body?.classList.remove("has-custom-wallpaper");
            document.documentElement.style.removeProperty("--custom-wallpaper-bg");
            syncUiControls();
            void saveAppearanceToCloud();
        }

        resetBtn?.addEventListener('click', resetToDefault);

        // Apply Theme
        saveSyncBtn?.addEventListener('click', () => {
            if (wallpaperLoadPending) {
                if (wallpaperStatus) wallpaperStatus.textContent = 'Wait for the image and palette to finish loading before applying.';
                return;
            }
            const enteredWallpaperUrl = wallpaperUrlInput?.value.trim();
            if (currentWallpaperType === 'custom' && /^https?:\/\//i.test(enteredWallpaperUrl || '') && enteredWallpaperUrl !== wallpaperSourceUri) {
                if (wallpaperStatus) wallpaperStatus.textContent = 'Load & extract this image URL before applying the wallpaper.';
                return;
            }
            applyCustomTheme();
            closeStudio();
        });

        // Close Modal Handlers
        function closeStudio() {
            if (typeof window.closeModal === 'function') {
                window.closeModal(modal);
            } else {
                modal.classList.remove('active');
            }
        }

        closeBtn?.addEventListener('click', closeStudio);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeStudio();
        });

        // Open Modal Trigger buttons
        document.getElementById('themeStudioBtn')?.addEventListener('click', () => {
            syncUiControls();
            if (typeof window.openModal === 'function') {
                window.openModal(modal);
            } else {
                modal.classList.add('active');
            }
        });

        document.getElementById('themeStudioMenuBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            syncUiControls();
            if (typeof window.openModal === 'function') {
                window.openModal(modal);
            } else {
                modal.classList.add('active');
            }
        });

        // Keyboard Shortcut: Alt+T for Studio
        document.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === 't' || e.key === 'T')) {
                e.preventDefault();
                syncUiControls();
                if (typeof window.openModal === 'function') {
                    window.openModal(modal);
                } else {
                    modal.classList.toggle('active');
                }
            }
        });

        syncUiControls = function () {
            updateColorPickerInputs();

            // Font cards
            fontCards.forEach(c => {
                const fk = c.getAttribute('data-font');
                c.classList.toggle('active', fk === currentFontChoice);
            });

            // Outsourced Font status
            if (customFontStatus) {
                if (currentCustomFontFamily) {
                    customFontStatus.style.display = 'inline-flex';
                    customFontStatus.className = 'studio-custom-font-badge';
                    customFontStatus.innerHTML = `
                        <span>Imported: <strong>${currentCustomFontFamily}</strong></span>
                        <button type="button" class="studio-remove-font-btn" title="Remove custom font">&times;</button>
                    `;
                    customFontStatus.querySelector('.studio-remove-font-btn')?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        currentCustomFontFamily = null;
                        currentCustomFontData = null;
                        currentFontChoice = 'grotesk';
                        localStorage.removeItem('app_custom_font_family');
                        localStorage.removeItem('app_custom_font_data');
                        localStorage.setItem('app_font_choice', 'grotesk');
                        applyTypography('grotesk', null, null);
                        syncUiControls();
                    });
                } else {
                    customFontStatus.style.display = 'none';
                    customFontStatus.innerHTML = '';
                }
            }

            // Presets
            if (presetsGrid) {
                presetsGrid.querySelectorAll('.studio-preset-card').forEach(c => {
                    c.classList.toggle('active', c.getAttribute('data-preset-id') === currentPresetId);
                });
            }

            // Atmosphere
            syncAtmosphereMode();
            if (opacitySlider) opacitySlider.value = Math.round(currentOverlayOpacity * 100);
            if (opacityValue) opacityValue.textContent = `${Math.round(currentOverlayOpacity * 100)}%`;
            if (blurSlider) blurSlider.value = currentBlurIntensity;
            if (blurValue) blurValue.textContent = `${currentBlurIntensity}px`;
            if (wallpaperUrlInput) {
                if (currentWallpaperType === 'custom') {
                    if (/^https?:\/\//i.test(wallpaperSourceUri)) {
                        wallpaperUrlInput.value = wallpaperSourceUri;
                        wallpaperUrlInput.placeholder = 'Paste image URL (https://...)';
                    } else if (wallpaperSourceUri.startsWith('local:') || currentWallpaperUri.startsWith('data:')) {
                        wallpaperUrlInput.value = '';
                        const fileName = wallpaperSourceUri.replace(/^local:/, '');
                        wallpaperUrlInput.placeholder = fileName ? `Uploaded file: ${fileName}` : 'Uploaded local image active';
                    } else {
                        wallpaperUrlInput.value = currentWallpaperUri || '';
                        wallpaperUrlInput.placeholder = 'Paste image URL (https://...)';
                    }
                } else {
                    wallpaperUrlInput.value = '';
                    wallpaperUrlInput.placeholder = 'Paste image URL (https://...)';
                }
            }
        }

        // Initialize state display
        syncUiControls();

        // Check if authenticated user can fetch cloud settings
        const userId = localStorage.getItem('userId');
        if (userId) {
            void fetchAppearanceFromCloud(userId);
        }
    }

    // Attach to DOMContentLoaded or execute immediately if already loaded
    document.addEventListener('themechange', (e) => {
        if (e && e.detail && e.detail.fromToggle) {
            deactivateCustomTheme();
            return;
        }
        if (!isCustomApplied || isDefaultPalette()) {
            clearPaletteVars();
            return;
        }
        applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight, currentExtractedPalette);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStudioController);
    } else {
        initStudioController();
    }

    // Expose API to window
    window.WebStudio = {
        applyCustomTheme,
        deactivateCustomTheme,
        resetToDefault,
        selectPreset,
        fetchAppearanceFromCloud,
        saveAppearanceToCloud,
        applyTypography,
        applyPalette,
        applyAtmosphere,
        cropAndExtractWallpaper,
        open: () => {
            const m = document.getElementById("themeStudioModal");
            if (m) {
                if (typeof window.openModal === "function") window.openModal(m);
                else m.classList.add("active");
            }
        },
        close: () => {
            const m = document.getElementById("themeStudioModal");
            if (m) {
                if (typeof window.closeModal === "function") window.closeModal(m);
                else m.classList.remove("active");
            }
        }
    };

})();
