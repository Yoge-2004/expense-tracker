/**
 * @jest-environment node
 *
 * Tests loan reminder scheduling edge cases in services/notifications.ts:
 * - Midnight reminder time ("00:15") preserves hour 0 instead of falling back to 10 AM
 * - Android notifications attach REMINDERS_CHANNEL_ID
 * - ONE-TIME reminders slice ISO timestamps cleanly to YYYY-MM-DD
 */

const mockScheduleNotificationAsync = jest.fn().mockResolvedValue('notif-id');
const mockCancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'bare',
    expoConfig: { extra: { eas: { projectId: 'test-project' } } },
  },
  ExecutionEnvironment: {
    StoreClient: 'storeClient',
    Standalone: 'standalone',
    Bare: 'bare',
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: Record<string, unknown>) => obj.android ?? obj.default,
  },
}));

jest.mock('../services/appUpdate', () => ({
  APP_UPDATE_ROUTE: '/app-update',
  CURRENT_APP_VERSION: '1.0.13',
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  IosAuthorizationStatus: {
    PROVISIONAL: 3,
  },
  AndroidImportance: {
    HIGH: 4,
    MAX: 5,
  },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    DATE: 'date',
  },
}));

import { REMINDERS_CHANNEL_ID, scheduleLoanReminders } from '../services/notifications';
import type { LoanAdjustment } from '../services/loans';

describe('scheduleLoanReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves hour 00 for midnight reminderTime (e.g. "00:15") and sets Android channelId', async () => {
    const loan: LoanAdjustment = {
      id: 77,
      counterparty: 'Asha',
      type: 'LENT',
      amount: 1200,
      adjustmentDate: '2026-11-01',
      isSettled: false,
      reminderEnabled: true,
      reminderFrequency: 'DAILY',
      reminderTime: '00:15',
    };

    await scheduleLoanReminders([loan], '₹');

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const callArg = mockScheduleNotificationAsync.mock.calls[0][0];
    expect(callArg.trigger).toEqual({
      type: 'daily',
      hour: 0,
      minute: 15,
    });
    expect(callArg.content.channelId).toBe(REMINDERS_CHANNEL_ID);
    expect(callArg.content.color).toBe('#D4AF37');
  });

  it('slices ISO timestamps to YYYY-MM-DD when scheduling ONE-TIME loan reminders', async () => {
    const loan: LoanAdjustment = {
      id: 88,
      counterparty: 'Rohan',
      type: 'BORROWED',
      amount: 500,
      adjustmentDate: '2026-11-01',
      dueDate: '2099-05-10T14:30:00Z',
      isSettled: false,
      reminderEnabled: true,
      reminderFrequency: 'ONCE',
      reminderTime: '00:45',
    };

    await scheduleLoanReminders([loan], '₹');

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const callArg = mockScheduleNotificationAsync.mock.calls[0][0];
    expect(callArg.trigger.type).toBe('date');
    const scheduledDate: Date = callArg.trigger.date;
    expect(scheduledDate.getFullYear()).toBe(2099);
    expect(scheduledDate.getMonth()).toBe(4);
    expect(scheduledDate.getDate()).toBe(10);
    expect(scheduledDate.getHours()).toBe(0);
    expect(scheduledDate.getMinutes()).toBe(45);
    expect(callArg.content.channelId).toBe(REMINDERS_CHANNEL_ID);
  });
});
