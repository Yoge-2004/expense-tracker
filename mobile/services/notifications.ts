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
import { planDueReminders, planMonthEndReminders, ReminderSources, REMINDER_ID_PREFIX } from '../utils/reminderPlan';
import { apiRequest, getSession, invalidateApiCache } from './api';

const REMINDERS_STORAGE_KEY = 'expense_tracker_daily_reminders_enabled';
const MIDDAY_NOTIFICATION_ID = 'daily_midday_expense_reminder';
const EVENING_NOTIFICATION_ID = 'daily_evening_expense_reminder';

const PUSH_TOKEN_KEY = 'expense_tracker_push_token';
const SERVER_PUSH_KEY = 'expense_tracker_server_push_active';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * True once this phone is registered for server push. The server then sends the budget, bill and goal
 * alerts itself (even when the app is closed), so the on-device versions below stand down instead of
 * showing the same alert twice.
 */
async function serverPushActive(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SERVER_PUSH_KEY)) === '1';
  } catch {
    return false;
  }
}

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
      await Notifications.setNotificationChannelAsync("expense-reminders", {
        name: "Daily Expense Reminders",
        description: "Twice-daily reminders to keep your expense ledger up to date.",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#D4AF37",
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
export { parseFinancialMessage, ParsedTransaction };

const DEBIT_CHANNEL_ID = "debit-alerts";

/**
 * Triggers an immediate local push notification for a detected debit / financial transaction.
 * Notifies the user then and there when a debit message or transaction is received.
 */
export async function notifyInstantDebit(transaction: ParsedTransaction, autoAdded = false): Promise<boolean> {
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
      ? (autoAdded ? `💸 Auto-Added Debit: ${transaction.currency} ${transaction.amount?.toFixed(2)}` : `💸 Debit Alert: ${transaction.currency} ${transaction.amount?.toFixed(2)}`)
      : `💰 Transaction Alert: ${transaction.currency} ${transaction.amount?.toFixed(2)}`;

    const merchantStr = transaction.merchant ? ` at ${transaction.merchant}` : "";
    const accStr = transaction.accountTail ? ` (Card/A/c xx${transaction.accountTail})` : "";
    const suffix = autoAdded
      ? `Recorded to your expenses automatically. Tap to view ledger.`
      : `Tap to categorize or review now.`;
    const body = `Spent ${transaction.currency} ${transaction.amount?.toFixed(2)}${merchantStr}${accStr}. ${suffix}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: {
          screen: "/(tabs)/index",
          amount: transaction.amount,
          merchant: transaction.merchant,
          direction: transaction.direction,
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
 * Ingests raw SMS or push notification text, parses it, and if it is a debit:
 * 1. Automatically records the expense to the user's ledger via API (if authenticated).
 * 2. Emits an instant push notification confirming the debit was detected & added.
 */
export async function detectAndAddExpenseFromMessage(
  rawText: string,
  targetUserId?: string | null
): Promise<(ParsedTransaction & { addedToExpense: boolean }) | null> {
  const parsed = parseFinancialMessage(rawText);
  if (!parsed.isFinancial || parsed.direction !== 'DEBIT' || !parsed.amount || parsed.amount <= 0) {
    return null;
  }

  let added = false;
  try {
    let uid = targetUserId;
    if (!uid) {
      const session = await getSession();
      uid = session.userId;
    }

    if (uid) {
      // Find suitable category based on merchant text or use default
      let matchedCategoryId: number | null = null;
      try {
        const [globalCats, userCats] = await Promise.allSettled([
          apiRequest('/categories/global'),
          apiRequest(`/categories/user/${uid}`),
        ]);
        const allCats = [
          ...(globalCats.status === 'fulfilled' && Array.isArray(globalCats.value) ? globalCats.value : []),
          ...(userCats.status === 'fulfilled' && Array.isArray(userCats.value) ? userCats.value : []),
        ];

        const merchantLower = (parsed.merchant || '').toLowerCase();
        if (merchantLower) {
          const matched = allCats.find((c: any) => {
            const name = (c.name || '').toLowerCase();
            return merchantLower.includes(name) || name.includes(merchantLower);
          });
          if (matched?.id) matchedCategoryId = matched.id;
        }

        if (!matchedCategoryId && allCats.length > 0) {
          matchedCategoryId = allCats[0].id;
        }
      } catch (_) {}

      const description = parsed.merchant
        ? `${parsed.merchant}${parsed.accountTail ? ` (A/c xx${parsed.accountTail})` : ''}`
        : `Bank Debit${parsed.accountTail ? ` (A/c xx${parsed.accountTail})` : ''}`;

      const payload = {
        amount: parsed.amount,
        description,
        categoryId: matchedCategoryId ?? 1,
        expenseDate: new Date().toISOString().split('T')[0],
        isRecurring: false,
      };

      await apiRequest(`/expenses/user/${uid}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      invalidateApiCache();
      added = true;
    }
  } catch (err) {
    console.warn('[Notifications] Failed to auto-record debit to backend:', err);
  }

  await notifyInstantDebit(parsed, added);
  return { ...parsed, addedToExpense: added };
}

