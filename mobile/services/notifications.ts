/**
 * @file notifications.ts
 * @description Local notification scheduling service for ExpenseTracker.
 * Schedules automated twice-daily expense reminder notifications:
 * 1. Midday Reminder (13:30 / 1:30 PM) - Lunch & morning transactions.
 * 2. Evening Wrap-up (20:30 / 8:30 PM) - Daily spending review & ledger balance.
 *
 * Implements strict runtime environment guarding to avoid Expo Go warnings.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REMINDERS_STORAGE_KEY = 'expense_tracker_daily_reminders_enabled';
const MIDDAY_NOTIFICATION_ID = 'daily_midday_expense_reminder';
const EVENING_NOTIFICATION_ID = 'daily_evening_expense_reminder';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Conditionally load expo-notifications only outside Expo Go to prevent top-level console error
let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.log('[Notifications] Module not available in this runtime.');
  }
}

/**
 * Requests local notification permissions.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (isExpoGo || !Notifications) {
    return false;
  }
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted) {
      const request = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      granted = request.granted || request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('expense-reminders', {
        name: 'Daily Expense Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      }).catch(() => {});
    }

    return Boolean(granted);
  } catch (error) {
    console.warn('[Notifications] Failed to request permissions:', error);
    return false;
  }
}

/**
 * Schedules two daily recurring reminders (1:30 PM and 8:30 PM).
 */
export async function scheduleDailyExpenseReminders(): Promise<boolean> {
  if (isExpoGo || !Notifications) {
    await AsyncStorage.setItem(REMINDERS_STORAGE_KEY, 'true');
    return true;
  }
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return false;
    }

    await cancelDailyExpenseReminders();

    // 1. Midday reminder (13:30 = 1:30 PM)
    await Notifications.scheduleNotificationAsync({
      identifier: MIDDAY_NOTIFICATION_ID,
      content: {
        title: '☀️ Midday Expense Check',
        body: 'Did you grab lunch or make a morning purchase? Take 10 seconds to record it now!',
        sound: true,
        data: { screen: '/(tabs)/add-expense' },
        ...(Platform.OS === 'android' ? { channelId: 'expense-reminders' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 13,
        minute: 30,
      },
    });

    // 2. Evening reminder (20:30 = 8:30 PM)
    await Notifications.scheduleNotificationAsync({
      identifier: EVENING_NOTIFICATION_ID,
      content: {
        title: '🌙 Daily Ledger Wrap-up',
        body: "Wrap up today's ledger! Log any remaining transactions before heading to sleep.",
        sound: true,
        data: { screen: '/(tabs)/add-expense' },
        ...(Platform.OS === 'android' ? { channelId: 'expense-reminders' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 30,
      },
    });

    await AsyncStorage.setItem(REMINDERS_STORAGE_KEY, 'true');
    return true;
  } catch (error) {
    console.warn('[Notifications] Failed to schedule daily reminders:', error);
    return false;
  }
}

/**
 * Cancels scheduled recurring daily reminders.
 */
export async function cancelDailyExpenseReminders(): Promise<void> {
  if (isExpoGo || !Notifications) {
    await AsyncStorage.setItem(REMINDERS_STORAGE_KEY, 'false');
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(MIDDAY_NOTIFICATION_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(EVENING_NOTIFICATION_ID).catch(() => {});
    await AsyncStorage.setItem(REMINDERS_STORAGE_KEY, 'false');
  } catch (error) {
    console.warn('[Notifications] Failed to cancel scheduled reminders:', error);
  }
}

/**
 * Checks if daily reminders are currently enabled in storage.
 */
export async function getDailyRemindersEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(REMINDERS_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}
