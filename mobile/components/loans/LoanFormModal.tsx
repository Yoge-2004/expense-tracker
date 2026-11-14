/**
 * @file LoanFormModal.tsx
 * @description Dedicated Add / Edit modal dialog for Peer Loans & Adjustments.
 * Handles contact name, amount, due date, notes, linked expense, and customized push reminders.
 * Adheres to Single Responsibility Principle (SRP).
 */

import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ThemedTextInput as TextInput, ThemedText as Text } from '../ThemedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedScrollView } from '../ThemedScrollbar';
import { ThemeColors } from '../../constants/theme';
import { LoanAdjustment, LoanType } from '../../types/domain';
import { LoanExpenseCandidate, ReminderFrequency } from './loansTypes';
import { loansStyles as styles } from './loansStyles';

interface LoanFormModalProps {
  visible: boolean;
  editingLoan: LoanAdjustment | null;
  formType: LoanType;
  formCounterparty: string;
  formAmount: string;
  formDueDate: string;
  formNotes: string;
  formExpenseId: number | null;
  formReminderEnabled: boolean;
  formReminderDate: string;
  formReminderTime: string;
  formReminderFrequency: ReminderFrequency;
  selectedExpenseObj: LoanExpenseCandidate | null;
  hasExpenses: boolean;
  isSubmitting: boolean;
  currSymbol: string;
  colors: ThemeColors;
  onClose: () => void;
  onSave: () => void;
  onSetFormType: (type: LoanType) => void;
  onSetFormCounterparty: (text: string) => void;
  onSetFormAmount: (text: string) => void;
  onSetFormDueDate: (text: string) => void;
  onSetFormNotes: (text: string) => void;
  onClearLinkedExpense: () => void;
  onOpenExpensePicker: () => void;
  onToggleReminderEnabled: () => void;
  onSetReminderFrequency: (freq: ReminderFrequency) => void;
  onSetReminderTime: (time: string) => void;
  onSetReminderDate: (date: string) => void;
}

export const LoanFormModal: React.FC<LoanFormModalProps> = React.memo(({
  visible,
  editingLoan,
  formType,
  formCounterparty,
  formAmount,
  formDueDate,
  formNotes,
  formExpenseId,
  formReminderEnabled,
  formReminderDate,
  formReminderTime,
  formReminderFrequency,
  selectedExpenseObj,
  hasExpenses,
  isSubmitting,
  currSymbol,
  colors: c,
  onClose,
  onSave,
  onSetFormType,
  onSetFormCounterparty,
  onSetFormAmount,
  onSetFormDueDate,
  onSetFormNotes,
  onClearLinkedExpense,
  onOpenExpensePicker,
  onToggleReminderEnabled,
  onSetReminderFrequency,
  onSetReminderTime,
  onSetReminderDate,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
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
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
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
                accessibilityRole="button"
                accessibilityLabel="Set type to Lent (They Owe Me)"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  onSetFormType('LENT');
                }}
                style={[
                  styles.typeToggleOption,
                  formType === 'LENT' && {
                    backgroundColor: c.success,
                  },
                ]}
              >
                <Ionicons
                  name="arrow-down-circle"
                  size={16}
                  color={formType === 'LENT' ? c.onSuccess : c.textMuted}
                />
                <Text
                  style={[
                    styles.typeToggleText,
                    {
                      color: formType === 'LENT' ? c.onSuccess : c.text,
                      fontWeight: formType === 'LENT' ? '800' : '600',
                    },
                  ]}
                >
                  Lent (They Owe Me)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Set type to Borrowed (I Owe)"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  onSetFormType('BORROWED');
                }}
                style={[
                  styles.typeToggleOption,
                  formType === 'BORROWED' && {
                    backgroundColor: c.danger,
                  },
                ]}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={16}
                  color={formType === 'BORROWED' ? c.onDanger : c.textMuted}
                />
                <Text
                  style={[
                    styles.typeToggleText,
                    {
                      color: formType === 'BORROWED' ? c.onDanger : c.text,
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
                    onPress={onClearLinkedExpense}
                    accessibilityRole="button"
                    accessibilityLabel="Clear linked expense"
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
                  <TouchableOpacity
                    onPress={onOpenExpensePicker}
                    accessibilityRole="button"
                    accessibilityLabel="Change linked expense"
                  >
                    <Text style={{ color: c.primary, fontSize: 11, fontWeight: '700' }}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Choose from recent expenses"
                  onPress={onOpenExpensePicker}
                  style={[styles.linkExpenseBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
                >
                  <Ionicons name="link-outline" size={15} color={c.primary} />
                  <Text style={[styles.linkExpenseText, { color: c.text }]}>
                    {hasExpenses ? 'Choose from your recent expenses...' : 'No past expenses recorded yet'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={c.textMuted} />
                </TouchableOpacity>
              )}
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
              onChangeText={onSetFormCounterparty}
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
              onChangeText={onSetFormAmount}
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
              onChangeText={onSetFormDueDate}
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
              onChangeText={onSetFormNotes}
            />

            {/* Customized Reminder Section */}
            <View style={[styles.reminderSectionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Toggle reminder notification"
                onPress={onToggleReminderEnabled}
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
                    <Ionicons name="checkmark" size={14} color={c.onPrimary} />
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
                        accessibilityRole="button"
                        accessibilityLabel={`Reminder frequency ${freq}`}
                        onPress={() => onSetReminderFrequency(freq)}
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
                                ? c.onPrimary
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
                        accessibilityRole="button"
                        accessibilityLabel={`Reminder time ${t}`}
                        onPress={() => onSetReminderTime(t)}
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
                                ? c.onPrimary
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
                    onChangeText={onSetReminderTime}
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
                        onChangeText={onSetReminderDate}
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
                accessibilityRole="button"
                accessibilityLabel="Cancel editing"
                onPress={onClose}
                style={[styles.modalCancelBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.modalCancelText, { color: c.textMuted }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={editingLoan ? 'Update record' : 'Save adjustment'}
                onPress={onSave}
                disabled={isSubmitting}
                style={[styles.modalSaveBtn, { backgroundColor: c.primary }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={c.onPrimary} />
                ) : (
                  <Text
                    style={[
                      styles.modalSaveText,
                      { color: c.onPrimary },
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
  );
});

LoanFormModal.displayName = 'LoanFormModal';
