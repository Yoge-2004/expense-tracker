/**
 * Shared design tokens for the mobile app — Ledger & Lumina identity.
 *
 * Mirrors frontend/css/style.css and motion-extended.css CSS variables so the web and mobile
 * apps stay 100% visually and functionally consistent.
 */

export type ThemeName = 'dark' | 'light';

export interface ThemeColors {
  bg: string;
  card: string;
  cardHover: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderAccent: string;
  ink: string;
  inkDim: string;
  text: string;
  textMuted: string;
  inputBg: string;
  inputBorder: string;
  primary: string;
  primaryGradientEnd: string;
  accent: string;
  highlight: string;
  success: string;
  warning: string;
  gold: string;
  oxblood: string;
  teal: string;
  sage: string;
  trackBg: string;
  cardTotalBg: string;
  cardTotalBorder: string;
  cardCountBg: string;
  cardCountBorder: string;
}

export const Colors: Record<ThemeName, ThemeColors> = {
  dark: {
    bg: '#10120E',
    card: 'rgba(23, 26, 20, 0.88)',
    cardHover: '#1D2117',
    surface: '#171A14',
    surfaceHover: '#1D2117',
    border: 'rgba(236, 231, 216, 0.08)',
    borderAccent: 'rgba(199, 154, 62, 0.35)',
    ink: '#ECE7D8',
    inkDim: '#A8A395',
    text: '#ECE7D8',
    textMuted: '#A8A395',
    inputBg: 'rgba(23, 26, 20, 0.72)',
    inputBorder: 'rgba(236, 231, 216, 0.09)',
    primary: '#C79A3E',
    primaryGradientEnd: '#A97F2E',
    accent: '#A23E32',
    highlight: '#4C7A78',
    success: '#5B8C5A',
    warning: '#C9932E',
    gold: '#C79A3E',
    oxblood: '#A23E32',
    teal: '#4C7A78',
    sage: '#5B8C5A',
    trackBg: 'rgba(255, 255, 255, 0.05)',
    cardTotalBg: 'rgba(199, 154, 62, 0.12)',
    cardTotalBorder: 'rgba(199, 154, 62, 0.32)',
    cardCountBg: 'rgba(162, 62, 50, 0.12)',
    cardCountBorder: 'rgba(162, 62, 50, 0.32)',
  },
  light: {
    bg: '#F8F9FA',
    card: 'rgba(255, 255, 255, 0.94)',
    cardHover: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceHover: '#F1F5F9',
    border: 'rgba(15, 23, 42, 0.08)',
    borderAccent: 'rgba(212, 175, 55, 0.45)',
    ink: '#0F172A',
    inkDim: '#475569',
    text: '#0F172A',
    textMuted: '#475569',
    inputBg: '#F1F5F9',
    inputBorder: 'rgba(15, 23, 42, 0.12)',
    primary: '#D4AF37',
    primaryGradientEnd: '#B38F22',
    accent: '#E74C3C',
    highlight: '#0EA5E9',
    success: '#10B981',
    warning: '#F59E0B',
    gold: '#D4AF37',
    oxblood: '#E74C3C',
    teal: '#0EA5E9',
    sage: '#10B981',
    trackBg: 'rgba(0, 0, 0, 0.06)',
    cardTotalBg: 'rgba(212, 175, 55, 0.10)',
    cardTotalBorder: 'rgba(212, 175, 55, 0.30)',
    cardCountBg: 'rgba(231, 76, 60, 0.08)',
    cardCountBorder: 'rgba(231, 76, 60, 0.25)',
  },
};

/**
 * Curated ink/stamp category palette — consistent with web CATEGORY_PALETTE
 */
export const CategoryPalette = [
  { bg: 'rgba(199, 154, 62, 0.14)', color: '#C79A3E' }, // gold
  { bg: 'rgba(162, 62, 50, 0.14)', color: '#A23E32' },  // oxblood
  { bg: 'rgba(76, 122, 120, 0.14)', color: '#4C7A78' }, // teal
  { bg: 'rgba(91, 140, 90, 0.14)', color: '#5B8C5A' },  // sage
  { bg: 'rgba(139, 94, 52, 0.14)', color: '#8B5E34' },  // umber
  { bg: 'rgba(176, 107, 92, 0.14)', color: '#B06B5C' }, // terracotta
  { bg: 'rgba(201, 147, 46, 0.14)', color: '#C9932E' }, // mustard
  { bg: 'rgba(107, 114, 128, 0.14)', color: '#6B7280' },// slate
];

export function getCategoryColor(name: string | undefined | null) {
  if (!name) return CategoryPalette[0];
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % CategoryPalette.length;
  return CategoryPalette[idx];
}

export function getCategoryEmoji(name: string | undefined | null): string {
  const n = (name || '').toLowerCase();
  if (n.includes('food') || n.includes('dining') || n.includes('restaurant')) return '🍔';
  if (n.includes('transport') || n.includes('travel') || n.includes('uber') || n.includes('fuel')) return '🚗';
  if (n.includes('shop') || n.includes('cloth') || n.includes('amazon')) return '🛍️';
  if (n.includes('util') || n.includes('electric') || n.includes('water') || n.includes('bill')) return '⚡';
  if (n.includes('entertain') || n.includes('movie') || n.includes('netflix') || n.includes('game')) return '🎬';
  if (n.includes('health') || n.includes('medical') || n.includes('gym') || n.includes('fitness')) return '💊';
  if (n.includes('edu') || n.includes('course') || n.includes('book')) return '📚';
  if (n.includes('subscri') || n.includes('saas') || n.includes('software')) return '💻';
  if (n.includes('grocer') || n.includes('market') || n.includes('super')) return '🛒';
  return '💳';
}

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
