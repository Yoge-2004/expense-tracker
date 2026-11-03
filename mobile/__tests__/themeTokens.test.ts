import * as fs from 'fs';
import * as path from 'path';
import { createThemeColors } from '../context/PreferencesContext';

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const purple = {
  primary: '#8B5CF6', primaryGradientEnd: '#7C3AED', accent: '#EC4899', highlight: '#A855F7',
  surface: '#2A1B4D', card: '#3B2A6B', paletteColors: ['#8B5CF6', '#EC4899', '#A855F7', '#7C3AED'],
} as any;

describe('theme tokens used by components', () => {
  for (const theme of ['dark', 'light'] as const) {
    for (const [label, palette, preset] of [['default', null, 'default'], ['custom', purple, 'default']] as const) {
      it(`${theme}/${label}: provides fills and readable text on primary`, () => {
        const c = createThemeColors(theme, palette as any, preset);
        expect(c.fillSubtle).toBeTruthy();
        expect(c.fillStrong).toBeTruthy();
        expect(c.keyBg).toBeTruthy();
        expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('keeps the shipped light look: white keys, and fills follow a customised palette', () => {
    const light = createThemeColors('light', null, 'default');
    expect(light.keyBg.toLowerCase()).toBe(light.card.toLowerCase());
    const custom = createThemeColors('light', purple, 'default');
    // a customised surface must reach the keys, fills and cards instead of staying pure white
    expect(custom.keyBg.toLowerCase()).not.toBe('#ffffff');
    expect(custom.fillSubtle.toLowerCase()).not.toBe('#f1f5f9');
    expect(custom.card.toLowerCase()).toBe(custom.keyBg.toLowerCase());
  });
});

describe('components do not bypass the theme with light/dark literals', () => {
  const root = path.resolve(__dirname, '..');
  // Files that intentionally keep fixed colours (semantic destructive red, preview swatches, ambient overlay).
  const allowed = new Set(['components/AmbientAura.tsx', 'components/ThemeStudioModal.tsx', 'components/SwipeableCard.tsx', 'components/dashboard/TransactionRow.tsx']);
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.tsx') ? [path.join(dir, e.name)] : []
    );

  it('has no `isLight ? "#hex" : ...` colour ternaries outside the allow-list', () => {
    const offenders: string[] = [];
    for (const dir of ['components', 'app']) {
      for (const file of walk(path.join(root, dir))) {
        const rel = path.relative(root, file).split(path.sep).join('/');
        if (allowed.has(rel)) continue;
        fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (/is(Light|Dark)\s*\?\s*['"](#|rgba?\()/.test(line)) offenders.push(`${rel}:${i + 1}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});

import { buildCategoryPalette, readableTextColor } from '../constants/theme';
import { hasCustomGradient, derivedGradientEnd } from '../services/paletteExtractor';

describe('category colours', () => {
  it('never depend on the wallpaper: extracted swatches in the palette do not change them', () => {
    const wallpaperA = { ...purple, paletteColors: ['#010101', '#020202', '#030303', '#040404'] };
    const wallpaperB = { ...purple, paletteColors: ['#FEFEFE', '#FDFDFD', '#FCFCFC', '#FBFBFB'] };
    const a = createThemeColors('dark', wallpaperA, 'default').paletteColors;
    const b = createThemeColors('dark', wallpaperB, 'default').paletteColors;
    expect(a).toEqual(b);
  });

  it('follow the chosen theme colours and stay readable and distinct', () => {
    for (const theme of ['dark', 'light'] as const) {
      const c = createThemeColors(theme, purple, 'default');
      expect(c.paletteColors.length).toBeGreaterThanOrEqual(8);
      expect(new Set(c.paletteColors.map((x) => x.toLowerCase())).size).toBe(c.paletteColors.length);
      for (const color of c.paletteColors) expect(contrast(color, c.card)).toBeGreaterThanOrEqual(1.15);
    }
    const other = createThemeColors('dark', { ...purple, primary: '#10B981' }, 'default').paletteColors;
    expect(other).not.toEqual(createThemeColors('dark', purple, 'default').paletteColors);
  });

  it('buildCategoryPalette skips invalid colours', () => {
    expect(buildCategoryPalette(['nope', '#ZZZZZZ'], '#171A14').every((x) => /^#[0-9a-f]{6}$/i.test(x))).toBe(true);
  });
});

describe('text on semantic colours', () => {
  it('is readable for every theme and palette', () => {
    for (const theme of ['dark', 'light'] as const) {
      for (const palette of [null, purple] as const) {
        const c = createThemeColors(theme, palette as any, 'default');
        for (const [bg, fg] of [[c.success, c.onSuccess], [c.warning, c.onWarning], [c.danger, c.onDanger], [c.accent, c.onAccent], [c.highlight, c.onHighlight], [c.primary, c.onPrimary]]) {
          expect(contrast(bg, fg)).toBeGreaterThanOrEqual(3);
        }
      }
    }
    expect(readableTextColor('#FFFF00')).not.toBe(readableTextColor('#000080'));
  });
});

describe('primary and gradient are separate choices', () => {
  it('treats the derived shade as automatic and anything else as the user\'s own pick', () => {
    expect(hasCustomGradient({ primary: '#8B5CF6', primaryGradientEnd: derivedGradientEnd('#8B5CF6') })).toBe(false);
    expect(hasCustomGradient({ primary: '#8B5CF6', primaryGradientEnd: '#10B981' })).toBe(true);
    expect(hasCustomGradient(null)).toBe(false);
  });
});
