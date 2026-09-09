/**
 * @file fileDownloader.ts
 * @description Cross-platform file save helper. The helper deliberately does not
 * create native success alerts; callers own the app-level success UI so downloads
 * remain consistent with the application's custom AlertContext.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface SaveFileOptions {
  onComplete?: (mode: 'device' | 'share') => void;
}

export async function saveFileToDevice(
  fileUri: string,
  filename: string,
  mimeType: string,
  uti?: string,
  options: SaveFileOptions = {}
): Promise<'device' | 'share'> {
  if (Platform.OS === 'android') {
    try {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const createdUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          filename,
          mimeType
        );
        await FileSystem.writeAsStringAsync(createdUri, fileContent, {
          encoding: FileSystem.EncodingType.Base64,
        });
        options.onComplete?.('device');
        return 'device';
      }
    } catch (err) {
      console.warn('[FileDownloader] Android storage save failed; falling back to share sheet:', err);
    }
  }

  const isShareAvailable = await Sharing.isAvailableAsync();
  if (isShareAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: `Save "${filename}"`,
      UTI: uti,
    });
    options.onComplete?.('share');
    return 'share';
  }

  throw new Error(`No file-saving method is available for ${filename}.`);
}
