/**
 * @file LoansSection.tsx
 * @description Dedicated Mobile Component for managing Peer Loans & Casual Friend Adjustments.
 * Refactored to adhere to SOLID principles (SRP, DIP, Open/Closed):
 * - Delegates KPI calculations & rendering to `LoanMetricsHeader`.
 * - Delegates filter pills and scrolling to `LoanFilterTabs`.
 * - Delegates individual transaction cards, settlement toggles, and swipe actions to `LoanItemCard`.
 * - Delegates Add/Edit forms and customized push notification settings to `LoanFormModal`.
 * - Delegates previous expense linkage search to `LoanExpensePickerModal`.
 * - Maintains 100% backward-compatible component props interface.
 */

import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  LoanAdjustment,
  createLoan,
  updateLoan,
  toggleSettleLoan,
  deleteLoan,
  getLoanMetrics,
} from '../services/loans';
import { scheduleLoanReminders } from '../services/notifications';
import {
  LoanExpenseCandidate,
  LoanFilterTab,
  LoansSectionProps,
  ReminderFrequency,
} from './loans/loansTypes';
import { loansStyles as styles } from './loans/loansStyles';
import { LoanMetricsHeader } from './loans/LoanMetricsHeader';
import { LoanFilterTabs } from './loans/LoanFilterTabs';
import { LoanItemCard } from './loans/LoanItemCard';
import { LoanFormModal } from './loans/LoanFormModal';
import { LoanExpensePickerModal } from './loans/LoanExpensePickerModal';

export type { LoanExpenseCandidate } from './loans/loansTypes';

