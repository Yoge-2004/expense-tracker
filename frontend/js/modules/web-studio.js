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
        if (!hex) return { r: 199, g: 154, b: 62 };
        const clean = hex.replace('#', '').trim();
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

    function adjustBrightness(hex, factor) {
        const { r, g, b } = hexToRgb(hex);
        const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
        return '#' + [clamp(r * factor), clamp(g * factor), clamp(b * factor)]
            .map(x => x.toString(16).padStart(2, '0')).join('');
    }

    function colorVariant(hex, hueOffset) {
        const channels = colorChannels(hex).map(value => value / 255);
        const max = Math.max(...channels), min = Math.min(...channels), delta = max - min;
        let hue = 0;
        if (delta) {
            if (max === channels[0]) hue = 60 * (((channels[1] - channels[2]) / delta) % 6);
            else if (max === channels[1]) hue = 60 * ((channels[2] - channels[0]) / delta + 2);
            else hue = 60 * ((channels[0] - channels[1]) / delta + 4);
        }
        hue = (hue + hueOffset + 360) % 360;
        const lightness = Math.min(0.64, Math.max(0.42, (max + min) / 2));
        const saturation = Math.min(0.82, Math.max(0.58, delta / (1 - Math.abs(2 * lightness - 1))));
        const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
        const match = lightness - chroma / 2;
        const variants = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
        return '#' + variants[Math.floor(hue / 60) % 6]
            .map(value => Math.round((value + match) * 255).toString(16).padStart(2, '0')).join('');
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

    // ─── 3. STATE ─────────────────────────────────────────────────────────────

    let currentFontChoice = localStorage.getItem('app_font_choice') || 'grotesk';
    let currentCustomFontFamily = localStorage.getItem('app_custom_font_family') || null;
    let currentCustomFontData = localStorage.getItem('app_custom_font_data') || null;
    let currentPresetId = 'default';

    let currentPrimary = '#C79A3E';
    let currentPrimaryEnd = '#A97F2E';
    let currentAccent = '#A23E32';
    let currentHighlight = '#4C7A78';
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
    try { savedProfiles = JSON.parse(localStorage.getItem('app_theme_profiles') || '[]'); } catch (e) { savedProfiles = []; }

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
        const pixels = sampleCtx.getImageData(0, 0, sample.width, sample.height);
        const counts = new Map();
        for (let i = 0; i < pixels.data.length; i += 16) {
            const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
            if (pixels.data[i + 3] < 128) continue;
            const key = [Math.round(r / 32) * 32, Math.round(g / 32) * 32, Math.round(b / 32) * 32];
            const id = key.join(','); counts.set(id, (counts.get(id) || 0) + 1);
        }
        const ranked = [...counts.entries()].map(([id, count]) => {
            const channels = id.split(',').map(Number);
            const saturation = Math.max(...channels) - Math.min(...channels);
            const luminance = channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114;
            return { channels, count, saturation, luminance, score: count * (0.35 + saturation / 255) };
        }).filter(color => color.luminance >= 12 && color.luminance <= 245)
            .sort((a, b) => b.score - a.score);
        const selected = [];
        for (const candidate of ranked) {
            const separated = selected.every(color => Math.sqrt(candidate.channels.reduce((sum, value, index) => sum + Math.pow(value - color.channels[index], 2), 0)) >= 62);
            if (separated) selected.push(candidate);
            if (selected.length === 8) break;
        }
        const colors = selected.map(color => '#' + color.channels.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join(''));
        // Muted and near-monochrome images still get a useful, derived palette.
        if (!colors.length && counts.size) {
            const [id] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
            colors.push('#' + id.split(',').map(value => Math.max(0, Math.min(255, Number(value))).toString(16).padStart(2, '0')).join(''));
        }
        if (!colors.length) throw new Error('This image contains no readable pixels. Try another image.');
        if (colors.length === 1) {
            colors.push(colorVariant(colors[0], 34), colorVariant(colors[0], 190));
        } else if (colors.length === 2) {
            colors.push(colorVariant(colors[0], 190));
        }
        const harmonyOffsets = [96, 154, 218, 278, 318];
        for (const offset of harmonyOffsets) {
            if (colors.length >= 8) break;
            const variant = colorVariant(colors[0], offset);
            if (!colors.includes(variant)) colors.push(variant);
        }
        while (colors.length < 8) colors.push(adjustBrightness(colors[colors.length % Math.max(1, selected.length)], colors.length % 2 ? 0.72 : 1.2));
        currentExtractedPalette = colors;
        const [primary, accent, highlight] = colors;
        currentPrimary = primary; currentPrimaryEnd = adjustBrightness(primary, 0.82);
        currentAccent = accent || adjustBrightness(primary, 1.25); currentHighlight = highlight || adjustBrightness(primary, 1.5);
        currentWallpaperType = 'custom'; currentWallpaperUri = canvas.toDataURL('image/jpeg', 0.88);
        applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight);
        applyAtmosphere('custom', currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
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
        localStorage.setItem('app_bg_asset', JSON.stringify({ type: currentWallpaperType, presetId: currentPresetId, uri: currentWallpaperUri, overlayOpacity: currentOverlayOpacity, blurIntensity: currentBlurIntensity }));
        applyTypography(currentFontChoice, currentCustomFontFamily, currentCustomFontData);
        applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight);
        applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
        syncUiControls(); void saveAppearanceToCloud();
    }

    // Try reading cached custom palette
    try {
        const savedPalette = localStorage.getItem('app_custom_palette');
        if (savedPalette) {
            const parsed = JSON.parse(savedPalette);
            if (parsed.primary) currentPrimary = parsed.primary;
            if (parsed.primaryGradientEnd) currentPrimaryEnd = parsed.primaryGradientEnd;
            if (parsed.accent) currentAccent = parsed.accent;
            if (parsed.highlight) currentHighlight = parsed.highlight;
            if (parsed.cardSurface) currentCardSurface = parsed.cardSurface;
            if (parsed.surface) currentAppSurface = parsed.surface;
        }
    } catch (e) {}

    // Try reading cached background asset
    try {
        const savedBg = localStorage.getItem('app_bg_asset');
        if (savedBg) {
            const parsed = JSON.parse(savedBg);
            if (parsed.type) currentWallpaperType = parsed.type;
            if (parsed.presetId) currentPresetId = parsed.presetId;
            if (parsed.uri) currentWallpaperUri = parsed.uri;
            if (typeof parsed.overlayOpacity === 'number') currentOverlayOpacity = parsed.overlayOpacity;
            if (typeof parsed.blurIntensity === 'number') currentBlurIntensity = parsed.blurIntensity;
        }
    } catch (e) {}

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

    function applyPalette(primaryHex, primaryEndHex, accentHex, highlightHex) {
        const root = document.documentElement;
        const isLight = root.getAttribute('data-theme') === 'light';
        const cardBase = isLight ? '#FFFFFF' : '#171A14';
        const surfaceBase = isLight ? '#EEF1F6' : '#10120E';
        // Hex values are explicitly chosen by the user; let them materially affect
        // the surface. Preset RGBA values remain subtle tints for each color mode.
        const safeCard = mixSurface(cardBase, currentCardSurface, isValidHex(currentCardSurface) ? 0.7 : 0.18);
        const safeSurface = mixSurface(surfaceBase, currentAppSurface, isValidHex(currentAppSurface) ? 0.7 : 0.18);
        currentPrimary = ensureContrast(primaryHex, safeCard);
        const onPrimary = contrastRatio('#FFFFFF', currentPrimary) >= contrastRatio('#10120E', currentPrimary) ? '#FFFFFF' : '#10120E';
        currentPrimaryEnd = ensureContrast(primaryEndHex || adjustBrightness(currentPrimary, 0.85), onPrimary);
        currentAccent = ensureContrast(accentHex || currentAccent, safeCard);
        currentHighlight = ensureContrast(highlightHex || currentHighlight, safeCard);
        const readableText = readableTextAcross(safeSurface, safeCard);
        const requestedMuted = ensureContrast(isLight ? '#475569' : '#A8A395', safeSurface);
        const readableMuted = Math.min(contrastRatio(requestedMuted, safeSurface), contrastRatio(requestedMuted, safeCard)) >= 4.5
            ? requestedMuted
            : readableText;
        const safeRgb = hexToRgb(currentPrimary);
        const end = currentPrimaryEnd;

        root.style.setProperty('--primary', currentPrimary);
        root.style.setProperty('--primary-rgb', `${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}`);
        root.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${currentPrimary} 0%, ${end} 100%)`);
        root.style.setProperty('--primary-glow', `rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.22)`);
        root.style.setProperty('--border-accent', `rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.55)`);
        root.style.setProperty('--shadow-glow', `0 12px 35px -8px rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.3)`);
        root.style.setProperty('--shadow-premium', isLight
            ? `0 20px 45px -12px rgba(15, 23, 42, 0.1), 0 0 20px rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.11)`
            : `0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 18px rgba(${safeRgb.r}, ${safeRgb.g}, ${safeRgb.b}, 0.12)`);
        if (!window.matchMedia?.('(pointer: coarse)').matches) {
            const pointer = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M4 3L20 12L12 15L9 23L4 3Z" fill="${currentPrimary}" stroke="${onPrimary}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
            const clicked = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M4 3L20 12L12 15L9 23L4 3Z" fill="${currentAccent}" stroke="${onPrimary}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="15" r="2" fill="${onPrimary}"/></svg>`;
            root.style.setProperty('--cursor-pointer', `url("data:image/svg+xml,${encodeURIComponent(pointer)}") 4 3, pointer`);
            root.style.setProperty('--cursor-clicked', `url("data:image/svg+xml,${encodeURIComponent(clicked)}") 4 3, pointer`);
        }
        root.style.setProperty('--card-bg', safeCard);
        root.style.setProperty('--card-bg-hover', adjustBrightness(safeCard, isLight ? 0.97 : 1.12));
        root.style.setProperty('--bg-dark', safeSurface);
        root.style.setProperty('--input-bg', mixSurface(safeCard, safeSurface, 0.35));
        root.style.setProperty('--text-main', readableText);
        root.style.setProperty('--text-muted', readableMuted);
        root.style.setProperty('--on-primary', onPrimary);

        // Keep financial status colors distinct while deriving the surrounding
        // metric palette from the wallpaper colors. A green custom accent must
        // not make outflows look positive, so red remains the semantic danger.
        const metricColors = {
            inflow: ensureContrast(currentHighlight, safeCard),
            outflow: ensureContrast(isLight ? '#B91C1C' : '#F87171', safeCard),
            netflow: ensureContrast(currentPrimary, safeCard),
            savings: ensureContrast(currentPrimaryEnd, safeCard),
            subs: ensureContrast(currentAccent, safeCard),
        };
        Object.entries(metricColors).forEach(([name, color]) => {
            const rgb = hexToRgb(color);
            root.style.setProperty(`--metric-${name}`, color);
            root.style.setProperty(`--metric-${name}-rgb`, `${rgb.r}, ${rgb.g}, ${rgb.b}`);
            root.style.setProperty(`--metric-${name}-glow`, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
        });
        root.style.setProperty('--metric-subs-text', metricColors.subs);
        root.style.setProperty('--success', metricColors.inflow);
        root.style.setProperty('--success-rgb', hexToRgb(metricColors.inflow).r + ', ' + hexToRgb(metricColors.inflow).g + ', ' + hexToRgb(metricColors.inflow).b);
        root.style.setProperty('--warning', metricColors.savings);
        root.style.setProperty('--danger', metricColors.outflow);

        if (accentHex) {
            const accRgb = hexToRgb(currentAccent);
            root.style.setProperty('--accent', currentAccent);
            root.style.setProperty('--accent-rgb', `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);
            root.style.setProperty('--accent-glow', `rgba(${accRgb.r}, ${accRgb.g}, ${accRgb.b}, 0.25)`);
            root.style.setProperty('--accent-text', currentAccent);
        }

        if (highlightHex) {
            const hlRgb = hexToRgb(currentHighlight);
            root.style.setProperty('--highlight', currentHighlight);
            root.style.setProperty('--highlight-rgb', `${hlRgb.r}, ${hlRgb.g}, ${hlRgb.b}`);
        }
    }

    function applyAtmosphere(type, uri, opacity, blur) {
        const bgs = document.querySelectorAll('.hero-bg, .auth-hero-bg');
        if (!bgs.length) return;

        bgs.forEach(heroBg => {
            if (type === 'none') {
                heroBg.style.backgroundImage = 'none';
                heroBg.style.filter = 'none';
            } else if (type === 'custom' && uri) {
                const tint = document.documentElement.getAttribute('data-theme') === 'light' ? '255, 255, 255' : '0, 0, 0';
                heroBg.style.backgroundImage = `linear-gradient(rgba(${tint}, ${opacity}), rgba(${tint}, ${opacity})), url("${uri}")`;
                heroBg.style.backgroundSize = 'cover';
                heroBg.style.backgroundPosition = 'center';
                // Keep the image fully opaque so the old ambient background does
                // not show through; opacity controls only the tint layer above it.
                heroBg.style.opacity = '1';
                heroBg.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
            } else {
                // Preset / default ambient gradients
                heroBg.style.backgroundImage = '';
                heroBg.style.opacity = '1';
                heroBg.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
            }
        });
    }

    // Immediate zero-flicker application on script load
    applyTypography(currentFontChoice, currentCustomFontFamily, currentCustomFontData);
    applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight);
    applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);

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
                applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight);
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
        } catch (err) {
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
                            <h3 id="studioModalTitle" style="margin:0; font-size:17px; font-weight:700;">Studio & Appearance</h3>
                            <p style="margin:2px 0 0; font-size:12px; color:var(--text-muted);">Personalize typography, live colors, and cross-device theme sync</p>
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
                        <div class="studio-wallpaper-input-row" style="margin-bottom:10px;">
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
                                <div class="studio-font-title" style="font-family:'Hanken Grotesk', sans-serif;">Hanken Grotesk</div>
                                <div class="studio-font-sample">Modern neo-grotesque Swiss sans-serif for sharp financial readouts.</div>
                            </div>
                            <div class="studio-font-card" data-font="fraunces">
                                <div class="studio-font-title" style="font-family:'Fraunces', serif;">Fraunces Luxury Serif</div>
                                <div class="studio-font-sample">Refined editorial serif evoking bespoke private wealth ledgers.</div>
                            </div>
                            <div class="studio-font-card" data-font="mono">
                                <div class="studio-font-title" style="font-family:'IBM Plex Mono', monospace;">IBM Plex Mono</div>
                                <div class="studio-font-sample">Technical terminal tabular precision for quantitative analysis.</div>
                            </div>
                            <div class="studio-font-card" data-font="system">
                                <div class="studio-font-title" style="font-family:system-ui, sans-serif;">Native System UI</div>
                                <div class="studio-font-sample">Clean zero-latency native operating system font stack (San Francisco / Segoe).</div>
                            </div>
                        </div>

                        <span class="studio-section-label">Import Outsourced Font (.ttf / .otf / .woff2)</span>
                        <div class="studio-font-upload-box" id="studioFontDropzone">
                            <input type="file" id="studioFontFileInput" accept=".ttf,.otf,.woff,.woff2" style="display:none;">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <h4>Drop your font file here or click to browse</h4>
                            <p>Upload any outsourced brand font (.ttf, .otf, .woff2) to apply across the system</p>
                            <div id="studioCustomFontStatus" style="display:none;"></div>
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
                        <div class="studio-target-chips" style="margin-bottom:16px;">
                            <button type="button" class="studio-target-chip active" id="bgModePreset">Ambient Gradients</button>
                            <button type="button" class="studio-target-chip" id="bgModeCustom">Custom Image URL</button>
                            <button type="button" class="studio-target-chip" id="bgModeNone">Clean Minimal</button>
                        </div>

                        <div id="studioCustomWallpaperGroup" style="display:none; margin-bottom:20px;">
                            <label class="studio-section-label" for="studioWallpaperUrlInput">Wallpaper Image URL or File</label>
                            <div class="studio-wallpaper-input-row">
                                <input type="url" id="studioWallpaperUrlInput" class="studio-wallpaper-field" placeholder="Paste image URL (https://...) or choose Browse">
                                <button type="button" class="btn-secondary" id="studioLoadWallpaperUrlBtn">Load & Extract</button>
                                <button type="button" class="btn-secondary" id="studioBrowseWallpaperBtn">Browse File</button>
                                <input type="file" id="studioWallpaperFileInput" accept="image/*" style="display:none;">
                            </div>
                            <p class="studio-crop-instructions">Drag across the image to select an area. Drag inside the selection to move it; use the corner handle to resize.</p>
                            <div class="studio-crop-frame" id="studioCropFrame" aria-label="Select wallpaper crop area" hidden>
                                <img id="studioCropPreviewImage" alt="Image crop preview">
                                <div class="studio-crop-selection" id="studioCropSelection" aria-hidden="true">
                                    <span class="studio-crop-resize-handle"></span>
                                </div>
                            </div>
                            <button type="button" class="btn-secondary" id="studioApplyCropBtn" disabled>Apply Crop & Extract Palette</button>
                            <span class="studio-section-label" style="margin-top:12px;">Extracted Image Colors · Tap to apply to the selected target</span>
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
                        <button type="button" class="btn-primary" id="studioSaveSyncBtn">Save & Sync</button>
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
                    data-color="${color}" style="background-color: ${color};" title="${color}"></button>
            `).join('');

            swatchesGrid.querySelectorAll('.studio-swatch-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const color = btn.getAttribute('data-color');
                    applyColorChange(color);
                });
            });
        }

        // Render Presets
        if (presetsGrid) {
            presetsGrid.innerHTML = STUDIO_PRESETS.map(p => `
                <div class="studio-preset-card ${p.id === currentPresetId ? 'active' : ''}" data-preset-id="${p.id}">
                    <div class="studio-preset-dots">
                        <span class="studio-preset-dot" style="background:${p.primary};"></span>
                        <span class="studio-preset-dot" style="background:${p.accent};"></span>
                        <span class="studio-preset-dot" style="background:${p.highlight};"></span>
                    </div>
                    <div class="studio-preset-name">${p.name}</div>
                    <div class="studio-preset-sub">${p.subtitle}</div>
                </div>
            `).join('');

            presetsGrid.querySelectorAll('.studio-preset-card').forEach(card => {
                card.addEventListener('click', () => {
                    const presetId = card.getAttribute('data-preset-id');
                    const preset = STUDIO_PRESETS.find(x => x.id === presetId);
                    if (!preset) return;

                    currentPresetId = preset.id;
                    currentPrimary = preset.primary;
                    currentPrimaryEnd = preset.primaryGradientEnd;
                    currentAccent = preset.accent;
                    currentHighlight = preset.highlight;
                    currentCardSurface = preset.cardSurface;
                    currentAppSurface = preset.surface;

                    applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight);
                    syncUiControls();
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

            applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight);
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
                applyTypography(currentFontChoice, currentCustomFontFamily, currentCustomFontData);
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
            applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
        });

        blurSlider?.addEventListener('input', (e) => {
            const val = Number(e.target.value);
            currentBlurIntensity = val;
            if (blurValue) blurValue.textContent = `${val}px`;
            applyAtmosphere(currentWallpaperType, currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
        });

        // Atmosphere Mode Toggles
        bgModePreset?.addEventListener('click', () => {
            currentWallpaperType = 'preset';
            syncAtmosphereMode();
            applyAtmosphere('preset', currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
        });

        bgModeCustom?.addEventListener('click', () => {
            currentWallpaperType = 'custom';
            syncAtmosphereMode();
            applyAtmosphere('custom', currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
        });

        bgModeNone?.addEventListener('click', () => {
            currentWallpaperType = 'none';
            syncAtmosphereMode();
            applyAtmosphere('none', '', 0, 0);
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
                        `<button type="button" class="studio-extracted-swatch" data-extracted-color="${color}" title="Apply ${color} to the selected color target"><i style="background:${color}"></i>Color ${index + 1} <code>${color}</code></button>`
                    ).join('');
                    extractedPaletteView.querySelectorAll('[data-extracted-color]').forEach((swatch) => {
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
                if (wallpaperUrlInput) wallpaperUrlInput.value = 'Local Image File';
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
                <div class="studio-preset-dots"><span class="studio-preset-dot" style="background:${profile.primary}"></span><span class="studio-preset-dot" style="background:${profile.accent}"></span><span class="studio-preset-dot" style="background:${profile.highlight}"></span></div>
                <div class="studio-preset-name">${String(profile.name).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</div>
                <div class="studio-preset-sub"><button type="button" data-action="apply">Apply</button> <button type="button" data-action="edit">Edit</button> <button type="button" data-action="delete">Delete</button></div>
            </div>`).join('') || '<small>No saved profiles yet.</small>';
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
        resetBtn?.addEventListener('click', () => {
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

            applyTypography('grotesk', null, null);
            applyPalette(currentPrimary, currentPrimaryEnd, currentAccent, currentHighlight);
            applyAtmosphere('preset', '', 0.35, 0);
            syncUiControls();
            void saveAppearanceToCloud();
        });

        // Save & Sync to Cloud
        saveSyncBtn?.addEventListener('click', () => {
            if (wallpaperLoadPending) {
                if (wallpaperStatus) wallpaperStatus.textContent = 'Wait for the image and palette to finish loading before saving.';
                return;
            }
            const enteredWallpaperUrl = wallpaperUrlInput?.value.trim();
            if (currentWallpaperType === 'custom' && /^https?:\/\//i.test(enteredWallpaperUrl || '') && enteredWallpaperUrl !== wallpaperSourceUri) {
                if (wallpaperStatus) wallpaperStatus.textContent = 'Load & extract this image URL before saving the wallpaper.';
                return;
            }
            // Save local cache
            localStorage.setItem('app_font_choice', currentFontChoice);
            if (currentCustomFontFamily) localStorage.setItem('app_custom_font_family', currentCustomFontFamily);
            if (currentCustomFontData) localStorage.setItem('app_custom_font_data', currentCustomFontData);
            localStorage.setItem('app_custom_palette', JSON.stringify({
                primary: currentPrimary,
                primaryGradientEnd: currentPrimaryEnd,
                accent: currentAccent,
                highlight: currentHighlight,
                cardSurface: currentCardSurface,
                surface: currentAppSurface
            }));
            localStorage.setItem('app_bg_asset', JSON.stringify({
                type: currentWallpaperType,
                presetId: currentPresetId,
                uri: currentWallpaperUri,
                overlayOpacity: currentOverlayOpacity,
                blurIntensity: currentBlurIntensity
            }));

            void saveAppearanceToCloud();
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
                wallpaperUrlInput.value = currentWallpaperType === 'custom'
                    ? (currentWallpaperUri.startsWith('data:') ? 'Local Image File' : currentWallpaperUri)
                    : '';
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
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStudioController);
    } else {
        initStudioController();
    }

    // Expose API to window
    window.WebStudio = {
        fetchAppearanceFromCloud,
        saveAppearanceToCloud,
        applyTypography,
        applyPalette,
        applyAtmosphere,
    };

})();
