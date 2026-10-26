import {
  formatReminderMoney,
  planMonthEndReminders,
  planDueReminders,
  REMINDER_ID_PREFIX,
  ReminderSources,
} from '../utils/reminderPlan';

describe('reminderPlan', () => {
  describe('formatReminderMoney', () => {
    it('formats currency symbol without trailing whitespace', () => {
      expect(formatReminderMoney('₹', 1500)).toBe('₹1,500');
      expect(formatReminderMoney('$', 250)).toBe('$250');
      expect(formatReminderMoney('€', 99)).toBe('€99');
    });

    it('formats alpha currency code with a single space', () => {
      expect(formatReminderMoney('USD', 500)).toBe('USD 500');
      expect(formatReminderMoney('EUR', 1200)).toBe('EUR 1,200');
      expect(formatReminderMoney('INR', 35000)).toBe('INR 35,000');
    });

    it('handles zero, null, and undefined values safely', () => {
      expect(formatReminderMoney('₹', 0)).toBe('₹0');
      expect(formatReminderMoney('₹', undefined)).toBe('₹0');
      expect(formatReminderMoney('', 100)).toBe('₹100');
    });
  });

  describe('planMonthEndReminders', () => {
    it('schedules month end reminders for the upcoming months', () => {
      const now = new Date(2026, 0, 15, 10, 0, 0); // Jan 15, 2026
      const reminders = planMonthEndReminders(now, 9, 3);
      expect(reminders.length).toBe(3);
      expect(reminders[0].id).toContain('month_end_202601');
      expect(reminders[0].date.getHours()).toBe(9);
      expect(reminders[0].screen).toBe('/(tabs)');
    });
  });

  describe('planDueReminders', () => {
    it('generates reminders for upcoming subscriptions, incomes, and savings goals', () => {
      const now = new Date(2026, 2, 10, 8, 0, 0); // March 10, 2026
      const sources: ReminderSources = {
        currency: '₹',
        subscriptions: [
          { id: 1, description: 'Netflix', amount: 649, nextDueDate: '2026-03-12' },
        ],
        incomes: [
          { id: 2, source: 'Acme Corp Salary', amount: 85000, isRecurring: true, nextDueDate: '2026-03-15' },
        ],
        goals: [
          { id: 3, name: 'Emergency Fund', isRecurring: true, recurringAmount: 5000, status: 'IN_PROGRESS', nextDueDate: '2026-03-11' },
        ],
      };

      const reminders = planDueReminders(sources, now, 9, 14, 20);
      expect(reminders.length).toBeGreaterThan(0);

      // Verify subscription reminder body formatting
      const subReminder = reminders.find((r) => r.id.includes('bill_1'));
      expect(subReminder).toBeDefined();
      expect(subReminder?.body).toContain('₹649 is due');

      // Verify income reminder
      const incomeReminder = reminders.find((r) => r.id.includes('income_2'));
      expect(incomeReminder).toBeDefined();
      expect(incomeReminder?.title).toContain('Acme Corp Salary');
      expect(incomeReminder?.body).toContain('₹85,000 is due today');

      // Verify goal reminder
      const goalReminder = reminders.find((r) => r.id.includes('goal_3'));
      expect(goalReminder).toBeDefined();
      expect(goalReminder?.body).toContain('Put ₹5,000 toward Emergency Fund');
    });

    it('ignores completed goals and past due dates', () => {
      const now = new Date(2026, 2, 10, 8, 0, 0);
      const sources: ReminderSources = {
        goals: [
          { id: 10, name: 'Done Goal', isRecurring: true, recurringAmount: 2000, status: 'COMPLETED', nextDueDate: '2026-03-11' },
        ],
        subscriptions: [
          { id: 20, description: 'Old Bill', amount: 100, nextDueDate: '2026-02-01' },
        ],
      };
      const reminders = planDueReminders(sources, now, 9, 14, 20);
      expect(reminders.length).toBe(0);
    });
  });
});
