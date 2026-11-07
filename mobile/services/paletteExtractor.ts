/**
 * @file paletteExtractor.ts
 * @description Zero-native-dependency, client-side dynamic theming and color quantization engine.
 *
 * Extracts dominant vibrant colors (primary, accent, highlight, card surface tint, and border accents)
 * directly from background images, GIFs, and wallpapers on device with 100% offline capability.
 */

import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export interface ExtractedPalette {
  primary: string;
  primaryGradientEnd: string;
  accent: string;
  highlight: string;
  card: string;
  surface: string;
  borderAccent: string;
  paletteColors?: string[];
}

export interface PresetBackground {
  id: string;
  name: string;
  subtitle: string;
  previewPrimary: string;
  previewAccent: string;
  previewBg: string;
  darkPalette: ExtractedPalette;
  lightPalette: ExtractedPalette;
}

export const PRESET_BACKGROUNDS: PresetBackground[] = [
  {
    id: 'default',
    name: 'Imperial Gold & Onyx',
    subtitle: 'Classic signature Ledger & Lumina luxury identity',
    previewPrimary: '#C79A3E',
    previewAccent: '#A23E32',
    previewBg: '#10120E',
    darkPalette: {
      primary: '#C79A3E',
      primaryGradientEnd: '#A97F2E',
      accent: '#A23E32',
      highlight: '#4C7A78',
      card: 'rgba(23, 26, 20, 0.88)',
      surface: '#171A14',
      borderAccent: 'rgba(199, 154, 62, 0.35)',
      paletteColors: ['#C79A3E', '#A23E32', '#4C7A78', '#5B8C5A', '#8B5E34', '#B06B5C', '#3B82F6', '#8B5CF6'],
    },
    lightPalette: {
      primary: '#D4AF37',
      primaryGradientEnd: '#B38F22',
      accent: '#E74C3C',
      highlight: '#0EA5E9',
      card: 'rgba(255, 255, 255, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(212, 175, 55, 0.45)',
      paletteColors: ['#D4AF37', '#E74C3C', '#0EA5E9', '#10B981', '#8B5CF6', '#DB2777', '#059669', '#D97706'],
    },
  },
  {
    id: 'emerald-aurora',
    name: 'Emerald Aurora',
    subtitle: 'Prosperity, wealth and lush forest mist tones',
    previewPrimary: '#10B981',
    previewAccent: '#059669',
    previewBg: '#091A14',
    darkPalette: {
      primary: '#10B981',
      primaryGradientEnd: '#059669',
      accent: '#34D399',
      highlight: '#06B6D4',
      card: 'rgba(13, 26, 20, 0.90)',
      surface: '#0F2119',
      borderAccent: 'rgba(16, 185, 129, 0.35)',
      paletteColors: ['#10B981', '#34D399', '#06B6D4', '#059669', '#14B8A6', '#22C55E', '#38BDF8', '#84CC16'],
    },
    lightPalette: {
      primary: '#059669',
      primaryGradientEnd: '#047857',
      accent: '#10B981',
      highlight: '#0D9488',
      card: 'rgba(240, 253, 244, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(5, 150, 105, 0.40)',
      paletteColors: ['#059669', '#10B981', '#0D9488', '#047857', '#06B6D4', '#15803D', '#65A30D', '#0284C7'],
    },
  },
  {
    id: 'royal-amethyst',
    name: 'Royal Sovereign',
    subtitle: 'Deep galactic amethyst and electric neon rose',
    previewPrimary: '#8B5CF6',
    previewAccent: '#EC4899',
    previewBg: '#130E20',
    darkPalette: {
      primary: '#8B5CF6',
      primaryGradientEnd: '#7C3AED',
      accent: '#EC4899',
      highlight: '#A855F7',
      card: 'rgba(22, 17, 36, 0.90)',
      surface: '#1A142C',
      borderAccent: 'rgba(139, 92, 246, 0.35)',
      paletteColors: ['#8B5CF6', '#EC4899', '#A855F7', '#7C3AED', '#6366F1', '#D946EF', '#F43F5E', '#3B82F6'],
    },
    lightPalette: {
      primary: '#7C3AED',
      primaryGradientEnd: '#6D28D9',
      accent: '#DB2777',
      highlight: '#9333EA',
      card: 'rgba(250, 245, 255, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(124, 58, 237, 0.40)',
      paletteColors: ['#7C3AED', '#DB2777', '#9333EA', '#6D28D9', '#4F46E5', '#C026D3', '#E11D48', '#2563EB'],
    },
  },
  {
    id: 'cyber-cobalt',
    name: 'Cyber Cobalt',
    subtitle: 'Precision high-tech cyan, sapphire and deep ocean',
    previewPrimary: '#38BDF8',
    previewAccent: '#6366F1',
    previewBg: '#091322',
    darkPalette: {
      primary: '#38BDF8',
      primaryGradientEnd: '#0284C7',
      accent: '#6366F1',
      highlight: '#06B6D4',
      card: 'rgba(14, 23, 40, 0.90)',
      surface: '#111B30',
      borderAccent: 'rgba(56, 189, 248, 0.35)',
      paletteColors: ['#38BDF8', '#6366F1', '#06B6D4', '#0284C7', '#818CF8', '#0EA5E9', '#A855F7', '#2DD4BF'],
    },
    lightPalette: {
      primary: '#0284C7',
      primaryGradientEnd: '#0369A1',
      accent: '#4F46E5',
      highlight: '#0891B2',
      card: 'rgba(240, 249, 255, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(2, 132, 199, 0.40)',
      paletteColors: ['#0284C7', '#4F46E5', '#0891B2', '#0369A1', '#6366F1', '#0284C7', '#7C3AED', '#0D9488'],
    },
  },
  {
    id: 'sunset-amber',
    name: 'Sunset Velvet',
    subtitle: 'Warm horizon terracotta, bright amber and crimson embers',
    previewPrimary: '#F59E0B',
    previewAccent: '#EF4444',
    previewBg: '#1F120A',
    darkPalette: {
      primary: '#F59E0B',
      primaryGradientEnd: '#D97706',
      accent: '#EF4444',
      highlight: '#FB923C',
      card: 'rgba(28, 18, 12, 0.90)',
      surface: '#241710',
      borderAccent: 'rgba(245, 158, 11, 0.35)',
      paletteColors: ['#F59E0B', '#EF4444', '#FB923C', '#D97706', '#F43F5E', '#EA580C', '#EAB308', '#B45309'],
    },
    lightPalette: {
      primary: '#D97706',
      primaryGradientEnd: '#B45309',
      accent: '#DC2626',
      highlight: '#EA580C',
      card: 'rgba(255, 247, 237, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(217, 119, 6, 0.40)',
      paletteColors: ['#D97706', '#DC2626', '#EA580C', '#B45309', '#E11D48', '#C2410C', '#CA8A04', '#9A3412'],
    },
  },
  {
    id: 'golden-champagne',
    name: 'Gilded Champagne',
    subtitle: 'Radiant sparkling gold, warm silk and luxury archive',
    previewPrimary: '#FBBF24',
    previewAccent: '#F43F5E',
    previewBg: '#1B170B',
    darkPalette: {
      primary: '#FBBF24',
      primaryGradientEnd: '#EAB308',
      accent: '#F43F5E',
      highlight: '#F59E0B',
      card: 'rgba(27, 23, 14, 0.90)',
      surface: '#221D12',
      borderAccent: 'rgba(251, 191, 36, 0.35)',
      paletteColors: ['#FBBF24', '#F43F5E', '#F59E0B', '#EAB308', '#FB7185', '#F97316', '#FCD34D', '#D97706'],
    },
    lightPalette: {
      primary: '#CA8A04',
      primaryGradientEnd: '#A16207',
      accent: '#E11D48',
      highlight: '#D97706',
      card: 'rgba(254, 252, 232, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(202, 138, 4, 0.40)',
      paletteColors: ['#CA8A04', '#E11D48', '#D97706', '#A16207', '#F43F5E', '#EA580C', '#EAB308', '#B45309'],
    },
  },
];

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(hex: string): RGB {
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

export function getPerceivedLuminance(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** The gradient end that follows the primary automatically until the user picks their own. */

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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

export function hslToHex(h: number, s: number, l: number): string {
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
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return '#' + [clamp(r1), clamp(g1), clamp(b1)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function hueDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function derivedGradientEnd(primary: string): string {
  return adjustBrightness(primary, 0.85);
}

/** True when the palette's gradient was chosen by the user rather than derived from the primary. */
export function hasCustomGradient(palette: { primary: string; primaryGradientEnd?: string } | null | undefined): boolean {
  return !!palette && !!palette.primaryGradientEnd
    && palette.primaryGradientEnd.toLowerCase() !== derivedGradientEnd(palette.primary).toLowerCase();
}

export function adjustBrightness(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

// Fast Base64 lookup table
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

export function decodeBase64ToUint8(base64: string): Uint8Array {
  // Strip possible data URI header
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  let bufferLength = Math.floor(clean.length * 0.75);
  const len = clean.length;
  if (clean[len - 1] === '=') {
    bufferLength--;
    if (clean[len - 2] === '=') bufferLength--;
  }
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = B64_LOOKUP[clean.charCodeAt(i)];
    const e2 = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const e3 = B64_LOOKUP[clean.charCodeAt(i + 2)];
    const e4 = B64_LOOKUP[clean.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (clean[i + 2] !== '=') {
      bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    }
    if (clean[i + 3] !== '=') {
      bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
    }
  }
  return bytes;
}

/**
 * Quantizes RGBA pixel buffer into dominant vibrant and complementary colors.
 */
export function quantizePixels(
  data: Uint8Array | Uint8ClampedArray,
  isLight: boolean
): ExtractedPalette {
  const HUE_SECTORS = 16;
  const hueBins = Array.from({ length: HUE_SECTORS }, () => ({
    rSum: 0, gSum: 0, bSum: 0, wSum: 0, count: 0, hSum: 0, sSum: 0, lSum: 0
  }));
  let neutralCount = 0;

  const totalPixels = Math.floor(data.length / 4);
  const step = Math.max(1, Math.floor(totalPixels / 3000)) * 4;

  for (let i = 0; i < data.length; i += step) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;

    const hsl = rgbToHsl(r, g, b);
    if (hsl.l < 0.08 || hsl.l > 0.94 || hsl.s < 0.10) {
      neutralCount++;
      continue;
    }

    const binIdx = Math.min(HUE_SECTORS - 1, Math.floor((hsl.h / 360) * HUE_SECTORS));
    const weight = Math.pow(hsl.s, 1.25) * (1 - Math.abs(hsl.l - 0.5) * 1.2);
    const bin = hueBins[binIdx];
    bin.rSum += r * weight;
    bin.gSum += g * weight;
    bin.bSum += b * weight;
    bin.wSum += weight;
    bin.count++;
    bin.hSum += hsl.h * weight;
    bin.sSum += hsl.s * weight;
    bin.lSum += hsl.l * weight;
  }

  const clusters = hueBins
    .filter(b => b.count > 0 && b.wSum > 0)
    .map(b => ({
      rSum: b.rSum,
      gSum: b.gSum,
      bSum: b.bSum,
      wSum: b.wSum,
      h: b.hSum / b.wSum,
      s: b.sSum / b.wSum,
      l: b.lSum / b.wSum,
      count: b.count,
      score: b.wSum * Math.log2(b.count + 1)
    }))
    .sort((a, b) => b.score - a.score);

  if (clusters.length === 0) {
    return isLight ? PRESET_BACKGROUNDS[0].lightPalette : PRESET_BACKGROUNDS[0].darkPalette;
  }

  // Primary
  const top = clusters[0];
  const primaryH = top.h;
  const primaryR = Math.round(top.rSum / top.wSum);
  const primaryG = Math.round(top.gSum / top.wSum);
  const primaryB = Math.round(top.bSum / top.wSum);
  const primaryHex = rgbToHex(primaryR, primaryG, primaryB);

  // Accent (>= 45 deg separation)
  let accentH = (primaryH + 150) % 360;
  let accentHex: string;
  const bestAccent = clusters.find(c => hueDistance(c.h, primaryH) >= 45);
  if (bestAccent) {
    accentH = bestAccent.h;
    const accR = Math.round(bestAccent.rSum / bestAccent.wSum);
    const accG = Math.round(bestAccent.gSum / bestAccent.wSum);
    const accB = Math.round(bestAccent.bSum / bestAccent.wSum);
    accentHex = rgbToHex(accR, accG, accB);
  } else {
    const accS = Math.max(0.60, top.s);
    const accL = isLight ? 0.44 : 0.58;
    accentHex = hslToHex(accentH, accS, accL);
  }

  // Highlight (>= 32 deg from both)
  let highlightH = (primaryH + 75) % 360;
  let highlightHex: string;
  const bestHighlight = clusters.find(c => hueDistance(c.h, primaryH) >= 32 && hueDistance(c.h, accentH) >= 32);
  if (bestHighlight) {
    highlightH = bestHighlight.h;
    const hlR = Math.round(bestHighlight.rSum / bestHighlight.wSum);
    const hlG = Math.round(bestHighlight.gSum / bestHighlight.wSum);
    const hlB = Math.round(bestHighlight.bSum / bestHighlight.wSum);
    highlightHex = rgbToHex(hlR, hlG, hlB);
  } else {
    const hlS = Math.max(0.55, top.s);
    const hlL = isLight ? 0.45 : 0.56;
    highlightHex = hslToHex(highlightH, hlS, hlL);
  }

  // 8-color spectrum
  const extractedHues = [primaryH, accentH, highlightH];
  const paletteColors: string[] = [primaryHex, accentHex, highlightHex];

  for (const cand of clusters) {
    if (paletteColors.length >= 8) break;
    if (extractedHues.every(h => hueDistance(cand.h, h) >= 22)) {
      extractedHues.push(cand.h);
      const candR = Math.round(cand.rSum / cand.wSum);
      const candG = Math.round(cand.gSum / cand.wSum);
      const candB = Math.round(cand.bSum / cand.wSum);
      paletteColors.push(rgbToHex(candR, candG, candB));
    }
  }

  const chords = [35, -35, 95, -95, 140, 210, 270, 315];
  for (const offset of chords) {
    if (paletteColors.length >= 8) break;
    const chordH = (primaryH + offset + 360) % 360;
    if (extractedHues.every(h => hueDistance(chordH, h) >= 20)) {
      extractedHues.push(chordH);
      paletteColors.push(hslToHex(chordH, Math.max(0.58, top.s), isLight ? 0.46 : 0.58));
    }
  }

  while (paletteColors.length < 8) {
    const fallbackH = (primaryH + paletteColors.length * 45) % 360;
    paletteColors.push(hslToHex(fallbackH, 0.65, isLight ? 0.46 : 0.58));
  }

  const gradientEndHex = adjustBrightness(primaryHex, isLight ? 0.85 : 0.80);
  const pRgb = hexToRgb(primaryHex);

  const cardSurface = isLight
    ? `rgba(${Math.min(255, 248 + Math.floor(pRgb.r * 0.02))}, ${Math.min(255, 248 + Math.floor(pRgb.g * 0.02))}, ${Math.min(255, 252 + Math.floor(pRgb.b * 0.02))}, 0.94)`
    : `rgba(${Math.max(16, 20 + Math.floor(pRgb.r * 0.05))}, ${Math.max(18, 22 + Math.floor(pRgb.g * 0.05))}, ${Math.max(22, 24 + Math.floor(pRgb.b * 0.05))}, 0.90)`;

  const opaqueSurface = isLight ? '#FFFFFF' : adjustBrightness(primaryHex, 0.12);

  return {
    primary: primaryHex,
    primaryGradientEnd: gradientEndHex,
    accent: accentHex,
    highlight: highlightHex,
    card: cardSurface,
    surface: opaqueSurface,
    borderAccent: `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.35)`,
    paletteColors,
  };
}

export async function extractPaletteFromImageUri(
  uri: string,
  isLight: boolean
): Promise<ExtractedPalette> {
  try {
    if (Platform.OS === 'web') {
      // HTML5 offscreen canvas extraction for web
      return await new Promise<ExtractedPalette>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 80;
            const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
            canvas.width = Math.max(1, Math.floor(img.width * scale));
            canvas.height = Math.max(1, Math.floor(img.height * scale));
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Image processing is unavailable.'));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            resolve(quantizePixels(imgData.data, isLight));
          } catch {
            reject(new Error('This image URL does not allow palette extraction. Try downloading the image first.'));
          }
        };
        img.onerror = () => reject(new Error('Image could not be loaded. Check the URL and access permissions.'));
        img.src = uri;
      });
    }

    // Native image manipulation needs a local URI; download remote images first.
    let sourceUri = uri;
    let downloadedUri: string | null = null;
    if (/^https?:\/\//i.test(uri)) {
      if (!FileSystem.cacheDirectory) throw new Error('Image cache is unavailable.');
      const extension = uri.split(/[?#]/)[0].match(/\.(jpe?g|png|webp|gif)$/i)?.[1]?.toLowerCase() || 'img';
      const destination = `${FileSystem.cacheDirectory}palette-${Date.now()}.${extension}`;
      const download = await FileSystem.downloadAsync(uri, destination);
      if (download.status < 200 || download.status >= 300) throw new Error(`Image download failed (HTTP ${download.status}).`);
      sourceUri = download.uri;
      downloadedUri = download.uri;
    }

    // Normalize to a small JPEG before quantizing.
    let normalized: Awaited<ReturnType<typeof ImageManipulator.manipulateAsync>>;
    try {
      normalized = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ resize: { width: 160 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
    } finally {
      if (downloadedUri) await FileSystem.deleteAsync(downloadedUri, { idempotent: true }).catch(() => {});
    }
    const base64 = normalized.base64;
    if (!base64) throw new Error('Could not decode image pixels.');

    const bytes = decodeBase64ToUint8(base64);
    // Dynamic require so bundle size remains ultra-compact
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jpeg = require('jpeg-js');
    const rawImage = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 64 });

    if (rawImage && rawImage.data) {
      return quantizePixels(rawImage.data, isLight);
    }
    throw new Error('Could not decode image pixels.');
  } catch (err) {
    console.warn('[PaletteExtractor] Image decode failed:', err);
    throw err instanceof Error ? err : new Error('Could not extract colors from this image.');
  }
}