/**
 * Ingests raw SMS or push notification text and immediately dispatches a notification and adds expense if debit.
 */
export async function processIncomingMessageForDebitNotification(
  rawText: string,
  userId?: string | null
): Promise<ParsedTransaction | null> {
  const res = await detectAndAddExpenseFromMessage(rawText, userId);
  return res;
}

/**
 * Registers an on-device listener for incoming push/local notifications outside Expo Go to auto-detect bank debit alerts.
 */
export function registerIncomingNotificationListener(userId?: string | null) {
  if (isExpoGo || !Notifications) return null;
  try {
    const sub = Notifications.addNotificationReceivedListener(async (notification: any) => {
      const title = notification?.request?.content?.title || '';
      const body = notification?.request?.content?.body || '';
      const fullText = `${title} ${body}`.trim();
      if (fullText) {
        await detectAndAddExpenseFromMessage(fullText, userId);
      }
    });
    return sub;
  } catch (e) {
    console.warn('[Notifications] Failed to register incoming notification listener:', e);
    return null;
  }
}

const ALERTS_CHANNEL_ID = 'financial-alerts';

/**
 * Triggers a push notification when Salary or a major income stream is received.
 */
export async function notifySalaryCredit(amount: number, currency: string = '₹', source: string = 'Salary'): Promise<boolean> {
  if (isExpoGo || !Notifications) return false;
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💵 ${source} Credited: ${currency} ${amount.toLocaleString('en-IN')}`,
        body: 'Your earnings have landed. Allocate to savings goals, SIPs, and fixed commitments before spending begins!',
        sound: true,
        data: { screen: '/(tabs)/index', tab: 'incomes' },
        ...(Platform.OS === 'android' ? { channelId: DEBIT_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn('[Notifications] Failed to trigger salary notification:', error);
    return false;
  }
}

/**
 * Triggers a push notification when a category budget crosses 80% or 100%.
 */
export async function notifyBudgetThresholdAlert(categoryName: string, percentSpent: number, remainingAmt: number, currency: string = '₹'): Promise<boolean> {
  if (isExpoGo || !Notifications) return false;
  if (await serverPushActive()) return false;
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return false;

    const isExceeded = percentSpent >= 100;
    const title = isExceeded
      ? `🚨 Budget Exceeded: ${categoryName}`
      : `⚠️ Budget Warning: ${categoryName} (${Math.round(percentSpent)}%)`;
    const body = isExceeded
      ? `You have exceeded your limit for ${categoryName} by ${currency} ${Math.abs(remainingAmt).toLocaleString('en-IN')}.`
      : `You have used ${Math.round(percentSpent)}% of your ${categoryName} budget. Remaining buffer: ${currency} ${remainingAmt.toLocaleString('en-IN')}.`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { screen: '/(tabs)/index' },
        ...(Platform.OS === 'android' ? { channelId: DEBIT_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn('[Notifications] Failed to trigger budget alert:', error);
    return false;
  }
}

/**
 * Triggers a reminder 2 days before a recurring subscription renews.
 */
export async function notifySubscriptionDue(subscriptionName: string, amount: number, dueDate: string, currency: string = '₹'): Promise<boolean> {
  if (isExpoGo || !Notifications) return false;
  if (await serverPushActive()) return false;
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔁 Upcoming Renewal: ${subscriptionName}`,
        body: `${subscriptionName} (${currency} ${amount.toFixed(2)}) is scheduled to renew on ${dueDate}. Review or ensure adequate balance.`,
        sound: true,
        data: { screen: '/(tabs)/subscriptions' },
        ...(Platform.OS === 'android' ? { channelId: DEBIT_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn('[Notifications] Failed to trigger subscription notification:', error);
    return false;
  }
}

/**
 * Triggers a milestone celebration notification when a savings goal milestone is hit.
 */
export async function notifySavingsGoalMilestone(goalName: string, progressPercent: number, savedAmount: number, targetAmount: number, currency: string = '₹'): Promise<boolean> {
  if (isExpoGo || !Notifications) return false;
  if (await serverPushActive()) return false;
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return false;

    const isComplete = progressPercent >= 100;
    const title = isComplete
      ? `🎉 Goal Accomplished: ${goalName}!`
      : `🎯 Milestone Reached: ${goalName} (${progressPercent}%)`;
    const body = isComplete
      ? `Congratulations! You have reached 100% of your target: ${currency} ${savedAmount.toLocaleString('en-IN')}.`
      : `Great progress! You have saved ${currency} ${savedAmount.toLocaleString('en-IN')} of ${currency} ${targetAmount.toLocaleString('en-IN')} (${progressPercent}%).`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { screen: '/(tabs)/index' },
        ...(Platform.OS === 'android' ? { channelId: DEBIT_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn('[Notifications] Failed to trigger savings milestone notification:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------------------------------
// More on-device reminders, scheduled the same way as the 1:30 PM and 8:30 PM ones (no server needed)
// ---------------------------------------------------------------------------------------------------

const SMART_REMINDERS_KEY = 'expense_tracker_smart_reminders_enabled';
const REMINDERS_CHANNEL_ID = 'expense-reminders';

/** Serialises scheduling runs so a launch-time run and a data-refresh run never cancel each other's work. */
let smartQueue: Promise<unknown> = Promise.resolve();

/** Repeating reminders at fixed times. Built on demand because `Notifications` may be unavailable (Expo Go). */
function fixedSmartReminders() {
  const types = Notifications.SchedulableTriggerInputTypes;
  return [
    {
      id: `${REMINDER_ID_PREFIX}morning`,
      title: '☀️ Plan your day',
      body: "Check your budgets and today's bills before you spend.",
      trigger: { type: types.DAILY, hour: 9, minute: 0 },
    },
    {
      id: `${REMINDER_ID_PREFIX}weekly_review`,
      title: '📊 Weekly review',
      body: 'See how your week went: spending vs last week and your top categories.',
      trigger: { type: types.WEEKLY, weekday: 1, hour: 19, minute: 0 }, // Sunday 7:00 PM
    },
    {
      id: `${REMINDER_ID_PREFIX}month_start`,
      title: '🗓️ New month, fresh start',
      body: "Set this month's budgets and log your salary when it arrives.",
      trigger: { type: types.MONTHLY, day: 1, hour: 9, minute: 0 },
    },
  ];
}

async function scheduleSmart(id: string, title: string, body: string, screen: string, trigger: Record<string, unknown>) {
  await Notifications.scheduleNotificationAsync({
    identifier: id, // a stable id: scheduling again replaces the reminder instead of duplicating it
    content: { title, body, sound: true, data: { screen } },
    trigger: Platform.OS === 'android' ? { ...trigger, channelId: REMINDERS_CHANNEL_ID } : trigger,
  });
}

async function cancelSmartMatching(keep: Set<string>): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n: any) => typeof n.identifier === 'string' && n.identifier.startsWith(REMINDER_ID_PREFIX) && !keep.has(n.identifier))
      .map((n: any) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );
}

async function runSmartSchedule(sources?: ReminderSources): Promise<boolean> {
  if (isExpoGo || !Notifications) return false;
  if (!(await getSmartRemindersEnabled())) return false;
  if (!(await requestNotificationPermissions())) return false;

  const fixed = fixedSmartReminders();
  const dated = sources ? planDueReminders(sources) : null;
  // The real last day of each coming month (28, 29, 30 or 31): scheduled by date, not on a fixed day.
  const monthEnds = planMonthEndReminders();

  // An earlier build repeated a "month end" reminder on the 28th of every month; remove it.
  await Notifications.cancelScheduledNotificationAsync(`${REMINDER_ID_PREFIX}month_end`).catch(() => {});

  // Drop reminders that no longer apply (a bill that was paid, a deleted goal). Without data only the
  // fixed ones are touched, so a launch-time run never wipes the bill reminders from the last refresh.
  if (dated) {
    await cancelSmartMatching(new Set([
      ...fixed.map((f) => f.id),
      ...monthEnds.map((r) => r.id),
      ...dated.map((r) => r.id),
    ]));
  }
  for (const f of fixed) {
    await scheduleSmart(f.id, f.title, f.body, '/(tabs)', f.trigger);
  }
  for (const r of [...monthEnds, ...(dated ?? [])]) {
    await scheduleSmart(r.id, r.title, r.body, r.screen, {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: r.date,
    });
  }
  return true;
}

/**
 * Schedules the extra reminders: a morning plan, a Sunday-evening review, month start and month end at
 * fixed times, plus (when `sources` is given) bills, salary and savings top-ups on their due dates.
 * Safe to call as often as the data changes. Returns true when they are scheduled.
 */
export function scheduleSmartReminders(sources?: ReminderSources): Promise<boolean> {
  const run = smartQueue.then(() => runSmartSchedule(sources));
  smartQueue = run.catch(() => false);
  return run.catch((error) => {
    console.warn('[Notifications] Failed to schedule reminders:', error);
    return false;
  });
}

/** Whether the extra reminders are switched on (they are by default, like the daily ones). */
export async function getSmartRemindersEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(SMART_REMINDERS_KEY);
    return value === null ? true : value === 'true';
  } catch {
    return true;
  }
}

