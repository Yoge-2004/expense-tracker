/**
 * @file paletteExtractor.test.ts
 * @description Comprehensive unit tests for client-side palette extraction, color quantization,
 * base64 decoding, font presets, and vector icon mappings.
 */

import {
  rgbToHex,
  hexToRgb,
  getPerceivedLuminance,
  adjustBrightness,
  decodeBase64ToUint8,
  quantizePixels,
  PRESET_BACKGROUNDS,
} from '../services/paletteExtractor';
import { getCategoryIconName, FontPresets } from '../constants/theme';

describe('paletteExtractor service', () => {
  describe('Color Math and Conversions', () => {
    it('converts RGB components to correct hex string', () => {
      expect(rgbToHex(199, 154, 62)).toBe('#c79a3e');
      expect(rgbToHex(16, 185, 129)).toBe('#10b981');
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });

    it('clamps values out of bounds (0-255)', () => {
      expect(rgbToHex(-20, 300, 120)).toBe('#00ff78');
    });

    it('converts 6-digit hex string to RGB object', () => {
      expect(hexToRgb('#C79A3E')).toEqual({ r: 199, g: 154, b: 62 });
      expect(hexToRgb('#10B981')).toEqual({ r: 16, g: 185, b: 129 });
    });

    it('converts 3-digit hex string shorthand to RGB object', () => {
      expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('calculates perceived luminance correctly', () => {
      const whiteLum = getPerceivedLuminance(255, 255, 255);
      const blackLum = getPerceivedLuminance(0, 0, 0);
      const goldLum = getPerceivedLuminance(199, 154, 62);

      expect(whiteLum).toBeCloseTo(255, 0);
      expect(blackLum).toBe(0);
      expect(goldLum).toBeGreaterThan(100);
      expect(goldLum).toBeLessThan(200);
    });

    it('adjusts brightness upward and downward safely', () => {
      const darkened = adjustBrightness('#ffffff', 0.5);
      expect(darkened).toBe('#808080');

      const blackAdjust = adjustBrightness('#000000', 1.5);
      expect(blackAdjust).toBe('#000000');
    });
  });

  describe('Pure JavaScript Base64 Decoder', () => {
    it('decodes standard base64 string without external dependencies', () => {
      // "Hello World" in base64 is "SGVsbG8gV29ybGQ="
      const bytes = decodeBase64ToUint8('SGVsbG8gV29ybGQ=');
      const text = String.fromCharCode(...bytes);
      expect(text).toBe('Hello World');
    });

    it('strips data URI prefix if present', () => {
      const bytes = decodeBase64ToUint8('data:image/jpeg;base64,SGVsbG8=');
      const text = String.fromCharCode(...bytes);
      expect(text).toBe('Hello');
    });
  });

  describe('Quantize Pixels Algorithm', () => {
    it('extracts dominant vibrant colors from synthesized RGBA pixel buffer', () => {
      // 1000 pixels: 700 gold pixels, 300 emerald pixels
      const pixels = new Uint8Array(4000);
      for (let i = 0; i < 4000; i += 4) {
        if (i < 2800) {
          pixels[i] = 199;
          pixels[i + 1] = 154;
          pixels[i + 2] = 62;
          pixels[i + 3] = 255;
        } else {
          pixels[i] = 16;
          pixels[i + 1] = 185;
          pixels[i + 2] = 129;
          pixels[i + 3] = 255;
        }
      }

      const darkPalette = quantizePixels(pixels, false);
      expect(darkPalette.primary).toBe('#c79a3e');
      expect(darkPalette.accent).toBe('#10b981');
      expect(darkPalette.card).toContain('rgba(');
      expect(darkPalette.borderAccent).toContain('rgba(');

      const lightPalette = quantizePixels(pixels, true);
      expect(lightPalette.primary).toBe('#c79a3e');
      expect(lightPalette.card).toContain('0.94');
    });

    it('falls back gracefully to default preset when given blank/empty pixels', () => {
      const emptyPixels = new Uint8Array(40);
      const palette = quantizePixels(emptyPixels, false);
      expect(palette.primary).toBe('#C79A3E');
      expect(palette.accent).toBe('#A23E32');
    });
  });

  describe('Curated Preset Backgrounds', () => {
    it('includes all 6 crafted luxury presets with valid palettes', () => {
      expect(PRESET_BACKGROUNDS.length).toBeGreaterThanOrEqual(6);

      PRESET_BACKGROUNDS.forEach((preset) => {
        expect(preset.id).toBeTruthy();
        expect(preset.name).toBeTruthy();
        expect(preset.darkPalette.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(preset.darkPalette.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(preset.lightPalette.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(preset.lightPalette.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  describe('Category Vector Icon Mapping', () => {
    it('maps financial and shopping categories to vector icons without emojis', () => {
      expect(getCategoryIconName('Food & Dining')).toBe('restaurant-outline');
      expect(getCategoryIconName('Transport & Uber')).toBe('car-outline');
      expect(getCategoryIconName('Shopping & Cloth')).toBe('bag-handle-outline');
      expect(getCategoryIconName('Electricity Utility')).toBe('flash-outline');
      expect(getCategoryIconName('Netflix Entertainment')).toBe('film-outline');
      expect(getCategoryIconName('Medical & Health')).toBe('medkit-outline');
      expect(getCategoryIconName('Education Course')).toBe('school-outline');
      expect(getCategoryIconName('Software SaaS Subscription')).toBe('laptop-outline');
      expect(getCategoryIconName('Supermarket Groceries')).toBe('cart-outline');
      expect(getCategoryIconName('Savings Deposit')).toBe('wallet-outline');
      expect(getCategoryIconName('Peer Loan Adjustment')).toBe('swap-horizontal-outline');
      expect(getCategoryIconName('General Outflow')).toBe('card-outline');
      expect(getCategoryIconName(null)).toBe('card-outline');
    });
  });

  describe('Font Presets Configuration', () => {
    it('provides valid font tokens for grotesk, fraunces, mono, and system', () => {
      expect(FontPresets.grotesk.display).toBe('HankenGrotesk_700Bold');
      expect(FontPresets.fraunces.display).toBe('Fraunces_600SemiBold');
      expect(FontPresets.mono.display).toBe('IBMPlexMono_600SemiBold');
      expect(FontPresets.system.display).toBe('System');
    });
  });
});
