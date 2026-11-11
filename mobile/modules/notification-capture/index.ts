import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/** The Android module in ./android. It is absent in Expo Go, on iOS and in builds made before it existed. */
export interface NotificationCaptureNative {
  isAccessGranted(): boolean;
  openAccessSettings(): 'detail' | 'list' | 'app';
  openAppInfo(): boolean;
  isPaused(): boolean;
  setPaused(paused: boolean): void;
  queueSize(): number;
  drainQueue(): string;
}

const native: NotificationCaptureNative | null =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NotificationCaptureNative>('NotificationCapture')
    : null;

export default native;