/** Switches the extra reminders on; returns false (and stays off) when permission is refused. */
export async function enableSmartReminders(sources?: ReminderSources): Promise<boolean> {
  await AsyncStorage.setItem(SMART_REMINDERS_KEY, 'true');
  const scheduled = await scheduleSmartReminders(sources);
  if (!scheduled) await AsyncStorage.setItem(SMART_REMINDERS_KEY, 'false').catch(() => {});
  return scheduled;
}

/** Switches the extra reminders off and removes every one that is scheduled. */
export async function disableSmartReminders(): Promise<void> {
  await AsyncStorage.setItem(SMART_REMINDERS_KEY, 'false');
  if (isExpoGo || !Notifications) return;
  const run = smartQueue.then(() => cancelSmartMatching(new Set()));
  smartQueue = run.catch(() => undefined);
  await run.catch((error) => console.warn('[Notifications] Failed to cancel reminders:', error));
}

// ---------------------------------------------------------------------------------------------------
// Confirmation when you record a debit (expense) or a credit (income)
// ---------------------------------------------------------------------------------------------------

const TRANSACTION_ALERTS_KEY = 'expense_tracker_transaction_alerts_enabled';

/** Whether a notification is shown each time you record an expense or income (on by default). */
export async function getTransactionAlertsEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(TRANSACTION_ALERTS_KEY);
    return value === null ? true : value === 'true';
  } catch {
    return true;
  }
}

