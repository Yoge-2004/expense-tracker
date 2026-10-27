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
    },
    lightPalette: {
      primary: '#D4AF37',
      primaryGradientEnd: '#B38F22',
      accent: '#E74C3C',
      highlight: '#0EA5E9',
      card: 'rgba(255, 255, 255, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(212, 175, 55, 0.45)',
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
    },
    lightPalette: {
      primary: '#059669',
      primaryGradientEnd: '#047857',
      accent: '#10B981',
      highlight: '#0D9488',
      card: 'rgba(240, 253, 244, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(5, 150, 105, 0.40)',
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
    },
    lightPalette: {
      primary: '#7C3AED',
      primaryGradientEnd: '#6D28D9',
      accent: '#DB2777',
      highlight: '#9333EA',
      card: 'rgba(250, 245, 255, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(124, 58, 237, 0.40)',
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
    },
    lightPalette: {
      primary: '#0284C7',
      primaryGradientEnd: '#0369A1',
      accent: '#4F46E5',
      highlight: '#0891B2',
      card: 'rgba(240, 249, 255, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(2, 132, 199, 0.40)',
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
    },
    lightPalette: {
      primary: '#D97706',
      primaryGradientEnd: '#B45309',
      accent: '#DC2626',
      highlight: '#EA580C',
      card: 'rgba(255, 247, 237, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(217, 119, 6, 0.40)',
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
    },
    lightPalette: {
      primary: '#CA8A04',
      primaryGradientEnd: '#A16207',
      accent: '#E11D48',
      highlight: '#D97706',
      card: 'rgba(254, 252, 232, 0.94)',
      surface: '#FFFFFF',
      borderAccent: 'rgba(202, 138, 4, 0.40)',
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

export function adjustBrightness(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

function colorVariant(color: RGB, hueOffset: number): RGB {
  const red = color.r / 255, green = color.g / 255, blue = color.b / 255;
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  hue = (hue + hueOffset + 360) % 360;
  const lightness = Math.min(0.64, Math.max(0.42, (max + min) / 2));
  const saturation = Math.min(0.82, Math.max(0.58, delta / (1 - Math.abs(2 * lightness - 1))));
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  const sectors: RGB[] = [
    { r: chroma, g: x, b: 0 }, { r: x, g: chroma, b: 0 },
    { r: 0, g: chroma, b: x }, { r: 0, g: x, b: chroma },
    { r: x, g: 0, b: chroma }, { r: chroma, g: 0, b: x },
  ];
  const variant = sectors[Math.floor(hue / 60) % 6];
  return {
    r: Math.round((variant.r + match) * 255),
    g: Math.round((variant.g + match) * 255),
    b: Math.round((variant.b + match) * 255),
  };
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
  const buckets = new Map<number, { r: number; g: number; b: number; count: number; score: number }>();
  const totalPixels = Math.floor(data.length / 4);
  const step = Math.max(1, Math.floor(totalPixels / 2500)) * 4;

  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max - min;

    const qR = Math.floor(r / 16);
    const qG = Math.floor(g / 16);
    const qB = Math.floor(b / 16);
    const key = (qR << 8) | (qG << 4) | qB;

    const existing = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0, score: 0 };
    existing.r += r;
    existing.g += g;
    existing.b += b;
    existing.count++;
    // Let saturation break ties without allowing tiny vivid details to dominate
    // the overall image color.
    existing.score += 1 + (sat / 255) * 1.5;
    buckets.set(key, existing);
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    return isLight ? PRESET_BACKGROUNDS[0].lightPalette : PRESET_BACKGROUNDS[0].darkPalette;
  }

  const primaryRgb = {
    r: Math.round(sorted[0].r / sorted[0].count),
    g: Math.round(sorted[0].g / sorted[0].count),
    b: Math.round(sorted[0].b / sorted[0].count),
  };

  // Find accent that has color distance from primary
  let accentRgb = primaryRgb;
  for (let i = 1; i < sorted.length; i++) {
    const candidate = {
      r: Math.round(sorted[i].r / sorted[i].count),
      g: Math.round(sorted[i].g / sorted[i].count),
      b: Math.round(sorted[i].b / sorted[i].count),
    };
    const distance = Math.sqrt(
      Math.pow(candidate.r - primaryRgb.r, 2) +
      Math.pow(candidate.g - primaryRgb.g, 2) +
      Math.pow(candidate.b - primaryRgb.b, 2)
    );
    if (distance > 70) {
      accentRgb = candidate;
      break;
    }
  }
  const colorDistance = (a: RGB, b: RGB) => Math.sqrt(
    Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2)
  );
  if (colorDistance(primaryRgb, accentRgb) <= 70) accentRgb = colorVariant(primaryRgb, 34);

  // Find highlight
  let highlightRgb = accentRgb;
  for (let i = 1; i < sorted.length; i++) {
    const candidate = {
      r: Math.round(sorted[i].r / sorted[i].count),
      g: Math.round(sorted[i].g / sorted[i].count),
      b: Math.round(sorted[i].b / sorted[i].count),
    };
    const dist1 = Math.sqrt(Math.pow(candidate.r - primaryRgb.r, 2) + Math.pow(candidate.g - primaryRgb.g, 2) + Math.pow(candidate.b - primaryRgb.b, 2));
    const dist2 = Math.sqrt(Math.pow(candidate.r - accentRgb.r, 2) + Math.pow(candidate.g - accentRgb.g, 2) + Math.pow(candidate.b - accentRgb.b, 2));
    if (dist1 > 50 && dist2 > 50) {
      highlightRgb = candidate;
      break;
    }
  }
  if (colorDistance(primaryRgb, highlightRgb) <= 50 || colorDistance(accentRgb, highlightRgb) <= 50) {
    highlightRgb = colorVariant(primaryRgb, 190);
  }

  const paletteColors: string[] = [];
  for (const bucket of sorted) {
    const candidate = {
      r: Math.round(bucket.r / bucket.count),
      g: Math.round(bucket.g / bucket.count),
      b: Math.round(bucket.b / bucket.count),
    };
    if (paletteColors.every((hex) => colorDistance(hexToRgb(hex), candidate) >= 34)) {
      paletteColors.push(rgbToHex(candidate.r, candidate.g, candidate.b));
    }
    if (paletteColors.length === 8) break;
  }
  for (const hueOffset of [34, 96, 154, 218, 278]) {
    if (paletteColors.length >= 8) break;
    const variant = colorVariant(primaryRgb, hueOffset);
    const hex = rgbToHex(variant.r, variant.g, variant.b);
    if (!paletteColors.includes(hex)) paletteColors.push(hex);
  }

  const primaryHex = rgbToHex(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  const accentHex = rgbToHex(accentRgb.r, accentRgb.g, accentRgb.b);
  const highlightHex = rgbToHex(highlightRgb.r, highlightRgb.g, highlightRgb.b);
  const gradientEndHex = adjustBrightness(primaryHex, isLight ? 0.85 : 0.80);

  // Compute card surface with subtle ambient tint matching primary
  const cardSurface = isLight
    ? `rgba(${Math.min(255, 245 + Math.floor(primaryRgb.r * 0.04))}, ${Math.min(255, 248 + Math.floor(primaryRgb.g * 0.03))}, ${Math.min(255, 252 + Math.floor(primaryRgb.b * 0.03))}, 0.94)`
    : `rgba(${Math.max(16, 18 + Math.floor(primaryRgb.r * 0.05))}, ${Math.max(18, 20 + Math.floor(primaryRgb.g * 0.05))}, ${Math.max(22, 24 + Math.floor(primaryRgb.b * 0.05))}, 0.90)`;

  const opaqueSurface = isLight ? '#FFFFFF' : adjustBrightness(rgbToHex(primaryRgb.r, primaryRgb.g, primaryRgb.b), 0.12);

  return {
    primary: primaryHex,
    primaryGradientEnd: gradientEndHex,
    accent: accentHex,
    highlight: highlightHex,
    card: cardSurface,
    surface: opaqueSurface,
    borderAccent: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.35)`,
    paletteColors,
  };
}

/**
 * Extracts a dynamic palette from a file URI or remote URL.
 * Works completely on-device without uploading images to any external server.
 */
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
          } catch (error) {
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
