/**
 * @file add-expense.tsx
 * @description Screen for logging new/edited transactions, configuring recurring commitments,
 * and setting category spending caps with enterprise-grade defensive validation and exception handling.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { apiRequest, ApiError } from '../../services/api';
import { getCurrencySymbol } from '../../services/currency';
import { Colors, getCategoryEmoji } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { AmbientAura } from '../../components/AmbientAura';
import { StaggeredView } from '../../components/StaggeredView';
import { ManageCategoriesModal } from '../../components/ManageCategoriesModal';
import { CalendarPickerModal } from '../../components/CalendarPickerModal';

interface Category {
  id: number;
  name: string;
}

/**
 * Validates whether an ISO date string (YYYY-MM-DD) represents a real calendar date.
 */
function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const d = parseInt(dayStr, 10);

  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  const dateObj = new Date(y, m - 1, d);
  return dateObj.getFullYear() === y && dateObj.getMonth() === m - 1 && dateObj.getDate() === d;
}

/**
 * Add / Edit Expense and Budget Screen.
 */
export default function AddExpenseScreen() {
  const { userId, theme, currency } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    editId?: string;
    editDescription?: string;
    editAmount?: string;
    editCategoryId?: string;
    editDate?: string;
  }>();
  const isEditMode = !!params.editId;
  const currSymbol = getCurrencySymbol(currency);
  const isLight = theme === 'light';
  const c = Colors[theme];

  const [activeTab, setActiveTab] = useState<'expense' | 'budget'>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // Expense form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('MONTHLY');
  const [intervalDays, setIntervalDays] = useState('30');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  // Budget form state
  const [budgetCategoryId, setBudgetCategoryId] = useState<number | null>(null);
  const [budgetLimit, setBudgetLimit] = useState('');

  // Form field errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Animations
  const subFormAnim = useRef(new Animated.Value(0)).current;

  /**
   * Fetches merged global & user-defined categories.
   */
  const loadCategories = async () => {
    if (!userId) return;
    try {
      const [globalCats, userCats] = await Promise.all([
        apiRequest('/categories/global').catch(() => []),
        apiRequest(`/categories/user/${userId}`).catch(() => []),
      ]);
      const merged = [
        ...(Array.isArray(globalCats) ? globalCats : []),
        ...(Array.isArray(userCats) ? userCats : []),
      ];

      const seen = new Set();
      const uniqueCats: Category[] = [];
      merged.forEach((cat) => {
        if (cat && cat.name && !seen.has(cat.name.toLowerCase())) {
          seen.add(cat.name.toLowerCase());
          uniqueCats.push(cat);
        }
      });

      setCategories(uniqueCats);
      if (uniqueCats.length > 0) {
        if (!categoryId) setCategoryId(uniqueCats[0].id);
        if (!budgetCategoryId) setBudgetCategoryId(uniqueCats[0].id);
      }
    } catch (e: any) {
      console.warn('[AddExpenseScreen] Error fetching categories:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    if (isEditMode) {
      if (params.editDescription) setDescription(params.editDescription);
      if (params.editAmount) setAmount(params.editAmount);
      if (params.editCategoryId) setCategoryId(Number(params.editCategoryId));
      if (params.editDate) setExpenseDate(params.editDate);
    }
  }, [userId, params.editId]);

  const toggleRecurring = (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsRecurring(val);
    Animated.spring(subFormAnim, {
      toValue: val ? 1 : 0,
      friction: 8,
      tension: 45,
      useNativeDriver: false,
    }).start();
  };

  /**
   * Validates and submits a new or updated expense.
   */
  const handleSaveExpense = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const fieldErrors: Record<string, string> = {};

    const cleanDesc = description.trim();
    if (!cleanDesc) {
      fieldErrors.description = 'Description is required.';
    } else if (cleanDesc.length > 255) {
      fieldErrors.description = 'Description cannot exceed 255 characters.';
    }

    const cleanAmount = amount.trim();
    if (!cleanAmount) {
      fieldErrors.amount = 'Amount is required.';
    } else {
      const numAmount = parseFloat(cleanAmount);
      if (isNaN(numAmount) || numAmount <= 0) {
        fieldErrors.amount = 'Please enter a valid positive amount.';
      } else if (numAmount > 100000000) {
        fieldErrors.amount = 'Amount cannot exceed 100,000,000.';
      }
    }

    if (!categoryId) {
      fieldErrors.category = 'Please select a category.';
    }

    if (!expenseDate.trim() || !isValidDateString(expenseDate.trim())) {
      fieldErrors.date = 'Please enter a valid calendar date in YYYY-MM-DD format.';
    }

    if (isRecurring && frequency === 'CUSTOM') {
      const days = parseInt(intervalDays.trim(), 10);
      if (isNaN(days) || days < 1 || days > 365) {
        fieldErrors.intervalDays = 'Custom interval must be between 1 and 365 days.';
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      const firstError = Object.values(fieldErrors)[0];
      showAlert('Validation Error', firstError);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const numAmount = parseFloat(cleanAmount);

      if (isEditMode && params.editId) {
        await apiRequest(`/expenses/${params.editId}/user/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({
            description: cleanDesc,
            amount: numAmount,
            categoryId,
            expenseDate: expenseDate.trim(),
          }),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert('Updated', 'Expense updated successfully.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') },
        ]);
      } else {
        const payload: any = {
          description: cleanDesc,
          amount: numAmount,
          categoryId,
          expenseDate: expenseDate.trim(),
          isRecurring,
        };

        if (isRecurring) {
          payload.frequency = frequency;
          if (frequency === 'CUSTOM') {
            payload.intervalDays = parseInt(intervalDays.trim(), 10);
          }
        }

        await apiRequest(`/expenses/user/${userId}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert('🎉 Logged!', 'Transaction recorded successfully.', [
          { text: 'View Dashboard', onPress: () => router.replace('/(tabs)') },
        ]);
        setDescription('');
        setAmount('');
        setIsRecurring(false);
      }
    } catch (e: any) {
      const isApiErr = e instanceof ApiError;
      const msg = isApiErr ? e.message : 'Could not save expense transaction.';
      showAlert('Save Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Validates and establishes a monthly category budget cap.
   */
  const handleSaveBudget = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const fieldErrors: Record<string, string> = {};

    if (!budgetCategoryId) {
      fieldErrors.budgetCategory = 'Please select a category for this budget.';
    }

    const cleanLimit = budgetLimit.trim();
    if (!cleanLimit) {
      fieldErrors.budgetLimit = 'Budget limit amount is required.';
    } else {
      const numLimit = parseFloat(cleanLimit);
      if (isNaN(numLimit) || numLimit <= 0) {
        fieldErrors.budgetLimit = 'Please enter a valid positive budget amount.';
      } else if (numLimit > 100000000) {
        fieldErrors.budgetLimit = 'Budget cap cannot exceed 100,000,000.';
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      const firstError = Object.values(fieldErrors)[0];
      showAlert('Validation Error', firstError);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const numLimit = parseFloat(cleanLimit);
      await apiRequest(`/expenses/budget/user/${userId}`, {
        method: 'POST',
        body: JSON.stringify({
          categoryId: budgetCategoryId,
          limit: numLimit,
          period: 'MONTHLY',
        }),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('🎯 Budget Set', 'Category spending cap saved successfully.', [
        { text: 'View Dashboard', onPress: () => router.replace('/(tabs)') },
      ]);
      setBudgetLimit('');
    } catch (e: any) {
      const isApiErr = e instanceof ApiError;
      const msg = isApiErr ? e.message : 'Could not save category budget.';
      showAlert('Budget Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingBox, { backgroundColor: c.bg }]}>
        <AmbientAura />
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screenWrapper, { backgroundColor: c.bg }]}>
      <AmbientAura />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top + 10, 48) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: c.text }]}>
            {isEditMode ? 'Edit Transaction' : 'Record Outflow'}
          </Text>
          <Text style={[styles.pageSubtitle, { color: c.textMuted }]}>
            {isEditMode ? 'Update transaction details' : 'Log a purchase or set category budget limits'}
          </Text>
        </View>

        {/* Tab Switcher: Expense vs Budget */}
        {!isEditMode && (
          <View style={[styles.tabsWrap, { backgroundColor: c.card, borderColor: c.border }]}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('expense');
              }}
              style={[
                styles.tabBtn,
                activeTab === 'expense' && { backgroundColor: c.primary },
              ]}
            >
              <Ionicons
                name="receipt-outline"
                size={16}
                color={activeTab === 'expense' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color: activeTab === 'expense' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted,
                  },
                ]}
              >
                Log Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('budget');
              }}
              style={[
                styles.tabBtn,
                activeTab === 'budget' && { backgroundColor: c.primary },
              ]}
            >
              <Ionicons
                name="shield-outline"
                size={16}
                color={activeTab === 'budget' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color: activeTab === 'budget' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted,
                  },
                ]}
              >
                Set Budget Cap
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'expense' ? (
          /* =========================================
              CASE 1: LOG EXPENSE FORM
             ========================================= */
          <StaggeredView delay={100} direction="up">
            <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
              {/* Description Input */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Description / Merchant</Text>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: c.inputBg,
                      borderColor: errors.description ? c.accent : c.border,
                    },
                  ]}
                >
                  <Ionicons name="pencil-outline" size={18} color={c.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: c.text }]}
                    placeholder="e.g. Blue Tokai Coffee, Figma Plan"
                    placeholderTextColor={c.textMuted}
                    value={description}
                    maxLength={255}
                    onChangeText={(v) => {
                      setDescription(v);
                      if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
                    }}
                  />
                </View>
                {!!errors.description && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.description}</Text>}
              </View>

              {/* Amount Input */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Amount ({currSymbol})</Text>
                <View
                  style={[
                    styles.amountInputWrap,
                    {
                      backgroundColor: c.inputBg,
                      borderColor: errors.amount ? c.accent : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.currencyPrefix, { color: c.primary }]}>{currSymbol}</Text>
                  <TextInput
                    style={[styles.amountInput, { color: c.text }]}
                    placeholder="0.00"
                    placeholderTextColor={c.textMuted}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={(v) => {
                      setAmount(v);
                      if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
                    }}
                  />
                </View>
                {!!errors.amount && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.amount}</Text>}
              </View>

              {/* Category Selector */}
              <View style={styles.fieldGroup}>
                <View style={styles.catLabelRow}>
                  <Text style={[styles.fieldLabel, { color: c.textMuted, marginBottom: 0 }]}>Category</Text>
                  <TouchableOpacity
                    onPress={() => setShowCategoryModal(true)}
                    style={styles.manageCatBtn}
                  >
                    <Ionicons name="settings-outline" size={13} color={c.primary} />
                    <Text style={[styles.manageCatBtnText, { color: c.primary }]}>Manage</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChipsScroll}>
                  {categories.map((cat) => {
                    const isSelected = categoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        activeOpacity={0.8}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setCategoryId(cat.id);
                          if (errors.category) setErrors((prev) => ({ ...prev, category: '' }));
                        }}
                        style={[
                          styles.catChip,
                          {
                            backgroundColor: isSelected ? c.primary : c.inputBg,
                            borderColor: isSelected ? c.primary : c.border,
                          },
                        ]}
                      >
                        <Text style={styles.catChipEmoji}>{getCategoryEmoji(cat.name)}</Text>
                        <Text
                          style={[
                            styles.catChipText,
                            {
                              color: isSelected ? (theme === 'light' ? '#FFF' : '#10120E') : c.text,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Date Input (Opens Calendar Modal) */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Date (Tap to Pick)</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowCalendarModal(true)}
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: c.inputBg,
                      borderColor: errors.date ? c.accent : c.border,
                      justifyContent: 'space-between',
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name="calendar" size={18} color={c.primary} style={styles.inputIcon} />
                    <Text style={[{ fontSize: 14, fontWeight: '700', color: c.text }]}>
                      {expenseDate || 'Select Date'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                </TouchableOpacity>
                {!!errors.date && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.date}</Text>}
              </View>

              {/* Recurring Switch (Disabled in edit mode) */}
              {!isEditMode && (
                <View style={[styles.recurringToggleRow, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                  <View style={styles.recurringToggleLeft}>
                    <Ionicons name="repeat" size={20} color={isRecurring ? c.primary : c.textMuted} />
                    <View>
                      <Text style={[styles.recurringTitle, { color: c.text }]}>Recurring Commitment</Text>
                      <Text style={[styles.recurringSub, { color: c.textMuted }]}>
                        Auto-generate subscription run-rate
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      toggleRecurring(!isRecurring);
                    }}
                    style={[
                      styles.togglePill,
                      {
                        backgroundColor: isRecurring ? c.primary : c.card,
                        borderColor: isRecurring ? c.primary : c.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        {
                          backgroundColor: isRecurring ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted,
                          transform: [{ translateX: isRecurring ? 18 : 2 }],
                        },
                      ]}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Recurring Interval Configuration Panel */}
              {isRecurring && !isEditMode && (
                <View style={[styles.recurringBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                  <Text style={[styles.recurringBoxLabel, { color: c.textMuted }]}>BILLING FREQUENCY</Text>
                  <View style={styles.freqRow}>
                    {['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'].map((freq) => {
                      const isSelected = frequency === freq;
                      return (
                        <TouchableOpacity
                          key={freq}
                          activeOpacity={0.8}
                          onPress={() => setFrequency(freq)}
                          style={[
                            styles.freqChip,
                            {
                              backgroundColor: isSelected ? c.primary : c.card,
                              borderColor: isSelected ? c.primary : c.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.freqChipText,
                              {
                                color: isSelected ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted,
                                fontWeight: isSelected ? '800' : '600',
                              },
                            ]}
                          >
                            {freq}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {frequency === 'CUSTOM' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Custom Cycle (in Days)</Text>
                      <TextInput
                        style={[
                          styles.customDaysInput,
                          {
                            backgroundColor: c.card,
                            borderColor: errors.intervalDays ? c.accent : c.border,
                            color: c.text,
                          },
                        ]}
                        keyboardType="number-pad"
                        placeholder="e.g. 14, 45, 90"
                        placeholderTextColor={c.textMuted}
                        value={intervalDays}
                        onChangeText={(v) => {
                          setIntervalDays(v);
                          if (errors.intervalDays) setErrors((prev) => ({ ...prev, intervalDays: '' }));
                        }}
                      />
                      {!!errors.intervalDays && (
                        <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.intervalDays}</Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSaveExpense}
                disabled={isSubmitting}
                style={[
                  styles.submitBtn,
                  { backgroundColor: c.primary, opacity: isSubmitting ? 0.7 : 1 },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#10120E" />
                ) : (
                  <View style={styles.submitBtnInner}>
                    <Text style={[styles.submitBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>
                      {isEditMode ? 'Update Expense' : 'Log Transaction'}
                    </Text>
                    <Ionicons
                      name={isEditMode ? 'checkmark-circle' : 'add-circle'}
                      size={20}
                      color={isLight ? '#FFF' : '#10120E'}
                    />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </StaggeredView>
        ) : (
          /* =========================================
              CASE 2: BUDGET SETTING FORM
             ========================================= */
          <StaggeredView delay={100} direction="up">
            <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
              {/* Category Selector */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Target Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChipsScroll}>
                  {categories.map((cat) => {
                    const isSelected = budgetCategoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        activeOpacity={0.8}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setBudgetCategoryId(cat.id);
                          if (errors.budgetCategory) setErrors((prev) => ({ ...prev, budgetCategory: '' }));
                        }}
                        style={[
                          styles.catChip,
                          {
                            backgroundColor: isSelected ? c.primary : c.inputBg,
                            borderColor: isSelected ? c.primary : c.border,
                          },
                        ]}
                      >
                        <Text style={styles.catChipEmoji}>{getCategoryEmoji(cat.name)}</Text>
                        <Text
                          style={[
                            styles.catChipText,
                            {
                              color: isSelected ? (theme === 'light' ? '#FFF' : '#10120E') : c.text,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {!!errors.budgetCategory && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.budgetCategory}</Text>}
              </View>

              {/* Limit Input */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Monthly Spending Cap ({currSymbol})</Text>
                <View
                  style={[
                    styles.amountInputWrap,
                    {
                      backgroundColor: c.inputBg,
                      borderColor: errors.budgetLimit ? c.accent : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.currencyPrefix, { color: c.primary }]}>{currSymbol}</Text>
                  <TextInput
                    style={[styles.amountInput, { color: c.text }]}
                    placeholder="0.00"
                    placeholderTextColor={c.textMuted}
                    keyboardType="decimal-pad"
                    value={budgetLimit}
                    onChangeText={(v) => {
                      setBudgetLimit(v);
                      if (errors.budgetLimit) setErrors((prev) => ({ ...prev, budgetLimit: '' }));
                    }}
                  />
                </View>
                {!!errors.budgetLimit && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.budgetLimit}</Text>}
              </View>

              {/* Submit Budget */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSaveBudget}
                disabled={isSubmitting}
                style={[
                  styles.submitBtn,
                  { backgroundColor: c.primary, opacity: isSubmitting ? 0.7 : 1 },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#10120E" />
                ) : (
                  <View style={styles.submitBtnInner}>
                    <Text style={[styles.submitBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>
                      Establish Budget Cap
                    </Text>
                    <Ionicons name="shield-checkmark" size={20} color={isLight ? '#FFF' : '#10120E'} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </StaggeredView>
        )}
      </ScrollView>

      {/* Category Management Modal */}
      <ManageCategoriesModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoriesUpdated={() => loadCategories()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  tabsWrap: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  catLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  manageCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manageCatBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    height: '100%',
    fontWeight: '600',
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 54,
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '900',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    height: '100%',
  },
  catChipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  catChipEmoji: {
    fontSize: 15,
  },
  catChipText: {
    fontSize: 12.5,
  },
  recurringToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  recurringToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recurringTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  recurringSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  togglePill: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  recurringBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  recurringBoxLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  freqChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  freqChipText: {
    fontSize: 11,
  },
  customDaysInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtn: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  errorMsg: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 5,
    marginLeft: 2,
  },
});
