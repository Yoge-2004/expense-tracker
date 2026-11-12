import { buildBootTheme, parseBootTheme } from '../utils/bootTheme';

const palette = {
  primary: '#112233',
  primaryGradientEnd: '#223344',
  accent: '#334455',
  highlight: '#445566',
  card: 'rgba(1, 2, 3, 0.9)',
  surface: '#050505',
  borderAccent: 'rgba(17, 34, 51, 0.35)',
};

describe('buildBootTheme / parseBootTheme', () => {
  it('round-trips theme, palette, custom flag and a wallpaper path', () => {
    const built = buildBootTheme({
      theme: 'light',
      customApplied: true,
      palette,
      bg: { type: 'custom', uri: 'file:///data/user/0/app/files/synced-wallpaper-x.jpg', overlayOpacity: 0.5, blurIntensity: 4 },
    });
    const parsed = parseBootTheme(JSON.stringify(built));
    expect(parsed).toEqual(built);
    expect(parsed?.theme).toBe('light');
    expect(parsed?.customApplied).toBe(true);
    expect(parsed?.bg?.uri).toContain('synced-wallpaper-x.jpg');
  });

  it('never stores a data URI (too large); a custom wallpaper without a path falls back to preset', () => {
    const built = buildBootTheme({
      theme: 'dark',
      customApplied: true,
      palette,
      bg: { type: 'custom', uri: 'data:image/jpeg;base64,' + 'A'.repeat(5000), overlayOpacity: 0.35 },
    });
    expect(built.bg?.uri).toBeUndefined();
    expect(built.bg?.type).toBe('preset');
  });

  it('drops a palette that is missing fields', () => {
    const built = buildBootTheme({ theme: 'dark', customApplied: true, palette: { primary: '#fff' } as never, bg: null });
    expect(built.palette).toBeNull();
  });

  it('returns null for anything malformed instead of throwing', () => {
    expect(parseBootTheme(null)).toBeNull();
    expect(parseBootTheme('')).toBeNull();
    expect(parseBootTheme('not json')).toBeNull();
    expect(parseBootTheme('{"v":2,"theme":"dark"}')).toBeNull();
    expect(parseBootTheme('{"v":1,"theme":"purple"}')).toBeNull();
  });

  it('defaults safely when optional parts are absent', () => {
    const parsed = parseBootTheme('{"v":1,"theme":"dark"}');
    expect(parsed).toEqual({ v: 1, theme: 'dark', customApplied: false, palette: null, bg: null });
  });
});
