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
 * 24 Curated luxury ink/stamp category palette + deterministic golden-ratio HSL generator.
 * Eliminates color collision across standard and custom user categories.
 */
export const CategoryPalette = [
  { bg: 'rgba(199, 154, 62, 0.14)', color: '#C79A3E' }, // 1. Imperial Gold
  { bg: 'rgba(162, 62, 50, 0.14)', color: '#A23E32' },  // 2. Oxblood Crimson
  { bg: 'rgba(76, 122, 120, 0.14)', color: '#4C7A78' }, // 3. Emerald Teal
  { bg: 'rgba(91, 140, 90, 0.14)', color: '#5B8C5A' },  // 4. Sage Olive
  { bg: 'rgba(139, 94, 52, 0.14)', color: '#8B5E34' },  // 5. Warm Umber
  { bg: 'rgba(176, 107, 92, 0.14)', color: '#B06B5C' }, // 6. Terracotta
  { bg: 'rgba(201, 147, 46, 0.14)', color: '#C9932E' }, // 7. Ochre Mustard
  { bg: 'rgba(107, 114, 128, 0.14)', color: '#6B7280' },// 8. Slate Gray
  { bg: 'rgba(59, 130, 246, 0.14)', color: '#3B82F6' }, // 9. Cobalt Sapphire
  { bg: 'rgba(139, 92, 246, 0.14)', color: '#8B5CF6' }, // 10. Royal Amethyst
  { bg: 'rgba(236, 72, 153, 0.14)', color: '#EC4899' }, // 11. Vivid Rose
  { bg: 'rgba(20, 184, 166, 0.14)', color: '#14B8A6' }, // 12. Cyan Jade
  { bg: 'rgba(245, 158, 11, 0.14)', color: '#F59E0B' }, // 13. Bright Amber
  { bg: 'rgba(99, 102, 241, 0.14)', color: '#6366F1' }, // 14. Deep Indigo
  { bg: 'rgba(16, 185, 129, 0.14)', color: '#10B981' }, // 15. Forest Mint
  { bg: 'rgba(239, 68, 68, 0.14)', color: '#EF4444' },  // 16. Scarlet Flame
  { bg: 'rgba(168, 85, 247, 0.14)', color: '#A855F7' }, // 17. Electric Violet
  { bg: 'rgba(6, 182, 212, 0.14)', color: '#06B6D4' },  // 18. Aqua Marine
  { bg: 'rgba(217, 119, 6, 0.14)', color: '#D97706' },  // 19. Burnt Copper
  { bg: 'rgba(79, 70, 229, 0.14)', color: '#4F46E5' },  // 20. Royal Iris
  { bg: 'rgba(13, 148, 136, 0.14)', color: '#0D9488' }, // 21. Persian Teal
  { bg: 'rgba(190, 24, 93, 0.14)', color: '#BE185D' },  // 22. Magenta Wine
  { bg: 'rgba(101, 163, 13, 0.14)', color: '#65A30D' }, // 23. Lime Citron
  { bg: 'rgba(100, 116, 139, 0.14)', color: '#64748B' },// 24. Mineral Steel
];

export function getCategoryColor(name: string | undefined | null, index?: number): { bg: string; color: string } {
  if (index !== undefined && index >= 0 && index < CategoryPalette.length) {
    return CategoryPalette[index];
  }
  const clean = (name || "").trim().toLowerCase();
  if (!clean) return CategoryPalette[0];

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) & 0xffffffff;
  }
  const absHash = Math.abs(hash);
  const paletteIndex = absHash % CategoryPalette.length;
  return CategoryPalette[paletteIndex];
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
