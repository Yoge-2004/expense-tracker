/**
 * @file LoanExpensePickerModal.tsx
 * @description Dedicated bottom sheet modal for linking past expenses to loans.
 * Adheres to Single Responsibility Principle (SRP).
 */

import React, { useState, useMemo } from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ThemedTextInput as TextInput, ThemedText as Text } from '../ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { ThemedScrollView } from '../ThemedScrollbar';
import { ThemeColors } from '../../constants/theme';
import { LoanExpenseCandidate } from './loansTypes';
import { loansStyles as styles } from './loansStyles';

interface LoanExpensePickerModalProps {
  visible: boolean;
  expenses: LoanExpenseCandidate[];
  colors: ThemeColors;
  currSymbol: string;
  onClose: () => void;
  onSelectExpense: (exp: LoanExpenseCandidate) => void;
}

export const LoanExpensePickerModal: React.FC<LoanExpensePickerModalProps> = React.memo(({
  visible,
  expenses,
  colors: c,
  currSymbol,
  onClose,
  onSelectExpense,
}) => {
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [expenseFilterTab, setExpenseFilterTab] = useState<'ALL' | 'LOAN'>('ALL');

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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.pickerModalBackdrop}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss expense picker"
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
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close picker"
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
              <TouchableOpacity
                onPress={() => setExpenseSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
              >
                <Ionicons name="close-circle" size={16} color={c.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Tabs: All vs Loan Category */}
          <View style={styles.pickerFilterTabs}>
            <TouchableOpacity
              onPress={() => setExpenseFilterTab('ALL')}
              accessibilityRole="button"
              accessibilityLabel={`All expenses, ${expenses.length} available`}
              style={[
                styles.pickerTabBtn,
                expenseFilterTab === 'ALL' && { backgroundColor: c.primary },
                { borderColor: c.border },
              ]}
            >
              <Text
                style={[
                  styles.pickerTabBtnText,
                  { color: expenseFilterTab === 'ALL' ? c.onPrimary : c.text },
                ]}
              >
                All Expenses ({expenses.length})
              </Text>
            </TouchableOpacity>

            {loanCategoryExpenses.length > 0 && (
              <TouchableOpacity
                onPress={() => setExpenseFilterTab('LOAN')}
                accessibilityRole="button"
                accessibilityLabel={`Expenses tagged as loan, ${loanCategoryExpenses.length} available`}
                style={[
                  styles.pickerTabBtn,
                  expenseFilterTab === 'LOAN' && { backgroundColor: c.primary },
                  { borderColor: c.primary },
                ]}
              >
                <Ionicons
                  name="star"
                  size={13}
                  color={expenseFilterTab === 'LOAN' ? c.onPrimary : c.primary}
                />
                <Text
                  style={[
                    styles.pickerTabBtnText,
                    { color: expenseFilterTab === 'LOAN' ? c.onPrimary : c.text },
                  ]}
                >
                  Tagged as &quot;Loan&quot; ({loanCategoryExpenses.length})
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
                    accessibilityRole="button"
                    accessibilityLabel={`Select expense ${exp.description || 'Expense'}, amount ${currSymbol}${exp.amount}`}
                    onPress={() => onSelectExpense(exp)}
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
                            ? c.primary + '29'
                            : c.fillSubtle,
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
  );
});

LoanExpensePickerModal.displayName = 'LoanExpensePickerModal';
