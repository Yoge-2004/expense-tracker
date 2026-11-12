/**
 * Makes a custom wallpaper travel between the app and the website.
 *
 * A photo picked in the app is a LOCAL file path (file:///.../ImagePicker/x.jpg). Sent to the cloud as is,
 * the website cannot load it (and the path means nothing on another phone), so the wallpaper never synced.
 * The website, in turn, saves its wallpaper as a data URI. So:
 *   push: a local file becomes a compressed JPEG data URI (<= 1280 px, about 150-400 KB);
 *   pull: a data URI is written to a file in the app's document folder, and only that short path is kept
 *         in storage (a multi-hundred-KB string in AsyncStorage is slow and can fail to read back).
 * A URI that cannot be used on this device (another device's file path) is ignored, never applied.
 */
import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export const SYNC_MAX_WIDTH = 1280;
export const SYNC_FALLBACK_WIDTH = 960;
export const SYNC_JPEG_QUALITY = 0.7;
/** About 2.2 MB of image; the server accepts far more, but a wallpaper has no need of it. */
export const MAX_SYNC_DATA_URI_CHARS = 3_000_000;
const SYNCED_FILE_PREFIX = 'synced-wallpaper-';

export function isPortableWallpaperUri(uri?: string | null): boolean {
  return !!uri && (/^https?:\/\//i.test(uri) || /^data:image\//i.test(uri));
}

export function isLocalWallpaperUri(uri?: string | null): boolean {
  return !!uri && /^(file|content|ph|assets-library):/i.test(uri);
}

/** Small, fast, non-cryptographic hash used to name the synced file. */
export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + '-' + text.length.toString(36);
}

export function parseDataUri(uri: string): { ext: string; base64: string } | null {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(uri);
  if (!m) return null;
  return { ext: m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase(), base64: m[2].replace(/\s+/g, '') };
}

// local file -> the data URI already made for it (a font change pushes the wallpaper again; do not re-encode)
const dataUriByLocalUri = new Map<string, string>();

function imageWidth(uri: string): Promise<number | null> {
  return new Promise((resolve) => {
    Image.getSize(uri, (width) => resolve(width), () => resolve(null));
  });
}

async function encode(uri: string, width: number | null, maxWidth: number): Promise<string | null> {
  const actions = width !== null && width <= maxWidth ? [] : [{ resize: { width: maxWidth } }];
  const out = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: SYNC_JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}

/**
 * The value to store in the cloud for a wallpaper:
 *  - '' for no wallpaper (the server only overwrites non-null fields, so an empty string clears it);
 *  - the same URI when it is already portable (http(s) or a data URI);
 *  - a compressed data URI for a local file;
 *  - null when it cannot be made portable (the caller then leaves the cloud wallpaper unchanged).
 */
export async function wallpaperToCloudUri(uri?: string | null): Promise<string | null> {
  if (!uri) return '';
  if (isPortableWallpaperUri(uri)) return uri;
  if (!isLocalWallpaperUri(uri)) return null;
  const cached = dataUriByLocalUri.get(uri);
  if (cached) return cached;
  try {
    const width = await imageWidth(uri);
    let data = await encode(uri, width, SYNC_MAX_WIDTH);
    if (data && data.length > MAX_SYNC_DATA_URI_CHARS) data = await encode(uri, width, SYNC_FALLBACK_WIDTH);
    if (!data || data.length > MAX_SYNC_DATA_URI_CHARS) return null;
    dataUriByLocalUri.set(uri, data);
    return data;
  } catch (e) {
    console.warn('[WallpaperSync] Could not prepare wallpaper for upload:', e);
    return null;
  }
}

async function removeOtherSyncedFiles(dir: string, keepName: string): Promise<void> {
  try {
    const names = await FileSystem.readDirectoryAsync(dir);
    await Promise.all(
      names
        .filter((n) => n.startsWith(SYNCED_FILE_PREFIX) && n !== keepName)
        .map((n) => FileSystem.deleteAsync(dir + n, { idempotent: true }))
    );
  } catch {
    /* tidying is best effort */
  }
}

/**
 * The URI to use on this device for a wallpaper that came from the cloud, or undefined when it cannot be
 * used here (for example a file path pushed by another device).
 */
export async function cloudUriToLocalWallpaper(uri?: string | null): Promise<string | undefined> {
  if (!uri) return undefined;
  if (/^https?:\/\//i.test(uri)) return uri;
  const parsed = parseDataUri(uri);
  const dir = FileSystem.documentDirectory;
  if (!parsed || !dir) return undefined;
  const name = `${SYNCED_FILE_PREFIX}${hashText(uri)}.${parsed.ext}`;
  const path = dir + name;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      await FileSystem.writeAsStringAsync(path, parsed.base64, { encoding: FileSystem.EncodingType.Base64 });
    }
    dataUriByLocalUri.set(path, uri); // a later push of this same file needs no re-encoding
    void removeOtherSyncedFiles(dir, name);
    return path;
  } catch (e) {
    console.warn('[WallpaperSync] Could not store the synced wallpaper:', e);
    return undefined;
  }
}
