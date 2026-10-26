/**
 * @file LoansSection.tsx
 * @description Dedicated Mobile Component for managing Peer Loans & Casual Friend Adjustments.
 * Displays:
 * - 3-metric KPI cards: Owed to You (Receivable), You Owe (Payable), Net Peer Position.
 * - Filter pills: All, Owed to You, You Owe, Pending.
 * - Dynamic list of peer IOUs with 1-tap settlement toggles, edit and delete.
 * - Ability to connect/link previous expenses to loans & bill splits.
 * - Customized reminder scheduling (time, frequency, date) to collect or give money.
 * - Theme-adaptive Add / Edit Modal with light and dark mode styling.
 * - Stealth mode masking support.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AnimatedCard } from './AnimatedCard';
import { ThemedScrollView } from './ThemedScrollbar';
import { ThemeColors } from '../constants/theme';
import {
  LoanAdjustment,
  LoanMetrics,
  LoanType,
  createLoan,
  updateLoan,
  toggleSettleLoan,
  deleteLoan,
  getLoanMetrics,
} from '../services/loans';
import { scheduleLoanReminders } from '../services/notifications';

interface LoansSectionProps {
  userId: string | number | null;
  currSymbol: string;
  isStealthMode: boolean;
  isLargeScreen: boolean;
  colors: ThemeColors;
  theme: 'light' | 'dark';
  loans: LoanAdjustment[];
  loanMetrics: LoanMetrics | null;
  expenses?: any[];
  setLoans: React.Dispatch<React.SetStateAction<LoanAdjustment[]>>;
  setLoanMetrics: React.Dispatch<React.SetStateAction<LoanMetrics | null>>;
  showAlert: (title: string, message: string, buttons?: any[], type?: any) => void;
}

export const LoansSection: React.FC<LoansSectionProps> = React.memo(({

  userId,
  currSymbol,
  isStealthMode,
  isLargeScreen,
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
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'LENT' | 'BORROWED' | 'PENDING'>('ALL');

  // Modal form state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanAdjustment | null>(null);
  const [formType, setFormType] = useState<LoanType>('LENT');
  const [formCounterparty, setFormCounterparty] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formExpenseId, setFormExpenseId] = useState<number | null>(null);
  const [formReminderEnabled, setFormReminderEnabled] = useState(false);
  const [formReminderDate, setFormReminderDate] = useState('');
  const [formReminderTime, setFormReminderTime] = useState('10:00');
  const [formReminderFrequency, setFormReminderFrequency] = useState<'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [showExpensePicker, setShowExpensePicker] = useState(false);
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [expenseFilterTab, setExpenseFilterTab] = useState<'ALL' | 'LOAN'>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute Loan Category expenses
  const loanCategoryExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const cat = (e.categoryName || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      return cat.includes('loan') || cat.includes('borrow') || desc.includes('loan to') || desc.includes('loan from');
    });
  }, [expenses]);

  const filteredExpensesList = useMemo(() => {
    let list = expenseFilterTab === 'LOAN' ? loanCategoryExpenses : expenses;
    if (expenseSearchQuery.trim()) {
      const q = expenseSearchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          (e.description || '').toLowerCase().includes(q) ||
          (e.categoryName || '').toLowerCase().includes(q) ||
          String(e.amount).includes(q)
      );
    }
    return list;
  }, [expenses, loanCategoryExpenses, expenseFilterTab, expenseSearchQuery]);

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

  const handleOpenAddModal = (initialExpense?: any) => {
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
    setFormReminderFrequency((loan.reminderFrequency as any) || 'DAILY');
    setShowExpensePicker(false);
    setModalVisible(true);
  };

  const handleSelectExpense = (exp: any) => {
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
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not update settlement status.', undefined, 'error');
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
            } catch (e: any) {
              showAlert('Delete Failed', e?.message || 'Could not delete record.', undefined, 'error');
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
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not save peer adjustment.', undefined, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (val: number, prefix: string = '') => {
    if (isStealthMode) return `${prefix}${currSymbol}••••••`;
    return `${prefix}${currSymbol}${Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  const lentPending = loanMetrics?.lentPending ?? 0;
  const borrowedPending = loanMetrics?.borrowedPending ?? 0;
  const netPosition = loanMetrics?.netBalance ?? (lentPending - borrowedPending);

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
          onPress={() => handleOpenAddModal()}
          style={[styles.addBtn, { backgroundColor: c.primary }]}
          accessibilityLabel="Add loan adjustment"
        >
          <Ionicons name="add" size={16} color={isLight ? '#0F172A' : '#10120E'} />
          <Text style={[styles.addBtnText, { color: isLight ? '#0F172A' : '#10120E' }]}>New</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Metric Cards */}
      <View style={styles.metricsGrid}>
        {/* Card 1: Owed to You */}
        <AnimatedCard
          style={[
            styles.metricCard,
            {
              backgroundColor: isLight ? '#F0FDF4' : 'rgba(16, 185, 129, 0.08)',
              borderColor: isLight ? '#BBF7D0' : 'rgba(16, 185, 129, 0.25)',
            },
          ]}
          scaleTo={0.97}
        >
          <View style={styles.metricTop}>
            <Text style={[styles.metricLabel, { color: isLight ? '#166534' : '#6EE7B7' }]}>
              Owed to You
            </Text>
            <Ionicons name="arrow-down-circle" size={16} color="#10B981" />
          </View>
          <Text style={[styles.metricValue, { color: '#10B981' }]} numberOfLines={1}>
            {loanMetrics == null && loans.length === 0 ? '--' : formatAmount(lentPending, '+')}
          </Text>
          <Text style={[styles.metricSub, { color: isLight ? '#4B5563' : c.textMuted }]}>
            {loanMetrics == null && loans.length === 0 ? '-- total lent' : `${formatAmount(loanMetrics?.totalLent ?? 0)} total lent`}
          </Text>
        </AnimatedCard>

        {/* Card 2: You Owe */}
        <AnimatedCard
          style={[
            styles.metricCard,
            {
              backgroundColor: isLight ? '#FEF2F2' : 'rgba(239, 68, 68, 0.08)',
              borderColor: isLight ? '#FECACA' : 'rgba(239, 68, 68, 0.25)',
            },
          ]}
          scaleTo={0.97}
        >
          <View style={styles.metricTop}>
            <Text style={[styles.metricLabel, { color: isLight ? '#991B1B' : '#FCA5A5' }]}>
              You Owe
            </Text>
            <Ionicons name="arrow-up-circle" size={16} color="#EF4444" />
          </View>
          <Text style={[styles.metricValue, { color: '#EF4444' }]} numberOfLines={1}>
            {loanMetrics == null && loans.length === 0 ? '--' : formatAmount(borrowedPending, '-')}
          </Text>
          <Text style={[styles.metricSub, { color: isLight ? '#4B5563' : c.textMuted }]}>
            {loanMetrics == null && loans.length === 0 ? '-- borrowed' : `${formatAmount(loanMetrics?.totalBorrowed ?? 0)} borrowed`}
          </Text>
        </AnimatedCard>

        {/* Card 3: Net Balance Position */}
        <AnimatedCard
          style={[
            styles.metricCard,
            {
              backgroundColor: isLight ? '#F8FAFC' : c.inputBg,
              borderColor: c.border,
            },
          ]}
          scaleTo={0.97}
        >
          <View style={styles.metricTop}>
            <Text style={[styles.metricLabel, { color: c.textMuted }]}>Net Position</Text>
            <Ionicons name="swap-horizontal" size={16} color={c.primary} />
          </View>
          <Text
            style={[
              styles.metricValue,
              { color: loanMetrics == null && loans.length === 0 ? c.textMuted : netPosition >= 0 ? '#10B981' : '#EF4444' },
            ]}
            numberOfLines={1}
          >
            {loanMetrics == null && loans.length === 0 ? '--' : formatAmount(Math.abs(netPosition), netPosition >= 0 ? '+' : '-')}
          </Text>
          <Text style={[styles.metricSub, { color: c.textMuted }]}>
            {loanMetrics == null && loans.length === 0 ? '-- pending • -- settled' : `${loanMetrics?.pendingCount ?? 0} pending • ${loanMetrics?.settledCount ?? 0} settled`}
          </Text>
        </AnimatedCard>
      </View>

      {/* Loan Category Migration Banner */}
      {loanCategoryExpenses.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleOpenAddModal(loanCategoryExpenses[0])}
          style={[
            styles.loanNoticeCard,
            {
              backgroundColor: isLight ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.08)',
              borderColor: isLight ? 'rgba(212, 175, 55, 0.45)' : 'rgba(212, 175, 55, 0.35)',
            },
          ]}
        >
          <View style={styles.loanNoticeLeft}>
            <Ionicons name="sparkles" size={16} color={c.primary} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.loanNoticeTitle, { color: c.text }]}>
                {loanCategoryExpenses.length} transaction(s) tagged as "Loan"
              </Text>
              <Text style={[styles.loanNoticeSub, { color: c.textMuted }]}>
                Tap to convert into Peer Loans & keep living expenses separated.
              </Text>
            </View>
          </View>
          <View style={[styles.loanNoticeActionBtn, { backgroundColor: c.primary }]}>
            <Text style={[styles.loanNoticeActionText, { color: isLight ? '#0F172A' : '#10120E' }]}>
              Convert
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Filter Tabs / Chips (Scrollable) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBarScroll}
        style={styles.filterBarScrollContainer}
      >
        {(['ALL', 'LENT', 'BORROWED', 'PENDING'] as const).map((tab) => {
          const isSelected = activeFilter === tab;
          const label =
            tab === 'ALL'
              ? 'All'
              : tab === 'LENT'
              ? 'Owed to You'
              : tab === 'BORROWED'
              ? 'You Owe'
              : 'Pending';
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveFilter(tab);
              }}
              style={[
                styles.filterTab,
                {
                  backgroundColor: isSelected ? c.primary : c.inputBg,
                  borderColor: isSelected ? c.primary : c.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  {
                    color: isSelected
                      ? isLight
                        ? '#0F172A'
                        : '#10120E'
                      : c.textMuted,
                    fontWeight: isSelected ? '800' : '600',
                  },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
          filteredLoans.map((loan) => {
            const isLent = loan.type === 'LENT';
            const typeColor = isLent ? '#10B981' : '#EF4444';
            return (
              <View
                key={loan.id}
                style={[
                  styles.loanItemCard,
                  {
                    backgroundColor: c.inputBg,
                    borderColor: c.border,
                    opacity: loan.isSettled ? 0.72 : 1,
                  },
                ]}
              >
                {/* Left: Avatar + Details */}
                <View style={styles.loanItemLeft}>
                  <View
                    style={[
                      styles.avatarBadge,
                      {
                        backgroundColor: (isLent ? '#10B981' : '#EF4444') + '18',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isLent ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={18}
                      color={typeColor}
                    />
                  </View>
                  <View style={styles.loanItemDetails}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.counterpartyName, { color: c.text }]} numberOfLines={1}>
                        {loan.counterparty}
                      </Text>
                      <View
                        style={[
                          styles.typeBadge,
                          {
                            backgroundColor: (isLent ? '#10B981' : '#EF4444') + '18',
                          },
                        ]}
                      >
                        <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                          {isLent ? 'Lent' : 'Borrowed'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.subInfoRow}>
                      <Text style={[styles.loanDateText, { color: c.textMuted }]}>
                        {loan.adjustmentDate}
                      </Text>
                      {loan.dueDate ? (
                        <>
                          <Text style={[styles.dotSep, { color: c.textMuted }]}>•</Text>
                          <Text style={[styles.loanDateText, { color: c.warning }]}>
                            Due: {loan.dueDate}
                          </Text>
                        </>
                      ) : null}
                      {loan.notes ? (
                        <>
                          <Text style={[styles.dotSep, { color: c.textMuted }]}>•</Text>
                          <Text
                            style={[styles.loanNotesText, { color: c.textMuted }]}
                            numberOfLines={1}
                          >
                            {loan.notes}
                          </Text>
                        </>
                      ) : null}
                    </View>

                    {/* Linked Expense Badge */}
                    {loan.expenseId ? (
                      <View style={[styles.linkedBadgeWrap, { backgroundColor: c.card, borderColor: c.border }]}>
                        <Ionicons name="link-outline" size={11} color={c.primary} />
                        <Text style={[styles.linkedBadgeText, { color: c.text }]} numberOfLines={1}>
                          {loan.expenseDescription || 'Expense'} ({currSymbol}{loan.expenseAmount || ''})
                        </Text>
                      </View>
                    ) : null}

                    {/* Reminder Status Badge */}
                    {loan.reminderEnabled && !loan.isSettled ? (
                      <View style={[styles.reminderBadgeWrap, { backgroundColor: c.card, borderColor: c.primary + '40' }]}>
                        <Ionicons name="notifications-outline" size={11} color={c.primary} />
                        <Text style={[styles.reminderBadgeText, { color: c.primary }]} numberOfLines={1}>
                          Remind {loan.reminderFrequency || 'Once'} at {loan.reminderTime || '10:00'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Right: Amount + Status + Actions */}
                <View style={styles.loanItemRight}>
                  <Text style={[styles.loanAmountText, { color: typeColor }]}>
                    {formatAmount(loan.amount, isLent ? '+' : '-')}
                  </Text>

                  <View style={styles.itemActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleToggleSettle(loan)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.settleBtn,
                        {
                          backgroundColor: loan.isSettled
                            ? isLight
                              ? '#E2E8F0'
                              : 'rgba(255,255,255,0.08)'
                            : isLight
                            ? '#D1FAE5'
                            : 'rgba(16, 185, 129, 0.2)',
                          borderColor: loan.isSettled ? c.border : '#10B981',
                        },
                      ]}
                      accessibilityLabel={loan.isSettled ? 'Reopen loan' : 'Mark settled'}
                    >
                      <Ionicons
                        name={loan.isSettled ? 'reload-outline' : 'checkmark'}
                        size={12}
                        color={loan.isSettled ? c.textMuted : '#10B981'}
                      />
                      <Text
                        style={[
                          styles.settleBtnText,
                          { color: loan.isSettled ? c.textMuted : '#10B981' },
                        ]}
                      >
                        {loan.isSettled ? 'Settled' : 'Settle'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleOpenEditModal(loan)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[styles.iconActionBtn, { backgroundColor: c.card }]}
                      accessibilityLabel="Edit adjustment"
                    >
                      <Ionicons name="pencil" size={13} color={c.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleDelete(loan)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[styles.iconActionBtn, { backgroundColor: c.card }]}
                      accessibilityLabel="Delete adjustment"
                    >
                      <Ionicons name="trash-outline" size={13} color={c.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: c.text }]}>
                  {editingLoan ? 'Edit Adjustment' : 'New Peer Adjustment'}
                </Text>
                <Text style={[styles.modalSub, { color: c.textMuted }]}>
                  Record casual splits, lent money, or borrowings
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: c.inputBg }]}
              >
                <Ionicons name="close" size={18} color={c.text} />
              </TouchableOpacity>
            </View>

            <ThemedScrollView>
              {/* Type Switcher */}
              <Text style={[styles.inputLabel, { color: c.textMuted }]}>ADJUSTMENT TYPE</Text>
              <View style={[styles.typeToggleWrap, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setFormType('LENT');
                  }}
                  style={[
                    styles.typeToggleOption,
                    formType === 'LENT' && {
                      backgroundColor: '#10B981',
                    },
                  ]}
                >
                  <Ionicons
                    name="arrow-down-circle"
                    size={16}
                    color={formType === 'LENT' ? '#FFFFFF' : c.textMuted}
                  />
                  <Text
                    style={[
                      styles.typeToggleText,
                      {
                        color: formType === 'LENT' ? '#FFFFFF' : c.text,
                        fontWeight: formType === 'LENT' ? '800' : '600',
                      },
                    ]}
                  >
                    Lent (They Owe Me)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setFormType('BORROWED');
                  }}
                  style={[
                    styles.typeToggleOption,
                    formType === 'BORROWED' && {
                      backgroundColor: '#EF4444',
                    },
                  ]}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={16}
                    color={formType === 'BORROWED' ? '#FFFFFF' : c.textMuted}
                  />
                  <Text
                    style={[
                      styles.typeToggleText,
                      {
                        color: formType === 'BORROWED' ? '#FFFFFF' : c.text,
                        fontWeight: formType === 'BORROWED' ? '800' : '600',
                      },
                    ]}
                  >
                    Borrowed (I Owe)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Connect Previous Expense (Optional) */}
              <View style={{ marginTop: 12 }}>
                <View style={styles.sectionHeaderSmall}>
                  <Text style={[styles.inputLabel, { color: c.textMuted, marginBottom: 0 }]}>
                    CONNECT PREVIOUS EXPENSE (OPTIONAL)
                  </Text>
                  {formExpenseId ? (
                    <TouchableOpacity
                      onPress={() => setFormExpenseId(null)}
                      style={{ paddingHorizontal: 6 }}
                    >
                      <Text style={{ fontSize: 11, color: c.accent, fontWeight: '700' }}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {formExpenseId && selectedExpenseObj ? (
                  <View style={[styles.selectedExpCard, { backgroundColor: c.inputBg, borderColor: c.primary + '50' }]}>
                    <Ionicons name="link" size={16} color={c.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectedExpTitle, { color: c.text }]}>
                        {selectedExpenseObj.description || 'Expense'}
                      </Text>
                      <Text style={[styles.selectedExpSub, { color: c.textMuted }]}>
                        {currSymbol}{Number(selectedExpenseObj.amount).toLocaleString()} • {selectedExpenseObj.expenseDate}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowExpensePicker(v => !v)}>
                      <Text style={{ color: c.primary, fontSize: 11, fontWeight: '700' }}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowExpensePicker(v => !v)}
                    style={[styles.linkExpenseBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
                  >
                    <Ionicons name="link-outline" size={15} color={c.primary} />
                    <Text style={[styles.linkExpenseText, { color: c.text }]}>
                      {expenses.length > 0 ? 'Choose from your recent expenses...' : 'No past expenses recorded yet'}
                    </Text>
                    <Ionicons name={showExpensePicker ? 'chevron-up' : 'chevron-down'} size={14} color={c.textMuted} />
                  </TouchableOpacity>
                )}

                {/* Trigger opens dedicated List Modal */}
              </View>

              {/* Counterparty Name */}
              <Text style={[styles.inputLabel, { color: c.textMuted }]}>
                FRIEND / COUNTERPARTY NAME *
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: c.inputBg, borderColor: c.border, color: c.text },
                ]}
                placeholder="e.g. Alex, Rahul, Dinner Split"
                placeholderTextColor={c.textMuted}
                value={formCounterparty}
                onChangeText={setFormCounterparty}
              />

              {/* Amount */}
              <Text style={[styles.inputLabel, { color: c.textMuted }]}>
                AMOUNT ({currSymbol}) *
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: c.inputBg, borderColor: c.border, color: c.text },
                ]}
                placeholder="0.00"
                placeholderTextColor={c.textMuted}
                keyboardType="decimal-pad"
                value={formAmount}
                onChangeText={setFormAmount}
              />

              {/* Due Date */}
              <Text style={[styles.inputLabel, { color: c.textMuted }]}>
                EXPECTED DUE DATE (OPTIONAL)
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: c.inputBg, borderColor: c.border, color: c.text },
                ]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={c.textMuted}
                value={formDueDate}
                onChangeText={setFormDueDate}
              />

              {/* Notes */}
              <Text style={[styles.inputLabel, { color: c.textMuted }]}>NOTES / MEMO (OPTIONAL)</Text>
              <TextInput
                style={[
                  styles.formInput,
                  styles.formTextArea,
                  { backgroundColor: c.inputBg, borderColor: c.border, color: c.text },
                ]}
                placeholder="e.g. Goa trip cab fare split"
                placeholderTextColor={c.textMuted}
                multiline
                numberOfLines={3}
                value={formNotes}
                onChangeText={setFormNotes}
              />

              {/* Customized Reminder Section */}
              <View style={[styles.reminderSectionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setFormReminderEnabled(v => !v);
                  }}
                  style={styles.reminderToggleRow}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons
                      name={formReminderEnabled ? 'notifications' : 'notifications-outline'}
                      size={18}
                      color={formReminderEnabled ? c.primary : c.textMuted}
                    />
                    <View>
                      <Text style={[styles.reminderToggleTitle, { color: c.text }]}>
                        Reminder to {formType === 'LENT' ? 'Collect Money' : 'Repay Loan'}
                      </Text>
                      <Text style={[styles.reminderToggleSub, { color: c.textMuted }]}>
                        Customized on-device push reminders
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.toggleCheck,
                      {
                        backgroundColor: formReminderEnabled ? c.primary : 'transparent',
                        borderColor: formReminderEnabled ? c.primary : c.border,
                      },
                    ]}
                  >
                    {formReminderEnabled && (
                      <Ionicons name="checkmark" size={14} color={isLight ? '#0F172A' : '#10120E'} />
                    )}
                  </View>
                </TouchableOpacity>

                {formReminderEnabled && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    {/* Frequency Chips */}
                    <Text style={[styles.inputLabelSmall, { color: c.textMuted }]}>FREQUENCY</Text>
                    <View style={styles.freqChipsRow}>
                      {(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const).map((freq) => (
                        <TouchableOpacity
                          key={freq}
                          onPress={() => setFormReminderFrequency(freq)}
                          style={[
                            styles.freqChip,
                            {
                              backgroundColor: formReminderFrequency === freq ? c.primary : c.card,
                              borderColor: formReminderFrequency === freq ? c.primary : c.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.freqChipText,
                              {
                                color: formReminderFrequency === freq
                                  ? isLight ? '#0F172A' : '#10120E'
                                  : c.text,
                              },
                            ]}
                          >
                            {freq === 'ONCE' ? 'Once' : freq === 'DAILY' ? 'Daily' : freq === 'WEEKLY' ? 'Weekly' : 'Monthly'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Time of Day */}
                    <Text style={[styles.inputLabelSmall, { color: c.textMuted }]}>REMINDER TIME</Text>
                    <View style={styles.freqChipsRow}>
                      {(['09:00', '12:00', '18:00', '20:30'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => setFormReminderTime(t)}
                          style={[
                            styles.freqChip,
                            {
                              backgroundColor: formReminderTime === t ? c.primary : c.card,
                              borderColor: formReminderTime === t ? c.primary : c.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.freqChipText,
                              {
                                color: formReminderTime === t
                                  ? isLight ? '#0F172A' : '#10120E'
                                  : c.text,
                              },
                            ]}
                          >
                            {t === '09:00' ? '9:00 AM' : t === '12:00' ? '12:00 PM' : t === '18:00' ? '6:00 PM' : '8:30 PM'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={[
                        styles.formInput,
                        { backgroundColor: c.card, borderColor: c.border, color: c.text, height: 36, fontSize: 12 },
                      ]}
                      placeholder="Custom time (HH:mm, 24-hr)"
                      placeholderTextColor={c.textMuted}
                      value={formReminderTime}
                      onChangeText={setFormReminderTime}
                    />

                    {/* Reminder Date for One-Time */}
                    {formReminderFrequency === 'ONCE' && (
                      <>
                        <Text style={[styles.inputLabelSmall, { color: c.textMuted }]}>REMINDER DATE</Text>
                        <TextInput
                          style={[
                            styles.formInput,
                            { backgroundColor: c.card, borderColor: c.border, color: c.text, height: 36, fontSize: 12 },
                          ]}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={c.textMuted}
                          value={formReminderDate}
                          onChangeText={setFormReminderDate}
                        />
                      </>
                    )}
                  </View>
                )}
              </View>

              {/* Modal Actions */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setModalVisible(false)}
                  style={[styles.modalCancelBtn, { borderColor: c.border }]}
                >
                  <Text style={[styles.modalCancelText, { color: c.textMuted }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleSave}
                  disabled={isSubmitting}
                  style={[styles.modalSaveBtn, { backgroundColor: c.primary }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={isLight ? '#0F172A' : '#10120E'} />
                  ) : (
                    <Text
                      style={[
                        styles.modalSaveText,
                        { color: isLight ? '#0F172A' : '#10120E' },
                      ]}
                    >
                      {editingLoan ? 'Update Record' : 'Save Adjustment'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ThemedScrollView>
          </View>
        </View>
      </Modal>

      {/* DEDICATED FULL-FEATURED EXPENSE LIST PICKER MODAL */}
      <Modal
        visible={showExpensePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExpensePicker(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.pickerModalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowExpensePicker(false)}
          />
          <View
            style={[
              styles.pickerSheetCard,
              { backgroundColor: c.card, borderColor: c.border },
            ]}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandleWrap}>
              <View style={[styles.sheetHandle, { backgroundColor: c.border }]} />
            </View>

            {/* Header */}
            <View style={styles.pickerSheetHeader}>
              <View>
                <Text style={[styles.pickerSheetTitle, { color: c.text }]}>
                  Select Previous Expense
                </Text>
                <Text style={[styles.pickerSheetSubtitle, { color: c.textMuted }]}>
                  Connect a past bill split or loan expense
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowExpensePicker(false)}
                style={[styles.modalCloseBtn, { backgroundColor: c.inputBg }]}
              >
                <Ionicons name="close" size={18} color={c.text} />
              </TouchableOpacity>
            </View>

            {/* Search Box */}
            <View style={[styles.pickerSearchRow, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <Ionicons name="search-outline" size={16} color={c.textMuted} />
              <TextInput
                style={[styles.pickerSearchInput, { color: c.text }]}
                placeholder="Search by description or category..."
                placeholderTextColor={c.textMuted}
                value={expenseSearchQuery}
                onChangeText={setExpenseSearchQuery}
              />
              {expenseSearchQuery ? (
                <TouchableOpacity onPress={() => setExpenseSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={c.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter Tabs: All vs Loan Category */}
            <View style={styles.pickerFilterTabs}>
              <TouchableOpacity
                onPress={() => setExpenseFilterTab('ALL')}
                style={[
                  styles.pickerTabBtn,
                  expenseFilterTab === 'ALL' && { backgroundColor: c.primary },
                  { borderColor: c.border },
                ]}
              >
                <Text
                  style={[
                    styles.pickerTabBtnText,
                    { color: expenseFilterTab === 'ALL' ? (isLight ? '#0F172A' : '#10120E') : c.text },
                  ]}
                >
                  All Expenses ({expenses.length})
                </Text>
              </TouchableOpacity>

              {loanCategoryExpenses.length > 0 && (
                <TouchableOpacity
                  onPress={() => setExpenseFilterTab('LOAN')}
                  style={[
                    styles.pickerTabBtn,
                    expenseFilterTab === 'LOAN' && { backgroundColor: c.primary },
                    { borderColor: c.primary },
                  ]}
                >
                  <Ionicons
                    name="star"
                    size={13}
                    color={expenseFilterTab === 'LOAN' ? (isLight ? '#0F172A' : '#10120E') : c.primary}
                  />
                  <Text
                    style={[
                      styles.pickerTabBtnText,
                      { color: expenseFilterTab === 'LOAN' ? (isLight ? '#0F172A' : '#10120E') : c.text },
                    ]}
                  >
                    Tagged as "Loan" ({loanCategoryExpenses.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Expenses List */}
            <ThemedScrollView
              style={styles.pickerScroll}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {filteredExpensesList.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Ionicons name="receipt-outline" size={36} color={c.textMuted} />
                  <Text style={[styles.emptySub, { color: c.textMuted, marginTop: 8 }]}>
                    No matching expenses found.
                  </Text>
                </View>
              ) : (
                filteredExpensesList.map((exp) => {
                  const isLoanCat =
                    (exp.categoryName || '').toLowerCase().includes('loan') ||
                    (exp.description || '').toLowerCase().includes('loan');
                  return (
                    <TouchableOpacity
                      key={exp.id}
                      activeOpacity={0.7}
                      onPress={() => {
                        handleSelectExpense(exp);
                        setShowExpensePicker(false);
                      }}
                      style={[
                        styles.pickerItemRow,
                        {
                          backgroundColor: c.inputBg,
                          borderColor: isLoanCat ? c.primary + '70' : c.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.avatarBadge,
                          {
                            backgroundColor: isLoanCat
                              ? 'rgba(212, 175, 55, 0.16)'
                              : (isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)'),
                          },
                        ]}
                      >
                        <Ionicons
                          name={isLoanCat ? 'cash-outline' : 'receipt-outline'}
                          size={18}
                          color={isLoanCat ? c.primary : c.textMuted}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.pickerItemDesc, { color: c.text }]} numberOfLines={1}>
                            {exp.description || 'Expense'}
                          </Text>
                          {isLoanCat && (
                            <View style={[styles.loanCatPill, { backgroundColor: c.primary + '25' }]}>
                              <Text style={[styles.loanCatPillText, { color: c.primary }]}>Loan</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.pickerItemSub, { color: c.textMuted }]}>
                          {exp.expenseDate} • {exp.categoryName || 'General'}
                        </Text>
                      </View>
                      <Text style={[styles.pickerItemAmountText, { color: c.text }]}>
                        {currSymbol}{Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ThemedScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  titleIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  metricSub: {
    fontSize: 9.5,
    marginTop: 2,
    fontWeight: '500',
  },
  filterBarScrollContainer: {
    marginBottom: 12,
  },
  filterBarScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: 'center',
  },
  filterTab: {
    paddingVertical: 7,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabText: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  listWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    gap: 8,
  },
  emptyState: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 11.5,
    textAlign: 'center',
    maxWidth: 260,
  },
  loanItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  loanItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loanItemDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  counterpartyName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  loanDateText: {
    fontSize: 10.5,
  },
  dotSep: {
    fontSize: 8,
  },
  loanNotesText: {
    fontSize: 10.5,
    maxWidth: 120,
  },
  linkedBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  linkedBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  reminderBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  reminderBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  loanItemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  loanAmountText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  itemActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  settleBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  inputLabelSmall: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeaderSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  linkExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  linkExpenseText: {
    fontSize: 12,
    flex: 1,
  },
  selectedExpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectedExpTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  selectedExpSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  expensePickerList: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  expensePickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  expensePickerDesc: {
    fontSize: 12,
    fontWeight: '600',
  },
  expensePickerMeta: {
    fontSize: 10,
    marginTop: 1,
  },
  expensePickerAmt: {
    fontSize: 12,
    fontWeight: '800',
  },
  typeToggleWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  typeToggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  typeToggleText: {
    fontSize: 11.5,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  formTextArea: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
  reminderSectionCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  reminderToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderToggleTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  reminderToggleSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  toggleCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  freqChipsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  freqChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  freqChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '800',
  },

  loanNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  loanNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  loanNoticeTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  loanNoticeSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  loanNoticeActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },
  loanNoticeActionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheetCard: {
    width: '100%',
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  pickerSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  pickerSheetSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 12.5,
    padding: 0,
  },
  pickerFilterTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pickerTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  pickerTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pickerScroll: {
    maxHeight: 380,
  },
  pickerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  pickerItemDesc: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  pickerItemSub: {
    fontSize: 10.5,
    marginTop: 2,
  },
  pickerItemAmountText: {
    fontSize: 13.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
  },
  loanCatPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  loanCatPillText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
