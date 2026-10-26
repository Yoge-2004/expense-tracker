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

    function isValidHex(hex) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
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

    let currentWallpaperType = 'preset';
    let currentWallpaperUri = '';
    let currentOverlayOpacity = 0.35;
    let currentBlurIntensity = 0;

    let activeColorTarget = 'primary'; // 'primary' | 'accent' | 'highlight'

    // Try reading cached custom palette
    try {
        const savedPalette = localStorage.getItem('app_custom_palette');
        if (savedPalette) {
            const parsed = JSON.parse(savedPalette);
            if (parsed.primary) currentPrimary = parsed.primary;
            if (parsed.primaryGradientEnd) currentPrimaryEnd = parsed.primaryGradientEnd;
            if (parsed.accent) currentAccent = parsed.accent;
            if (parsed.highlight) currentHighlight = parsed.highlight;
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
            } else {
                root.style.setProperty('--font-sans', `"${customFamily}", sans-serif`);
                root.style.setProperty('--font-body', `"${customFamily}", sans-serif`);
                root.style.setProperty('--font-main', `"${customFamily}", sans-serif`);
            }
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
        const rgb = hexToRgb(primaryHex);
        const end = primaryEndHex || adjustBrightness(primaryHex, 0.85);

        root.style.setProperty('--primary', primaryHex);
        root.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        root.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${primaryHex} 0%, ${end} 100%)`);
        root.style.setProperty('--primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`);
        root.style.setProperty('--border-accent', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);

        if (accentHex) {
            const accRgb = hexToRgb(accentHex);
            root.style.setProperty('--accent', accentHex);
            root.style.setProperty('--accent-rgb', `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);
            root.style.setProperty('--accent-glow', `rgba(${accRgb.r}, ${accRgb.g}, ${accRgb.b}, 0.25)`);
            root.style.setProperty('--metric-outflow', accentHex);
        }

        if (highlightHex) {
            const hlRgb = hexToRgb(highlightHex);
            root.style.setProperty('--highlight', highlightHex);
            root.style.setProperty('--highlight-rgb', `${hlRgb.r}, ${hlRgb.g}, ${hlRgb.b}`);
        }
    }

    function applyAtmosphere(type, uri, opacity, blur) {
        const heroBg = document.querySelector('.hero-bg');
        if (!heroBg) return;

        if (type === 'none') {
            heroBg.style.backgroundImage = 'none';
            heroBg.style.filter = 'none';
            return;
        }

        if (type === 'custom' && uri) {
            heroBg.style.backgroundImage = `url("${uri}")`;
            heroBg.style.backgroundSize = 'cover';
            heroBg.style.backgroundPosition = 'center';
            heroBg.style.opacity = `${opacity}`;
            heroBg.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
        } else {
            // Preset / default ambient gradients
            heroBg.style.backgroundImage = '';
            heroBg.style.opacity = `${opacity}`;
            heroBg.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
        }
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
                currentPresetId = remote.presetId || currentPresetId;
                localStorage.setItem('app_custom_palette', JSON.stringify({
                    primary: currentPrimary,
                    primaryGradientEnd: currentPrimaryEnd,
                    accent: currentAccent,
                    highlight: currentHighlight
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
            cardSurface: 'rgba(23, 26, 20, 0.88)',
            surface: '#171A14',
            borderAccent: `rgba(${hexToRgb(currentPrimary).r}, ${hexToRgb(currentPrimary).g}, ${hexToRgb(currentPrimary).b}, 0.35)`,
            wallpaperType: currentWallpaperType,
            wallpaperUri: currentWallpaperUri,
            overlayOpacity: currentOverlayOpacity,
            blurIntensity: currentBlurIntensity
        };

        try {
            if (userId && typeof window.apiRequest === 'function') {
                await window.apiRequest(`/users/${userId}/appearance`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            }
            if (syncDot) syncDot.classList.remove('syncing');
            if (syncText) syncText.textContent = 'Synced with Cloud';
            if (typeof window.showToast === 'function') {
                window.showToast('Studio appearance synced across all devices!', 'success');
            }
        } catch (err) {
            if (syncDot) syncDot.classList.remove('syncing');
            if (syncText) syncText.textContent = 'Saved locally (offline)';
            if (typeof window.showToast === 'function') {
                window.showToast('Saved locally. Will sync when online.', 'info');
            }
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
                                <button type="button" class="btn-secondary" id="studioBrowseWallpaperBtn">Browse File</button>
                                <input type="file" id="studioWallpaperFileInput" accept="image/*" style="display:none;">
                            </div>
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
                        <button type="button" class="btn-primary" id="studioSaveSyncBtn">Save & Sync to Cloud</button>
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
            currentWallpaperUri = e.target.value.trim();
            if (currentWallpaperType === 'custom') {
                applyAtmosphere('custom', currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
            }
        });

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
                currentWallpaperUri = dataUrl;
                currentWallpaperType = 'custom';
                if (wallpaperUrlInput) wallpaperUrlInput.value = 'Local Image File';
                syncAtmosphereMode();
                applyAtmosphere('custom', currentWallpaperUri, currentOverlayOpacity, currentBlurIntensity);
            };
            reader.readAsDataURL(file);
        });

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
            // Save local cache
            localStorage.setItem('app_font_choice', currentFontChoice);
            if (currentCustomFontFamily) localStorage.setItem('app_custom_font_family', currentCustomFontFamily);
            if (currentCustomFontData) localStorage.setItem('app_custom_font_data', currentCustomFontData);
            localStorage.setItem('app_custom_palette', JSON.stringify({
                primary: currentPrimary,
                primaryGradientEnd: currentPrimaryEnd,
                accent: currentAccent,
                highlight: currentHighlight
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

        function syncUiControls() {
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
            if (wallpaperUrlInput && currentWallpaperUri && !currentWallpaperUri.startsWith('data:')) {
                wallpaperUrlInput.value = currentWallpaperUri;
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
