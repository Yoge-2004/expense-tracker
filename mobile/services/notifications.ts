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
        description: 'Twice-daily reminders to keep your expense ledger up to date.',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF37',
        enableVibrate: true,
        showBadge: true,
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
  // Expo Go cannot schedule these notifications in the current runtime. Do not
  // report success or persist an enabled state when nothing was scheduled.
  if (isExpoGo || !Notifications) {
    return false;
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
    // Scheduling is transactional: if either reminder fails, remove any reminder
    // that may already have been created so storage never reports a false state.
    if (Notifications) {
      await Notifications.cancelScheduledNotificationAsync(MIDDAY_NOTIFICATION_ID).catch(() => {});
      await Notifications.cancelScheduledNotificationAsync(EVENING_NOTIFICATION_ID).catch(() => {});
    }
    await AsyncStorage.setItem(REMINDERS_STORAGE_KEY, 'false').catch(() => {});
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

import { parseFinancialMessage, ParsedTransaction } from "./debitParser";

const DEBIT_CHANNEL_ID = "debit-alerts";

/**
 * Triggers an immediate local push notification for a detected debit / financial transaction.
 * Notifies the user then and there when a debit message or transaction is received.
 */
export async function notifyInstantDebit(transaction: ParsedTransaction): Promise<boolean> {
  if (isExpoGo || !Notifications) {
    return false;
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return false;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(DEBIT_CHANNEL_ID, {
        name: "Instant Debit & Transaction Alerts",
        description: "Real-time alerts when debit/payment transactions occur.",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: "#E05D5D",
        enableVibrate: true,
        showBadge: true,
      }).catch(() => {});
    }

    const title = transaction.direction === "DEBIT"
      ? `💸 Debit Alert: ${transaction.currency} ${transaction.amount?.toFixed(2)}`
      : `💰 Transaction Alert: ${transaction.currency} ${transaction.amount?.toFixed(2)}`;

    const merchantStr = transaction.merchant ? ` at ${transaction.merchant}` : "";
    const accStr = transaction.accountTail ? ` (Card/A/c xx${transaction.accountTail})` : "";
    const body = `Spent ${transaction.currency} ${transaction.amount?.toFixed(2)}${merchantStr}${accStr}. Tap to categorize or review now.`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: {
          screen: "/(tabs)/add-expense",
          amount: transaction.amount,
          merchant: transaction.merchant,
          direction: transaction.direction
        },
        ...(Platform.OS === "android" ? { channelId: DEBIT_CHANNEL_ID } : {}),
      },
      trigger: null, // null trigger schedules it immediately!
    });

    return true;
  } catch (error) {
    console.warn("[Notifications] Failed to trigger instant debit notification:", error);
    return false;
  }
}

/**
 * Ingests raw SMS or push notification text and immediately dispatches a notification if it is a debit.
 */
export async function processIncomingMessageForDebitNotification(rawText: string): Promise<ParsedTransaction | null> {
  const parsed = parseFinancialMessage(rawText);
  if (parsed.isFinancial && parsed.direction === "DEBIT") {
    await notifyInstantDebit(parsed);
    return parsed;
  }
  return null;
}
