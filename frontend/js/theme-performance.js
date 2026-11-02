/*
 * Theme performance guard & Universal Appearance Engine.
 *
 * Ensures theme transitions are atomic, prevents paint/compositing bursts,
 * and universally synchronizes customizable color palette, atmosphere, typography,
 * outlines, shadows, and theme-adaptive cursor across all pages and modes.
 */
(function () {
    "use strict";

    const THEME_SWITCH_CLASS = "theme-switching";
    let switchTimer = null;

    function beginThemeSwitch() {
        document.documentElement.classList.add(THEME_SWITCH_CLASS);
        clearTimeout(switchTimer);
        switchTimer = setTimeout(() => {
            document.documentElement.classList.remove(THEME_SWITCH_CLASS);
        }, 250);
    }

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
        let c = String(hex).replace('#', '').trim();
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        if (isNaN(num) || c.length !== 6) return { r: 16, g: 24, b: 20 };
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    function luminance(hex) {
        const { r, g, b } = hexToRgb(hex);
        const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function contrastRatio(hex1, hex2) {
        const l1 = luminance(hex1);
        const l2 = luminance(hex2);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    function adjustBrightness(color, factor) {
        const rgb = hexToRgb(color);
        const r = Math.min(255, Math.max(0, Math.round(rgb.r * factor)));
        const g = Math.min(255, Math.max(0, Math.round(rgb.g * factor)));
        const b = Math.min(255, Math.max(0, Math.round(rgb.b * factor)));
        const alphaMatch = String(color || '').match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/i);
        if (alphaMatch) {
            return `rgba(${r}, ${g}, ${b}, ${alphaMatch[1]})`;
        }
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    function updateThemeCursor(primaryColor, accentColor, isLightMode) {
        if (typeof window === "undefined" || !document || !document.documentElement) return;
        if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
        try {
            const p = encodeURIComponent(primaryColor || (isLightMode ? "#0284C7" : "#10B981"));
            const a = encodeURIComponent(accentColor || (isLightMode ? "#4F46E5" : "#34D399"));
            const strokeColor = encodeURIComponent(isLightMode ? "#0F172A" : "#FFFFFF");
            const dotFill = encodeURIComponent(isLightMode ? "#FFFFFF" : "#FFFFFF");

            const defCursor = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28' fill='none'><path d='M4 3L20 11L12 14L9 22L4 3Z' fill='${p}' stroke='${strokeColor}' stroke-width='1.5' stroke-linejoin='round'/><circle cx='4' cy='3' r='1.5' fill='${dotFill}'/></svg>`;
            const ptrCursor = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28' fill='none'><path d='M4 3L18 10L11 13L8 20L4 3Z' fill='${p}' stroke='${strokeColor}' stroke-width='1.5' stroke-linejoin='round'/><circle cx='11' cy='13' r='2' fill='${dotFill}'/></svg>`;
            const txtCursor = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28' fill='none'><g stroke='${p}' stroke-width='2.2' stroke-linecap='round'><line x1='14' y1='4' x2='14' y2='24'/><line x1='9' y1='4' x2='19' y2='4'/><line x1='9' y1='24' x2='19' y2='24'/></g></svg>`;
            const clkCursor = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28' fill='none'><path d='M4 3L18 10L11 13L8 20L4 3Z' fill='${a}' stroke='${strokeColor}' stroke-width='1.6' stroke-linejoin='round'/><circle cx='11' cy='13' r='2.5' fill='${dotFill}'/></svg>`;

            const root = document.documentElement;
            root.style.setProperty("--cursor-default", `url("data:image/svg+xml,${defCursor}") 4 3, auto`);
            root.style.setProperty("--cursor-pointer", `url("data:image/svg+xml,${ptrCursor}") 4 3, pointer`);
            root.style.setProperty("--cursor-text", `url("data:image/svg+xml,${txtCursor}") 14 14, text`);
            root.style.setProperty("--cursor-clicked", `url("data:image/svg+xml,${clkCursor}") 4 3, pointer`);
        } catch (e) {}
    }

    const FONT_PRESETS = {
        grotesk: '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fraunces: '"Fraunces", Georgia, "Times New Roman", serif',
        mono: '"IBM Plex Mono", "JetBrains Mono", Consolas, monospace',
        system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    };

    function restoreStoredAppearance() {
        try {
            const root = document.documentElement;
            const isLight = root.getAttribute('data-theme') === 'light' || document.body?.getAttribute('data-theme') === 'light';

            // 1. Unified Palette Retrieval (supporting both Web Studio and Appearance Engine keys)
            const rawPal = localStorage.getItem('app_custom_palette') || localStorage.getItem('et_appearance_palette');
            let pal = null;
            if (rawPal) {
                try { pal = JSON.parse(rawPal); } catch (e) { pal = null; }
            }

            const inlineColorVars = [
                '--primary', '--primary-rgb', '--primary-gradient', '--primary-glow',
                '--border-accent', '--shadow-glow', '--shadow-premium',
                '--accent', '--accent-rgb', '--accent-glow', '--accent-text', '--accent-gradient',
                '--highlight', '--highlight-rgb', '--highlight-glow', '--highlight-gradient',
                '--text-main', '--text-muted', '--card-bg', '--card-bg-hover',
                '--bg-dark', '--input-bg', '--border', '--border-subtle', '--on-primary',
                '--metric-inflow', '--metric-outflow', '--metric-savings', '--metric-netflow', '--metric-subs',
                '--metric-inflow-rgb', '--metric-inflow-glow',
                '--metric-outflow-rgb', '--metric-outflow-glow',
                '--metric-savings-rgb', '--metric-savings-glow',
                '--metric-netflow-rgb', '--metric-netflow-glow',
                '--metric-subs-rgb', '--metric-subs-glow', '--metric-subs-text',
                '--danger', '--danger-rgb', '--danger-glow', '--danger-gradient',
                '--warning', '--warning-rgb', '--warning-glow', '--warning-gradient',
                '--success', '--success-rgb', '--success-glow', '--success-gradient',
                '--fill-subtle', '--fill-medium', '--fill-strong', '--fill-active', '--inset-bg', '--line-soft', '--on-success', '--on-warning', '--on-danger',
                '--cursor-default', '--cursor-pointer', '--cursor-text', '--cursor-clicked',
                '--palette-1', '--palette-1-rgb',
                '--palette-2', '--palette-2-rgb',
                '--palette-3', '--palette-3-rgb',
                '--palette-4', '--palette-4-rgb',
                '--palette-5', '--palette-5-rgb',
                '--palette-6', '--palette-6-rgb',
                '--palette-7', '--palette-7-rgb',
                '--palette-8', '--palette-8-rgb'
            ];

            if (!pal || !pal.primary) {
                // Default theme look: stylesheet [data-theme] rules dictate all tokens.
                inlineColorVars.forEach(v => root.style.removeProperty(v));
                updateThemeCursor(isLight ? '#0284C7' : '#10B981', isLight ? '#4F46E5' : '#34D399', isLight);
            } else {
                const primaryColor = pal.primary;
                const accentColor = pal.accent || (isLight ? '#E11D48' : '#EC4899');
                const highlightColor = pal.highlight || (isLight ? '#0284C7' : '#A855F7');
                const rgb = hexToRgb(primaryColor);
                const end = pal.primaryGradientEnd || adjustBrightness(primaryColor, isLight ? 0.88 : 0.82);
                const onPrimary = contrastRatio('#FFFFFF', primaryColor) >= contrastRatio('#0F172A', primaryColor) ? '#FFFFFF' : '#0F172A';

                root.style.setProperty('--primary', primaryColor);
                root.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
                root.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${primaryColor} 0%, ${end} 100%)`);
                root.style.setProperty('--primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isLight ? 0.20 : 0.28})`);
                root.style.setProperty('--border-accent', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isLight ? 0.45 : 0.50})`);
                root.style.setProperty('--shadow-glow', `0 12px 35px -8px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isLight ? 0.22 : 0.32})`);
                root.style.setProperty('--shadow-premium', isLight
                    ? `0 20px 45px -12px rgba(15, 23, 42, 0.10), 0 0 20px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`
                    : `0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 18px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);

                const accRgb = hexToRgb(accentColor);
                root.style.setProperty('--accent', accentColor);
                root.style.setProperty('--accent-rgb', `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);
                root.style.setProperty('--accent-glow', `rgba(${accRgb.r}, ${accRgb.g}, ${accRgb.b}, 0.25)`);
                root.style.setProperty('--accent-text', accentColor);
                root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${accentColor} 0%, ${adjustBrightness(accentColor, 0.82)} 100%)`);

                const hlRgb = hexToRgb(highlightColor);
                root.style.setProperty('--highlight', highlightColor);
                root.style.setProperty('--highlight-rgb', `${hlRgb.r}, ${hlRgb.g}, ${hlRgb.b}`);
                root.style.setProperty('--highlight-glow', `rgba(${hlRgb.r}, ${hlRgb.g}, ${hlRgb.b}, 0.22)`);
                root.style.setProperty('--highlight-gradient', `linear-gradient(135deg, ${highlightColor} 0%, ${adjustBrightness(highlightColor, 0.82)} 100%)`);

                if (isLight) {
                    root.style.setProperty('--text-main', '#0F172A');
                    root.style.setProperty('--text-muted', '#475569');
                    root.style.setProperty('--card-bg', '#FFFFFF');
                    root.style.setProperty('--card-bg-hover', '#F8FAFC');
                    root.style.setProperty('--bg-dark', '#F8F9FA');
                    root.style.setProperty('--input-bg', '#FFFFFF');
                    root.style.setProperty('--border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`);
                    root.style.setProperty('--border-subtle', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
                    root.style.setProperty('--on-primary', onPrimary);
                } else {
                    root.style.setProperty('--text-main', '#ECE7D8');
                    root.style.setProperty('--text-muted', '#A8A395');
                    const cSurf = (pal.cardSurface && !String(pal.cardSurface).toLowerCase().startsWith('#c7') && !String(pal.cardSurface).toLowerCase().startsWith('#d4'))
                        ? pal.cardSurface
                        : 'rgba(23, 26, 20, 0.90)';
                    root.style.setProperty('--card-bg', cSurf);
                    root.style.setProperty('--card-bg-hover', adjustBrightness(cSurf, 1.15));
                    root.style.setProperty('--bg-dark', pal.surface || '#10120E');
                    root.style.setProperty('--input-bg', 'rgba(10, 14, 23, 0.60)');
                    root.style.setProperty('--border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
                    root.style.setProperty('--border-subtle', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.10)`);
                    root.style.setProperty('--on-primary', onPrimary);
                }

                root.style.setProperty('--metric-inflow', isLight ? '#059669' : '#10B981');
                root.style.setProperty('--metric-inflow-rgb', isLight ? '5, 150, 105' : '16, 185, 129');
                root.style.setProperty('--metric-inflow-glow', isLight ? 'rgba(5, 150, 105, 0.15)' : 'rgba(16, 185, 129, 0.20)');
                root.style.setProperty('--metric-outflow', isLight ? '#DC2626' : '#EF4444');
                root.style.setProperty('--metric-outflow-rgb', isLight ? '220, 38, 38' : '239, 68, 68');
                root.style.setProperty('--metric-outflow-glow', isLight ? 'rgba(220, 38, 38, 0.15)' : 'rgba(239, 68, 68, 0.20)');
                root.style.setProperty('--metric-savings', isLight ? '#D97706' : '#F59E0B');
                root.style.setProperty('--metric-savings-rgb', isLight ? '217, 119, 6' : '245, 158, 11');
                root.style.setProperty('--metric-savings-glow', isLight ? 'rgba(217, 119, 6, 0.15)' : 'rgba(245, 158, 11, 0.20)');
                root.style.setProperty('--metric-netflow', primaryColor);
                root.style.setProperty('--metric-netflow-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
                root.style.setProperty('--metric-netflow-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20)`);
                root.style.setProperty('--metric-subs', accentColor);
                root.style.setProperty('--metric-subs-rgb', `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);
                root.style.setProperty('--metric-subs-glow', `rgba(${accRgb.r}, ${accRgb.g}, ${accRgb.b}, 0.20)`);
                root.style.setProperty('--metric-subs-text', accentColor);

                root.style.setProperty('--success', isLight ? '#059669' : '#10B981');
                root.style.setProperty('--success-rgb', isLight ? '5, 150, 105' : '16, 185, 129');
                root.style.setProperty('--warning', isLight ? '#D97706' : '#F59E0B');
                root.style.setProperty('--warning-rgb', isLight ? '217, 119, 6' : '245, 158, 11');
                root.style.setProperty('--danger', isLight ? '#DC2626' : '#EF4444');
                root.style.setProperty('--danger-rgb', isLight ? '220, 38, 38' : '239, 68, 68');

                if (Array.isArray(pal.paletteColors) && pal.paletteColors.length > 0) {
                    pal.paletteColors.slice(0, 8).forEach((col, i) => {
                        root.style.setProperty(`--palette-${i + 1}`, col);
                        const cRgb = hexToRgb(col);
                        root.style.setProperty(`--palette-${i + 1}-rgb`, `${cRgb.r}, ${cRgb.g}, ${cRgb.b}`);
                    });
                }

                updateThemeCursor(primaryColor, accentColor, isLight);
            }

            // 2. Typography
            const fontChoice = localStorage.getItem('app_font_choice') || localStorage.getItem('et_appearance_font') || 'grotesk';
            const customFamily = localStorage.getItem('app_custom_font_family') || localStorage.getItem('et_appearance_custom_font_family');
            const customData = localStorage.getItem('app_custom_font_data') || localStorage.getItem('et_appearance_custom_font_data');
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
                        }).catch(() => {});
                    } catch (e) {}
                } else {
                    root.style.setProperty('--font-sans', `"${customFamily}", sans-serif`);
                    root.style.setProperty('--font-body', `"${customFamily}", sans-serif`);
                    root.style.setProperty('--font-main', `"${customFamily}", sans-serif`);
                    root.style.setProperty('--font-display', `"${customFamily}", sans-serif`);
                }
            } else if (FONT_PRESETS[fontChoice]) {
                const fontCss = FONT_PRESETS[fontChoice];
                root.style.setProperty('--font-sans', fontCss);
                root.style.setProperty('--font-body', fontCss);
                root.style.setProperty('--font-main', fontCss);
                root.style.setProperty('--font-display', fontCss);
            }

            // 3. Atmosphere / Wallpaper
            let wpType = 'preset';
            let wpUri = '';
            let opacity = 0.35;
            let blur = 0;

            const savedBg = localStorage.getItem('app_bg_asset') || localStorage.getItem('et_appearance_bg');
            if (savedBg) {
                try {
                    const parsedBg = JSON.parse(savedBg);
                    if (parsedBg.type) wpType = parsedBg.type;
                    if (parsedBg.uri) wpUri = parsedBg.uri;
                    if (typeof parsedBg.overlayOpacity === 'number') opacity = parsedBg.overlayOpacity;
                    if (typeof parsedBg.blurIntensity === 'number') blur = parsedBg.blurIntensity;
                } catch (e) {}
            } else {
                wpType = localStorage.getItem('et_appearance_wallpaper_type') || 'preset';
                wpUri = localStorage.getItem('et_appearance_wallpaper_uri') || '';
                opacity = parseFloat(localStorage.getItem('et_appearance_overlay_opacity') || '0.35');
                blur = parseInt(localStorage.getItem('et_appearance_blur_intensity') || '0', 10);
            }

            const applyBg = () => {
                const bgs = document.querySelectorAll('.hero-bg, .auth-hero-bg');
                const hasCustom = wpType === 'custom' && Boolean(wpUri);
                if (hasCustom) {
                    document.body?.classList.add('has-custom-wallpaper');
                    root.style.setProperty('--card-bg', isLight ? 'rgba(255, 255, 255, 0.76)' : 'rgba(23, 26, 20, 0.74)');
                    root.style.setProperty('--card-bg-hover', isLight ? 'rgba(255, 255, 255, 0.86)' : 'rgba(32, 36, 28, 0.84)');
                } else {
                    document.body?.classList.remove('has-custom-wallpaper');
                    if (isLight) {
                        root.style.setProperty('--card-bg', '#FFFFFF');
                        root.style.setProperty('--card-bg-hover', '#F8FAFC');
                    } else if (pal && pal.cardSurface) {
                        root.style.setProperty('--card-bg', pal.cardSurface);
                        root.style.setProperty('--card-bg-hover', adjustBrightness(pal.cardSurface, 1.15));
                    }
                }
                bgs.forEach(heroBg => {
                    if (wpType === 'none') {
                        heroBg.style.setProperty('background-image', 'none', 'important');
                        heroBg.style.filter = 'none';
                    } else if (hasCustom) {
                        const tint = isLight ? '255, 255, 255' : '0, 0, 0';
                        const bgRule = `linear-gradient(rgba(${tint}, ${opacity}), rgba(${tint}, ${opacity})), url("${wpUri}")`;
                        heroBg.style.setProperty('background-image', bgRule, 'important');
                        heroBg.style.setProperty('background-size', 'cover', 'important');
                        heroBg.style.setProperty('background-position', 'center', 'important');
                        heroBg.style.setProperty('background-repeat', 'no-repeat', 'important');
                        heroBg.style.setProperty('opacity', '1', 'important');
                        heroBg.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
                        root.style.setProperty('--custom-wallpaper-bg', bgRule);
                    } else {
                        root.style.removeProperty('--custom-wallpaper-bg');
                        heroBg.style.backgroundImage = '';
                        heroBg.style.opacity = `${opacity}`;
                        heroBg.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
                    }
                });
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', applyBg);
            } else {
                applyBg();
            }
        } catch (e) {}
    }

    // Apply appearance immediately
    restoreStoredAppearance();

    if (typeof window !== "undefined") {
        window.beginThemeSwitch = beginThemeSwitch;
        window.restoreStoredAppearance = restoreStoredAppearance;
        window.updateThemeCursor = updateThemeCursor;
    }

    if (typeof document !== "undefined") {
        // Capture phase runs before the existing theme button listener in api.js.
        document.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const toggle = target?.closest("#themeToggle, .theme-toggle-btn");
            if (toggle) {
                beginThemeSwitch();
                setTimeout(restoreStoredAppearance, 10);
            }
        }, true);

        // Programmatic theme changes also get the same guard.
        document.addEventListener("themechange", () => {
            beginThemeSwitch();
            restoreStoredAppearance();
        });

        // Re-apply on custom appearancechange or palettechange events
        document.addEventListener("appearancechange", restoreStoredAppearance);
        document.addEventListener("palettechange", restoreStoredAppearance);

        if (typeof MutationObserver !== "undefined") {
            new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.type === "attributes" && m.attributeName === "data-theme") {
                        restoreStoredAppearance();
                        break;
                    }
                }
            }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        }

        window.addEventListener("storage", (e) => {
            if (e.key === 'app_custom_palette' || e.key === 'et_appearance_palette' ||
                e.key === 'app_bg_asset' || e.key === 'et_appearance_bg' ||
                e.key === 'app_font_choice' || e.key === 'et_appearance_font') {
                restoreStoredAppearance();
            }
        });
    }
})();