export const LoansSection: React.FC<LoansSectionProps> = React.memo(({
  userId,
  currSymbol,
  isStealthMode,
  isLargeScreen: _isLargeScreen,
  colors: c,
  theme,
  loans,
  loanMetrics,
  expenses = [],
  setLoans,
  setLoanMetrics,
  showAlert,
}) => {
  const isLight = theme === 'light';

  // Filter state
  const [activeFilter, setActiveFilter] = useState<LoanFilterTab>('ALL');

  // Modal form state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanAdjustment | null>(null);
  const [formType, setFormType] = useState<'LENT' | 'BORROWED'>('LENT');
  const [formCounterparty, setFormCounterparty] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formExpenseId, setFormExpenseId] = useState<number | null>(null);
  const [formReminderEnabled, setFormReminderEnabled] = useState(false);
  const [formReminderDate, setFormReminderDate] = useState('');
  const [formReminderTime, setFormReminderTime] = useState('10:00');
  const [formReminderFrequency, setFormReminderFrequency] = useState<ReminderFrequency>('DAILY');
  const [showExpensePicker, setShowExpensePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute Loan Category expenses
  const loanCategoryExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const cat = (e.categoryName || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      return cat.includes('loan') || cat.includes('borrow') || desc.includes('loan to') || desc.includes('loan from');
    });
  }, [expenses]);

  // Filtered loans list
  const filteredLoans = useMemo(() => {
    return loans.filter((item) => {
      if (activeFilter === 'LENT') return item.type === 'LENT';
      if (activeFilter === 'BORROWED') return item.type === 'BORROWED';
      if (activeFilter === 'PENDING') return !item.isSettled;
      return true;
    });
  }, [loans, activeFilter]);

  // Refresh metrics helper
  const refreshMetrics = async () => {
    if (!userId) return;
    try {
      const refreshed = await getLoanMetrics(userId);
      setLoanMetrics(refreshed);
    } catch {
      // Non-critical background refresh failure
    }
  };

  const handleOpenAddModal = (initialExpense?: LoanExpenseCandidate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditingLoan(null);
    setFormType('LENT');
    if (initialExpense) {
      setFormExpenseId(initialExpense.id);
      setFormAmount(String(initialExpense.amount || ''));
      setFormCounterparty('');
      setFormNotes(`Split for: ${initialExpense.description || 'Expense'}`);
      setFormDueDate('');
    } else {
      setFormExpenseId(null);
      setFormCounterparty('');
      setFormAmount('');
      setFormDueDate('');
      setFormNotes('');
    }
    setFormReminderEnabled(false);
    setFormReminderDate('');
    setFormReminderTime('10:00');
    setFormReminderFrequency('DAILY');
    setShowExpensePicker(false);
    setModalVisible(true);
  };

  const handleOpenEditModal = (loan: LoanAdjustment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditingLoan(loan);
    setFormType(loan.type);
    setFormCounterparty(loan.counterparty);
    setFormAmount(String(loan.amount));
    setFormDueDate(loan.dueDate || '');
    setFormNotes(loan.notes || '');
    setFormExpenseId(loan.expenseId || null);
    setFormReminderEnabled(Boolean(loan.reminderEnabled));
    setFormReminderDate(loan.reminderDate || '');
    setFormReminderTime(loan.reminderTime || '10:00');
    setFormReminderFrequency((loan.reminderFrequency as ReminderFrequency) || 'DAILY');
    setShowExpensePicker(false);
    setModalVisible(true);
  };

  const handleSelectExpense = (exp: LoanExpenseCandidate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFormExpenseId(exp.id);
    if (!formAmount) {
      setFormAmount(String(exp.amount));
    }
    if (!formNotes) {
      setFormNotes(`Split from: ${exp.description || 'Expense'}`);
    }
    setShowExpensePicker(false);
  };

  const handleToggleSettle = async (loan: LoanAdjustment) => {
    if (!userId) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const updated = await toggleSettleLoan(loan.id, userId);
      const nextList = loans.map((l) => (l.id === loan.id ? updated : l));
      setLoans(nextList);
      scheduleLoanReminders(nextList, currSymbol).catch(() => {});
      await refreshMetrics();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert(
        updated.isSettled ? 'Marked Settled' : 'Reopened Adjustment',
        `Adjustment with ${loan.counterparty} marked as ${updated.isSettled ? 'settled' : 'pending'}.`,
        undefined,
        'success'
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not update settlement status.';
      showAlert('Error', msg, undefined, 'error');
    }
  };

  const handleDelete = (loan: LoanAdjustment) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    showAlert(
      'Delete Adjustment?',
      `Are you sure you want to delete ${loan.type === 'LENT' ? 'lent record for' : 'borrowed record from'} ${loan.counterparty} (${currSymbol}${Number(loan.amount).toLocaleString()})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLoan(loan.id, userId);
              const nextList = loans.filter((l) => l.id !== loan.id);
              setLoans(nextList);
              scheduleLoanReminders(nextList, currSymbol).catch(() => {});
              await refreshMetrics();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              showAlert('Deleted', 'Record removed successfully.', undefined, 'success');
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Could not delete record.';
              showAlert('Delete Failed', msg, undefined, 'error');
            }
          },
        },
      ],
      'destructive'
    );
  };

  const handleSave = async () => {
    if (!userId) return;
    const name = formCounterparty.trim();
    const amt = Number.parseFloat(formAmount);

    if (!name) {
      showAlert('Validation Error', 'Please enter a friend or contact name.', undefined, 'error');
      return;
    }
    if (Number.isNaN(amt) || amt <= 0) {
      showAlert('Validation Error', 'Please enter a valid amount greater than 0.', undefined, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        counterparty: name,
        type: formType,
        amount: amt,
        adjustmentDate: editingLoan?.adjustmentDate || new Date().toISOString().split('T')[0],
        dueDate: formDueDate.trim() || undefined,
        notes: formNotes.trim() || undefined,
        expenseId: formExpenseId || undefined,
        reminderEnabled: formReminderEnabled,
        reminderDate: formReminderDate.trim() || formDueDate.trim() || undefined,
        reminderTime: formReminderTime.trim() || '10:00',
        reminderFrequency: formReminderFrequency,
      };

      let nextList = loans;
      if (editingLoan) {
        const updated = await updateLoan(editingLoan.id, userId, payload);
        nextList = loans.map((l) => (l.id === editingLoan.id ? updated : l));
        setLoans(nextList);
        showAlert('Updated', 'Peer adjustment updated successfully.', undefined, 'success');
      } else {
        const created = await createLoan(userId, payload);
        nextList = [created, ...loans];
        setLoans(nextList);
        showAlert('Created', 'New peer adjustment recorded.', undefined, 'success');
      }

      scheduleLoanReminders(nextList, currSymbol).catch(() => {});
      await refreshMetrics();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setModalVisible(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not save peer adjustment.';
      showAlert('Error', msg, undefined, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedExpenseObj = useMemo(() => {
    if (!formExpenseId) return null;
    return expenses.find((e) => e.id === formExpenseId) || null;
  }, [formExpenseId, expenses]);

  return (
    <View style={[styles.container, { backgroundColor: c.card, borderColor: c.border }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.titleIconBadge, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="people" size={18} color={c.primary} />
          </View>
          <View>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Loans & Friend Adjustments</Text>
            <Text style={[styles.sectionSubtitle, { color: c.textMuted }]}>
              Casual friend IOUs, splits & personal loans
            </Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Add loan adjustment"
          onPress={() => handleOpenAddModal()}
          style={[styles.addBtn, { backgroundColor: c.primary }]}
        >
          <Ionicons name="add" size={16} color={c.onPrimary} />
          <Text style={[styles.addBtnText, { color: c.onPrimary }]}>New</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Metric Cards */}
      <LoanMetricsHeader
        loanMetrics={loanMetrics}
        loansCount={loans.length}
        currSymbol={currSymbol}
        isStealthMode={isStealthMode}
        colors={c}
      />

      {/* Loan Category Migration Banner */}
      {loanCategoryExpenses.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Convert ${loanCategoryExpenses.length} transactions tagged as loan`}
          onPress={() => handleOpenAddModal(loanCategoryExpenses[0])}
          style={[
            styles.loanNoticeCard,
            {
              backgroundColor: c.fillSubtle,
              borderColor: c.primary + '4D',
            },
          ]}
        >
          <View style={styles.loanNoticeLeft}>
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={15} color={c.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.loanNoticeTitle, { color: c.text }]}>
                {loanCategoryExpenses.length} transaction(s) tagged as &quot;Loan&quot;
              </Text>
              <Text style={[styles.loanNoticeSub, { color: c.textMuted }]}>
                Tap to convert into Peer Loans & keep living expenses separated.
              </Text>
            </View>
          </View>
          <View style={[styles.loanNoticeActionBtn, { backgroundColor: c.primary }]}>
            <Text style={[styles.loanNoticeActionText, { color: c.onPrimary }]}>
              Convert
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Filter Tabs */}
      <LoanFilterTabs
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        colors={c}
        theme={theme}
      />

      {/* List / Items Container */}
      <View style={[styles.listWrapper, { borderColor: c.border }]}>
        {filteredLoans.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color={c.textMuted} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>No records match</Text>
            <Text style={[styles.emptySub, { color: c.textMuted }]}>
              {loans.length === 0
                ? 'Tap "New" above to log money lent to friends or loans borrowed.'
                : 'No adjustments under this filter.'}
            </Text>
          </View>
        ) : (
          filteredLoans.map((loan) => (
            <LoanItemCard
              key={loan.id}
              loan={loan}
              colors={c}
              currSymbol={currSymbol}
              isLight={isLight}
              isStealthMode={isStealthMode}
              onToggleSettle={handleToggleSettle}
              onEdit={handleOpenEditModal}
              onDelete={handleDelete}
            />
          ))
        )}
      </View>

      {/* Add / Edit Modal */}
      <LoanFormModal
        visible={modalVisible}
        editingLoan={editingLoan}
        formType={formType}
        formCounterparty={formCounterparty}
        formAmount={formAmount}
        formDueDate={formDueDate}
        formNotes={formNotes}
        formExpenseId={formExpenseId}
        formReminderEnabled={formReminderEnabled}
        formReminderDate={formReminderDate}
        formReminderTime={formReminderTime}
        formReminderFrequency={formReminderFrequency}
        selectedExpenseObj={selectedExpenseObj}
        hasExpenses={expenses.length > 0}
        isSubmitting={isSubmitting}
        currSymbol={currSymbol}
        colors={c}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onSetFormType={setFormType}
        onSetFormCounterparty={setFormCounterparty}
        onSetFormAmount={setFormAmount}
        onSetFormDueDate={setFormDueDate}
        onSetFormNotes={setFormNotes}
        onClearLinkedExpense={() => setFormExpenseId(null)}
        onOpenExpensePicker={() => setShowExpensePicker(true)}
        onToggleReminderEnabled={() => setFormReminderEnabled((v) => !v)}
        onSetReminderFrequency={setFormReminderFrequency}
        onSetReminderTime={setFormReminderTime}
        onSetReminderDate={setFormReminderDate}
      />

      {/* Expense Picker Bottom Sheet */}
      <LoanExpensePickerModal
        visible={showExpensePicker}
        expenses={expenses}
        colors={c}
        currSymbol={currSymbol}
        onClose={() => setShowExpensePicker(false)}
        onSelectExpense={handleSelectExpense}
      />
    </View>
  );
});

LoansSection.displayName = 'LoansSection';