export async function setTransactionAlertsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(TRANSACTION_ALERTS_KEY, String(enabled));
}

export interface RecordedTransaction {
  /** DEBIT for an expense, CREDIT for income. */
  kind: 'DEBIT' | 'CREDIT';
  amount: number;
  currency?: string;
  /** Category for a debit, source for a credit. */
  label: string;
  /** Description or note. */
  detail?: string;
}

/**
 * Shows a notification right after you record a debit (expense) or a credit (income), so every entry is
 * confirmed with its amount. Only for new entries; edits do not notify. Returns true when it was shown.
 */
export async function notifyTransactionRecorded(transaction: RecordedTransaction): Promise<boolean> {
  if (isExpoGo || !Notifications) return false;
  try {
    if (!(await getTransactionAlertsEnabled())) return false;
    if (!(await requestNotificationPermissions())) return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(DEBIT_CHANNEL_ID, {
        name: 'Instant Debit & Transaction Alerts',
        description: 'Real-time alerts when debit/payment transactions occur.',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 200, 100, 200],
        enableVibrate: true,
        showBadge: true,
      }).catch(() => {});
    }

    const currency = transaction.currency ?? '₹';
    const amountText = `${currency} ${transaction.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    const isDebit = transaction.kind === 'DEBIT';
    const body = [transaction.label, transaction.detail].filter((part) => part && part.trim()).join(' · ');

    await Notifications.scheduleNotificationAsync({
      content: {
        title: isDebit ? `💸 Debit recorded: ${amountText}` : `💵 Credit recorded: ${amountText}`,
        body: body || (isDebit ? 'Expense saved.' : 'Income saved.'),
        sound: true,
        data: { screen: '/(tabs)' },
        ...(Platform.OS === 'android' ? { channelId: DEBIT_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn('[Notifications] Failed to show transaction confirmation:', error);
    return false;
  }
}

/**
 * Registers this phone with the server so it can receive push notifications. Never shows a permission
 * prompt (that happens at sign-up or in settings); it only registers when permission is already granted.
 * Returns true when the phone is registered.
 */
export async function registerPushToken(userId: string): Promise<boolean> {
  if (isExpoGo || !Notifications) return false;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return false;

    if (Platform.OS === 'android') {
      // Android 8+ needs a channel before a push token can be used to display anything.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await apiRequest(`/notifications/user/${userId}/devices`, {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' }),
    });
    await AsyncStorage.multiSet([[PUSH_TOKEN_KEY, token], [SERVER_PUSH_KEY, '1']]);
    return true;
  } catch (e) {
    console.log('[Notifications] Push registration skipped:', e);
    return false;
  }
}

/** Stops server push to this phone (call while still signed in, e.g. on logout). */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token) {
      await apiRequest(`/notifications/user/${userId}/devices?token=${encodeURIComponent(token)}`, { method: 'DELETE' });
    }
  } catch (e) {
    console.log('[Notifications] Push unregistration skipped:', e);
  } finally {
    await AsyncStorage.multiRemove([PUSH_TOKEN_KEY, SERVER_PUSH_KEY]).catch(() => {});
  }
}
