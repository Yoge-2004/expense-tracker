/*
 * Theme performance guard & Universal Appearance Engine.
 *
 * The dashboard and admin command centers can contain large ledgers and data streams.
 * A theme or appearance toggle changes shared CSS variables, so animating every matching node
 * at the same time creates a large paint/compositing burst. We make the theme swap atomic:
 * transitions are suppressed during the switch frame window, then normal motion resumes.
 *
 * In addition, this module immediately applies customizable background atmosphere,
 * typography, and color palette tokens across all pages and screens on the website.
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
        if (!hex) return { r: 199, g: 154, b: 62 };
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
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

            // 1. Palette
            const rawPal = localStorage.getItem('et_appearance_palette');
            if (rawPal) {
                const pal = JSON.parse(rawPal);
                if (pal && pal.primary) {
                    const rgb = hexToRgb(pal.primary);
                    const end = pal.primaryGradientEnd || pal.primary;
                    root.style.setProperty('--primary', pal.primary);
                    root.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
                    root.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${pal.primary} 0%, ${end} 100%)`);
                    root.style.setProperty('--primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`);
                    root.style.setProperty('--border-accent', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
                    if (pal.accent) {
                        const accRgb = hexToRgb(pal.accent);
                        root.style.setProperty('--accent', pal.accent);
                        root.style.setProperty('--accent-rgb', `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);
                        root.style.setProperty('--accent-glow', `rgba(${accRgb.r}, ${accRgb.g}, ${accRgb.b}, 0.25)`);
                        root.style.setProperty('--metric-outflow', pal.accent);
                    }
                    if (pal.highlight) {
                        const hlRgb = hexToRgb(pal.highlight);
                        root.style.setProperty('--highlight', pal.highlight);
                        root.style.setProperty('--highlight-rgb', `${hlRgb.r}, ${hlRgb.g}, ${hlRgb.b}`);
                    }
                }
            }

            // 2. Typography
            const fontChoice = localStorage.getItem('et_appearance_font') || 'grotesk';
            const customFamily = localStorage.getItem('et_appearance_custom_font_family');
            const customData = localStorage.getItem('et_appearance_custom_font_data');
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
            const wpType = localStorage.getItem('et_appearance_wallpaper_type') || 'preset';
            const wpUri = localStorage.getItem('et_appearance_wallpaper_uri') || '';
            const opacity = parseFloat(localStorage.getItem('et_appearance_overlay_opacity') || '0.35');
            const blur = parseInt(localStorage.getItem('et_appearance_blur_intensity') || '0', 10);

            const applyBg = () => {
                const bgs = document.querySelectorAll('.hero-bg, .auth-hero-bg');
                bgs.forEach(heroBg => {
                    if (wpType === 'none') {
                        heroBg.style.backgroundImage = 'none';
                        heroBg.style.filter = 'none';
                    } else if (wpType === 'custom' && wpUri) {
                        heroBg.style.backgroundImage = `url("${wpUri}")`;
                        heroBg.style.backgroundSize = 'cover';
                        heroBg.style.backgroundPosition = 'center';
                        heroBg.style.opacity = `${opacity}`;
                        heroBg.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
                    } else {
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
    }

    if (typeof document !== "undefined") {
        // Capture phase runs before the existing theme button listener in api.js.
        document.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const toggle = target?.closest("#themeToggle, .theme-toggle-btn");
            if (toggle) beginThemeSwitch();
        }, true);

        // Programmatic theme changes also get the same guard.
        document.addEventListener("themechange", () => {
            beginThemeSwitch();
        });

        // Re-apply on custom appearancechange events
        document.addEventListener("appearancechange", () => {
            restoreStoredAppearance();
        });
    }
})();
