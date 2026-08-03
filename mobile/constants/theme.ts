/**
 * Shared design tokens for the mobile app — the "Ledger" identity.
 *
 * Mirrors frontend/css/style.css's CSS variables so the web and mobile
 * apps stay visually consistent. Previously colors were hardcoded per-file
 * across ~10 screens with no single source of truth; this file replaces that.
 *
 * Palette logic: grounded in real ledgers/receipts/ink stamps, not generic
 * fintech blue. Gold is restrained to CTAs/brand marks. Debits render in
 * oxblood ("in the red"); credits/neutral amounts use plain ink ("in the
 * black") rather than a separate green.
 */

export type ThemeName = 'dark' | 'light';

export interface ThemeColors {
    bg: string;
    surface: string;
    surfaceHover: string;
    border: string;
    borderAccent: string;
    ink: string;
    inkDim: string;
    gold: string;
    goldGradientEnd: string;
    oxblood: string;
    teal: string;
    sage: string;
    warning: string;
}

export const Colors: Record<ThemeName, ThemeColors> = {
    dark: {
        bg: '#10120E',
        surface: '#171A14',
        surfaceHover: '#1D2117',
        border: 'rgba(236, 231, 216, 0.08)',
        borderAccent: 'rgba(199, 154, 62, 0.35)',
        ink: '#ECE7D8',
        inkDim: '#A8A395',
        gold: '#C79A3E',
        goldGradientEnd: '#A97F2E',
        oxblood: '#A23E32',
        teal: '#4C7A78',
        sage: '#5B8C5A',
        warning: '#C9932E',
    },
    light: {
        bg: '#EDEAE0',
        surface: '#FCFBF6',
        surfaceHover: '#F5F2E9',
        border: '#DAD4C1',
        borderAccent: 'rgba(156, 118, 35, 0.4)',
        ink: '#1E1B15',
        inkDim: '#6B6558',
        gold: '#9C7623',
        goldGradientEnd: '#7C5E1B',
        oxblood: '#8F3327',
        teal: '#3E645F',
        sage: '#4A7249',
        warning: '#A97722',
    },
};

/**
 * Curated ink/stamp category palette — replaces an 8-color rainbow
 * (teal/blue/coral/amber/purple/pink/teal/sky-blue) with muted, intentional
 * tones. Same values as CATEGORY_PALETTE in frontend/js/dashboard.js.
 */
export const CategoryPalette = [
    { bg: 'rgba(199,154,62,0.12)', color: '#C79A3E' }, // gold
    { bg: 'rgba(162,62,50,0.12)', color: '#A23E32' },  // oxblood
    { bg: 'rgba(76,122,120,0.12)', color: '#4C7A78' }, // teal
    { bg: 'rgba(91,140,90,0.12)', color: '#5B8C5A' },  // sage
    { bg: 'rgba(139,94,52,0.12)', color: '#8B5E34' },  // umber
    { bg: 'rgba(176,107,92,0.12)', color: '#B06B5C' }, // terracotta
    { bg: 'rgba(201,147,46,0.12)', color: '#C9932E' }, // mustard
    { bg: 'rgba(107,114,128,0.12)', color: '#6B7280' },// slate
];

export function getCategoryColor(name: string | undefined | null) {
    if (!name) return CategoryPalette[0];
    const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % CategoryPalette.length;
    return CategoryPalette[idx];
}

/**
 * Font family names as registered with useFonts() in app/_layout.tsx.
 * Three roles, same as web: display (serif, used sparingly for big
 * balance numbers), body (UI text), mono (every other amount/date, tabular).
 */
export const Fonts = {
    display: 'Fraunces_500Medium',
    displaySemiBold: 'Fraunces_600SemiBold',
    body: 'HankenGrotesk_400Regular',
    bodyMedium: 'HankenGrotesk_500Medium',
    bodySemiBold: 'HankenGrotesk_600SemiBold',
    bodyBold: 'HankenGrotesk_700Bold',
    mono: 'IBMPlexMono_400Regular',
    monoMedium: 'IBMPlexMono_500Medium',
    monoSemiBold: 'IBMPlexMono_600SemiBold',
};
