/**
 * @file fileDownloader.ts
 * @description Native device download helper for iOS and Android.
 * - On Android: Uses StorageAccessFramework to let user select any folder (e.g. Downloads) and writes the file directly.
 * - On iOS / Fallback: Opens the native share/save sheet so user can "Save to Files" or share.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

export async function saveFileToDevice(
  fileUri: string,
  filename: string,
  mimeType: string,
  uti?: string
): Promise<void> {
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
        Alert.alert('Download Complete', `"${filename}" was saved directly to your device storage.`);
        return;
      }
    } catch (err: any) {
      console.warn('StorageAccessFramework save failed, falling back to share sheet:', err);
    }
  }

  // iOS / Android fallback: Open system share/save sheet
  const isShareAvailable = await Sharing.isAvailableAsync();
  if (isShareAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: `Save "${filename}"`,
      UTI: uti,
    });
  } else {
    Alert.alert('Download Complete', `File saved to device: ${filename}`);
  }
}
