/**
 * A tiny snapshot of the saved appearance (mode, custom palette, wallpaper) that can be read
 * SYNCHRONOUSLY at start-up, so the very first frame, the loader included, already wears the user's
 * theme. The normal storage reads are asynchronous, so without this the loader first appears in the
 * default colours and only then switches.
 *
 * Kept in expo-secure-store (its getItem/setItem are synchronous) and deliberately small: no data URIs,
 * no fonts, no tokens. The async storage stays the source of truth; this is only a head start.
 */
import * as SecureStore from 'expo-secure-store';
import type { ExtractedPalette } from '../services/paletteExtractor';
import type { BackgroundAssetConfig } from '../context/PreferencesContext'; // type only: no runtime import cycle

export interface BootTheme {
  v: 1;
  theme: 'dark' | 'light';
  customApplied: boolean;
  palette: ExtractedPalette | null;
  bg: BackgroundAssetConfig | null;
}

const KEY = 'boot_theme_v1';
const PALETTE_KEYS = ['primary', 'primaryGradientEnd', 'accent', 'highlight', 'card', 'surface', 'borderAccent'] as const;
const MAX_URI_LENGTH = 600;

function validPalette(value: unknown): ExtractedPalette | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  for (const key of PALETTE_KEYS) {
    if (typeof candidate[key] !== 'string' || !candidate[key]) return null;
  }
  return candidate as unknown as ExtractedPalette;
}

function validBackground(value: unknown): BackgroundAssetConfig | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Record<string, unknown>;
  if (c.type !== 'preset' && c.type !== 'custom' && c.type !== 'none') return null;
  const bg: BackgroundAssetConfig = {
    type: c.type as 'preset' | 'custom' | 'none',
    overlayOpacity: typeof c.overlayOpacity === 'number' ? c.overlayOpacity : 0.35,
  };
  if (typeof c.presetId === 'string') bg.presetId = c.presetId;
  if (typeof c.uri === 'string' && c.uri) bg.uri = c.uri;
  if (typeof c.blurIntensity === 'number') bg.blurIntensity = c.blurIntensity;
  return bg;
}

/** Builds the snapshot to store: a wallpaper that is a data URI or very long is left out (too big). */
export function buildBootTheme(input: {
  theme: 'dark' | 'light';
  customApplied: boolean;
  palette: ExtractedPalette | null;
  bg: BackgroundAssetConfig | null;
}): BootTheme {
  let bg = validBackground(input.bg);
  if (bg?.uri && (bg.uri.startsWith('data:') || bg.uri.length > MAX_URI_LENGTH)) {
    bg = { ...bg, type: bg.type === 'custom' ? 'preset' : bg.type, uri: undefined };
  }
  return {
    v: 1,
    theme: input.theme === 'light' ? 'light' : 'dark',
    customApplied: !!input.customApplied,
    palette: validPalette(input.palette),
    bg,
  };
}

/** Parses a stored snapshot; anything malformed gives null, never a throw. */
export function parseBootTheme(raw: string | null | undefined): BootTheme | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || parsed.v !== 1) return null;
    if (parsed.theme !== 'light' && parsed.theme !== 'dark') return null;
    return {
      v: 1,
      theme: parsed.theme,
      customApplied: parsed.customApplied === true,
      palette: validPalette(parsed.palette),
      bg: validBackground(parsed.bg),
    };
  } catch {
    return null;
  }
}

/** Synchronous read for the first render. */
export function readBootTheme(): BootTheme | null {
  try {
    return parseBootTheme(SecureStore.getItem(KEY));
  } catch {
    return null;
  }
}

let lastWritten = '';

/** Synchronous, skips the write when nothing changed. */
export function writeBootTheme(snapshot: BootTheme): void {
  try {
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastWritten) return;
    SecureStore.setItem(KEY, serialized);
    lastWritten = serialized;
  } catch {
    /* a missing head start is harmless */
  }
}
