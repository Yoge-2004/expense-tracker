/**
 * @file add-expense.tsx
 * @description Screen for logging new/edited transactions, configuring recurring commitments,
 * and setting category spending caps. Composes isolated, domain-focused form tabs.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { getCurrencySymbol } from '../../services/currency';
import { Colors } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { AmbientAura } from '../../components/AmbientAura';
import { ManageCategoriesModal } from '../../components/ManageCategoriesModal';
import { CalendarPickerModal } from '../../components/CalendarPickerModal';
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ImmersiveLoader } from '../../components/ImmersiveLoader';
import { ThemedScrollView } from '../../components/ThemedScrollbar';

import { useCategories } from '../../hooks/useCategories';
import { useExpenseForm } from '../../hooks/useExpenseForm';
import { useIncomeForm } from '../../hooks/useIncomeForm';
import { useSavingsGoalForm } from '../../hooks/useSavingsGoalForm';
import { useBudgetForm } from '../../hooks/useBudgetForm';

import { ExpenseFormTab } from '../../components/forms/ExpenseFormTab';
import { IncomeFormTab } from '../../components/forms/IncomeFormTab';
import { SavingsGoalFormTab } from '../../components/forms/SavingsGoalFormTab';
import { BudgetFormTab } from '../../components/forms/BudgetFormTab';
import { screenStyles as styles } from '../../components/forms/screenStyles';

export default function AddExpenseScreen() {
  const { userId, theme, currency } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 700;
  const isDesktopOrTV = width >= 1024;

  const params = useLocalSearchParams<{
    editType?: 'expense' | 'income' | 'savings' | 'budget';
    editId?: string;
    editDescription?: string;
    editAmount?: string;
    editCategoryId?: string;
    editDate?: string;
    // Income fields
    editSource?: string;
    editIsRecurring?: string;
    editFrequency?: string;
    editIntervalDays?: string;
    editKind?: string;
    editCountsToward?: string;
    editReimbursedCategoryId?: string;
    // Savings fields
    editName?: string;
    editTargetAmount?: string;
    editCurrentAmount?: string;
    editTargetDate?: string;
    editRecurringAmount?: string;
    // Budget fields
    editPeriod?: string;
    // Prefill params
    amount?: string;
    description?: string;
    merchant?: string;
    categoryId?: string;
  }>();

  const isEditMode = Boolean(params.editId && params.editId !== 'undefined' && params.editId !== '');
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'savings' | 'budget'>('expense');

  // Categories hook
  const {
    categories,
    isLoading: isCategoriesLoading,
    refreshing,
    setRefreshing,
    categoriesError,
    loadCategories,
  } = useCategories(userId);

  // Modal controls
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'expense' | 'income' | 'savings'>('expense');

  const { themeColors } = useAuth();
  const currSymbol = getCurrencySymbol(currency);
  const isLight = theme === 'light';
  const c = themeColors || Colors[theme];

  const handleSuccessNavigate = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  // Form Hooks
  const expenseForm = useExpenseForm({
    userId,
    currSymbol,
    categories,
    isEditMode: isEditMode && (!params.editType || params.editType === 'expense'),
    editId: params.editId,
    initialParams: useMemo(
      () => ({
        description: params.editDescription || params.description || params.merchant || '',
        amount: params.editAmount || params.amount || '',
        categoryId: params.editCategoryId || params.categoryId,
        date: params.editDate,
      }),
      [params.editDescription, params.description, params.merchant, params.editAmount, params.amount, params.editCategoryId, params.categoryId, params.editDate]
    ),
    onSuccess: handleSuccessNavigate,
    showAlert,
  });

  const incomeForm = useIncomeForm({
    userId,
    currSymbol,
    isEditMode: isEditMode && params.editType === 'income',
    editId: params.editId,
    initialParams: useMemo(
      () => ({
        source: params.editSource,
        amount: params.editAmount,
        date: params.editDate,
        description: params.editDescription,
        isRecurring: params.editIsRecurring === 'true' || params.editIsRecurring === '1',
        frequency: params.editFrequency as any,
        intervalDays: params.editIntervalDays,
        kind: params.editKind,
        countsToward: params.editCountsToward,
        reimbursedCategoryId: params.editReimbursedCategoryId ? Number(params.editReimbursedCategoryId) : null,
      }),
      [params.editSource, params.editAmount, params.editDate, params.editDescription, params.editIsRecurring, params.editFrequency, params.editIntervalDays, params.editKind, params.editCountsToward, params.editReimbursedCategoryId]
    ),
    onSuccess: handleSuccessNavigate,
    showAlert,
  });

  const savingsGoalForm = useSavingsGoalForm({
    userId,
    currSymbol,
    isEditMode: isEditMode && params.editType === 'savings',
    editId: params.editId,
    initialParams: useMemo(
      () => ({
        name: params.editName,
        targetAmount: params.editTargetAmount,
        currentAmount: params.editCurrentAmount,
        targetDate: params.editTargetDate,
        isRecurring: params.editIsRecurring === 'true' || params.editIsRecurring === '1',
        recurringAmount: params.editRecurringAmount,
        frequency: params.editFrequency,
        intervalDays: params.editIntervalDays,
      }),
      [params.editName, params.editTargetAmount, params.editCurrentAmount, params.editTargetDate, params.editIsRecurring, params.editRecurringAmount, params.editFrequency, params.editIntervalDays]
    ),
    onSuccess: handleSuccessNavigate,
    showAlert,
  });

  const budgetForm = useBudgetForm({
    userId,
    categories,
    isEditMode: isEditMode && params.editType === 'budget',
    editId: params.editId,
    initialParams: useMemo(
      () => ({
        categoryId: params.editCategoryId,
        amount: params.editAmount,
        period: params.editPeriod,
        intervalDays: params.editIntervalDays,
      }),
      [params.editCategoryId, params.editAmount, params.editPeriod, params.editIntervalDays]
    ),
    onSuccess: handleSuccessNavigate,
    showAlert,
  });

  // Synchronize active tab from route query params
  useEffect(() => {
    if (params.editType) {
      setActiveTab(params.editType);
    }
  }, [params.editType]);

  const resetToAddNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.setParams({
      editId: '',
      editType: '',
      editDescription: '',
      editAmount: '',
      editCategoryId: '',
      editDate: '',
      editSource: '',
      editIsRecurring: '',
      editFrequency: '',
      editIntervalDays: '',
      editName: '',
      editTargetAmount: '',
      editCurrentAmount: '',
      editTargetDate: '',
      editRecurringAmount: '',
      amount: '',
      description: '',
      merchant: '',
      categoryId: '',
    });
    expenseForm.resetForm();
    incomeForm.resetForm();
    savingsGoalForm.resetForm();
    budgetForm.resetForm();
  }, [router, expenseForm, incomeForm, savingsGoalForm, budgetForm]);

  if (isCategoriesLoading) {
    return (
      <ImmersiveLoader
        message="Preparing Transaction Matrix..."
        subMessage="Synchronizing categories & financial tags"
      />
    );
  }

  return (
    <View style={[styles.screenWrapper, { backgroundColor: c.bg }]}>
      <AmbientAura />

      <ThemedScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 10, 48),
            maxWidth: 900,
            width: '100%',
            alignSelf: 'center',
            paddingLeft: Math.max(isDesktopOrTV ? 36 : (isLargeScreen ? 24 : 16), insets.left),
            paddingRight: Math.max(isDesktopOrTV ? 36 : (isLargeScreen ? 24 : 16), insets.right),
            paddingBottom: Math.max(insets.bottom + 20, 36),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadCategories();
            }}
            tintColor={c.primary}
          />
        }
      >
        {categoriesError && (
          <OfflineBanner
            message={
              categories.length > 0
                ? 'Offline · showing saved categories'
                : "Couldn't load categories from the server"
            }
            onRetry={() => {
              setRefreshing(true);
              void loadCategories();
            }}
            retrying={refreshing}
          />
        )}

        {/* Top Header */}
        <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pageTitle, { color: c.text }]}>
                {isEditMode
                  ? params.editType === 'income'
                    ? 'Edit Inflow'
                    : params.editType === 'savings'
                    ? 'Edit Milestone'
                    : 'Edit Expense'
                  : 'Record Outflow'}
              </Text>
              {isEditMode && (
                <View
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#F59E0B',
                  }}
                >
                  <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>EDITING</Text>
                </View>
              )}
            </View>
            <Text style={[styles.pageSubtitle, { color: c.textMuted }]}>
              {isEditMode
                ? 'Update existing transaction or plan details'
                : 'Log a purchase, inflow or set category budget limits'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isEditMode && (
              <TouchableOpacity
                onPress={resetToAddNew}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Ionicons name="add-circle" size={16} color={c.primary} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.primary }}>Add New</Text>
              </TouchableOpacity>
            )}
            <ThemeToggleBtn />
          </View>
        </View>

        {/* Tab Switcher: Expense vs Income vs Savings vs Budget */}
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
                size={15}
                color={activeTab === 'expense' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'expense' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted },
                ]}
              >
                Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('income');
              }}
              style={[
                styles.tabBtn,
                activeTab === 'income' && { backgroundColor: '#10B981' },
              ]}
            >
              <Ionicons
                name="cash-outline"
                size={15}
                color={activeTab === 'income' ? '#FFF' : c.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'income' ? '#FFF' : c.textMuted },
                ]}
              >
                Income
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('savings');
              }}
              style={[
                styles.tabBtn,
                activeTab === 'savings' && { backgroundColor: '#F59E0B' },
              ]}
            >
              <Ionicons
                name="flag-outline"
                size={15}
                color={activeTab === 'savings' ? '#FFF' : c.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'savings' ? '#FFF' : c.textMuted },
                ]}
              >
                Goal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('budget');
              }}
              style={[
                styles.tabBtn,
                activeTab === 'budget' && { backgroundColor: c.teal },
              ]}
            >
              <Ionicons
                name="pie-chart-outline"
                size={15}
                color={activeTab === 'budget' ? '#FFF' : c.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'budget' ? '#FFF' : c.textMuted },
                ]}
              >
                Budget
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Body Rendering */}
        {activeTab === 'income' ? (
          <IncomeFormTab
            colors={c}
            currSymbol={currSymbol}
            categories={categories}
            onPickDate={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setCalendarTarget('income');
              setShowCalendarModal(true);
            }}
            form={incomeForm}
            isEditMode={isEditMode}
            editType={params.editType}
          />
        ) : activeTab === 'savings' ? (
          <SavingsGoalFormTab
            colors={c}
            currSymbol={currSymbol}
            onPickDate={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setCalendarTarget('savings');
              setShowCalendarModal(true);
            }}
            form={savingsGoalForm}
            isEditMode={isEditMode}
            editType={params.editType}
          />
        ) : activeTab === 'expense' ? (
          <ExpenseFormTab
            colors={c}
            theme={theme}
            currSymbol={currSymbol}
            categories={categories}
            onOpenManageCategories={() => setShowCategoryModal(true)}
            onPickDate={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setCalendarTarget('expense');
              setShowCalendarModal(true);
            }}
            form={expenseForm}
            isEditMode={isEditMode}
          />
        ) : (
          <BudgetFormTab
            colors={c}
            theme={theme}
            currSymbol={currSymbol}
            categories={categories}
            form={budgetForm}
            isEditMode={isEditMode}
          />
        )}
      </ThemedScrollView>

      {/* Category Management Modal */}
      <ManageCategoriesModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoriesUpdated={() => loadCategories()}
      />

      {/* Interactive Calendar Date Picker Modal */}
      <CalendarPickerModal
        visible={showCalendarModal}
        title={
          calendarTarget === 'income'
            ? 'Select Inflow Date'
            : calendarTarget === 'savings'
            ? 'Select Target Due Date'
            : 'Select Expense Date'
        }
        initialDate={
          calendarTarget === 'income'
            ? incomeForm.incomeDate
            : calendarTarget === 'savings'
            ? savingsGoalForm.goalTargetDate
            : expenseForm.expenseDate
        }
        onClose={() => setShowCalendarModal(false)}
        onSelectDate={(selectedDate) => {
          if (calendarTarget === 'income') {
            incomeForm.setIncomeDate(selectedDate);
          } else if (calendarTarget === 'savings') {
            savingsGoalForm.setGoalTargetDate(selectedDate);
          } else {
            expenseForm.setExpenseDate(selectedDate);
            if (expenseForm.errors.date) {
              expenseForm.setErrors((prev) => ({ ...prev, date: '' }));
            }
          }
          setShowCalendarModal(false);
        }}
      />
    </View>
  );
}
