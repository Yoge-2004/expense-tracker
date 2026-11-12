import {
  hashText,
  isLocalWallpaperUri,
  isPortableWallpaperUri,
  parseDataUri,
} from '../utils/wallpaperSync';

describe('wallpaper URI classification', () => {
  it('knows which URIs another device or the website can load', () => {
    expect(isPortableWallpaperUri('https://example.com/a.jpg')).toBe(true);
    expect(isPortableWallpaperUri('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(isPortableWallpaperUri('file:///data/user/0/app/cache/ImagePicker/x.jpg')).toBe(false);
    expect(isPortableWallpaperUri('')).toBe(false);
    expect(isPortableWallpaperUri(undefined)).toBe(false);
  });

  it('recognises device-local URIs', () => {
    expect(isLocalWallpaperUri('file:///data/x.jpg')).toBe(true);
    expect(isLocalWallpaperUri('content://media/external/images/1')).toBe(true);
    expect(isLocalWallpaperUri('https://example.com/a.jpg')).toBe(false);
  });
});

describe('parseDataUri', () => {
  it('extracts extension and payload from a data URI', () => {
    expect(parseDataUri('data:image/jpeg;base64,QUJD')).toEqual({ ext: 'jpg', base64: 'QUJD' });
    expect(parseDataUri('data:image/png;base64,QUJD')).toEqual({ ext: 'png', base64: 'QUJD' });
    expect(parseDataUri('data:image/webp;base64,QU JD')?.base64).toBe('QUJD');
  });

  it('rejects anything else', () => {
    expect(parseDataUri('data:text/html;base64,QUJD')).toBeNull();
    expect(parseDataUri('data:image/svg+xml;base64,QUJD')).toBeNull();
    expect(parseDataUri('https://example.com/a.png')).toBeNull();
    expect(parseDataUri('data:image/jpeg,not-base64')).toBeNull();
  });
});

describe('hashText', () => {
  it('is stable and differs for different input', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
    expect(hashText('abc')).not.toBe(hashText('abcd'));
  });
});
