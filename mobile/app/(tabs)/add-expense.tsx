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
  useWindowDimensions,
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
    editType?: "expense" | "income" | "savings" | "budget";
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
    // Savings fields
    editName?: string;
    editTargetAmount?: string;
    editCurrentAmount?: string;
    editTargetDate?: string;
    editRecurringAmount?: string;
    // Budget fields
    editPeriod?: string;
  }>();
  const isEditMode = Boolean(params.editId && params.editId !== "undefined" && params.editId !== "");

  const resetToAddNew = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.setParams({
      editId: "",
      editType: "",
      editDescription: "",
      editAmount: "",
      editCategoryId: "",
      editDate: "",
      editSource: "",
      editIsRecurring: "",
      editFrequency: "",
      editIntervalDays: "",
      editName: "",
      editTargetAmount: "",
      editCurrentAmount: "",
      editTargetDate: "",
      editRecurringAmount: "",
    });
    setDescription("");
    setAmount("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setIsRecurring(false);
    setIncomeSource("");
    setIncomeAmount("");
    setIncomeDate(new Date().toISOString().split("T")[0]);
    setIncomeDesc("");
    setIncomeIsRecurring(false);
    setGoalName("");
    setGoalTargetAmount("");
    setGoalInitialAmount("");
    setGoalIsRecurring(false);
    setErrors({});
  };
  const currSymbol = getCurrencySymbol(currency);
  const isLight = theme === 'light';
  const c = Colors[theme];

  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 700;
  const isDesktopOrTV = width >= 1024;

  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'savings' | 'budget'>('expense');

  // Income form state
  const [incomeSource, setIncomeSource] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().split('T')[0]);
  const [incomeDesc, setIncomeDesc] = useState('');
  const [incomeIsRecurring, setIncomeIsRecurring] = useState(false);
  const [incomeFrequency, setIncomeFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'>('MONTHLY');
  const [incomeIntervalDays, setIncomeIntervalDays] = useState('1');

  // Savings Goal form state
  const [goalName, setGoalName] = useState('');
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalInitialAmount, setGoalInitialAmount] = useState('');
  const defaultTargetDate = new Date();
  defaultTargetDate.setMonth(defaultTargetDate.getMonth() + 6);
  const [goalTargetDate, setGoalTargetDate] = useState(defaultTargetDate.toISOString().split('T')[0]);
  const [goalIsRecurring, setGoalIsRecurring] = useState(false);
  const [goalRecurringAmount, setGoalRecurringAmount] = useState('');
  const [goalFrequency, setGoalFrequency] = useState('MONTHLY');
  const [goalIntervalDays, setGoalIntervalDays] = useState('30');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<"expense" | "income" | "savings">("expense");

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
  const [budgetPeriod, setBudgetPeriod] = useState<string>('MONTHLY');
  const [budgetIntervalDays, setBudgetIntervalDays] = useState<string>('30');
  const [existingBudgets, setExistingBudgets] = useState<any[]>([]);
  const [isLoadingBudgets, setIsLoadingBudgets] = useState<boolean>(false);

  const loadExistingBudgets = async () => {
    if (!userId) return;
    try {
      setIsLoadingBudgets(true);
      const data = await apiRequest(`/expenses/budget/status/user/${userId}`);
      if (Array.isArray(data)) {
        setExistingBudgets(data);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoadingBudgets(false);
    }
  };

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
      if (params.editType) {
        setActiveTab(params.editType as any);
      }
      const type = params.editType || "expense";
      if (type === "expense") {
        setActiveTab("expense");
        if (params.editDescription) setDescription(params.editDescription);
        if (params.editAmount) setAmount(params.editAmount);
        if (params.editCategoryId) setCategoryId(Number(params.editCategoryId));
        if (params.editDate) setExpenseDate(params.editDate);
      } else if (type === "income") {
        setActiveTab("income");
        if (params.editSource) setIncomeSource(params.editSource);
        if (params.editAmount) setIncomeAmount(params.editAmount);
        if (params.editDate) setIncomeDate(params.editDate);
        if (params.editDescription) setIncomeDesc(params.editDescription);
        if (params.editIsRecurring !== undefined) {
          setIncomeIsRecurring(params.editIsRecurring === "true" || params.editIsRecurring === "1");
        }
        if (params.editFrequency) setIncomeFrequency(params.editFrequency as any);
        if (params.editIntervalDays) setIncomeIntervalDays(params.editIntervalDays);
      } else if (type === "savings") {
        setActiveTab("savings");
        if (params.editName) setGoalName(params.editName);
        if (params.editTargetAmount) setGoalTargetAmount(params.editTargetAmount);
        if (params.editCurrentAmount) setGoalInitialAmount(params.editCurrentAmount);
        if (params.editTargetDate) setGoalTargetDate(params.editTargetDate);
        if (params.editIsRecurring !== undefined) {
          setGoalIsRecurring(params.editIsRecurring === "true" || params.editIsRecurring === "1");
        }
        if (params.editRecurringAmount) setGoalRecurringAmount(params.editRecurringAmount);
        if (params.editFrequency) setGoalFrequency(params.editFrequency);
        if (params.editIntervalDays) setGoalIntervalDays(params.editIntervalDays);
      } else if (type === "budget") {
        setActiveTab("budget");
        if (params.editCategoryId) setBudgetCategoryId(Number(params.editCategoryId));
        if (params.editAmount) setBudgetLimit(params.editAmount);
        if (params.editPeriod) setBudgetPeriod(params.editPeriod);
        if (params.editIntervalDays) setBudgetIntervalDays(params.editIntervalDays);
      }
    } else {
      setBudgetLimit("");
      setBudgetPeriod("MONTHLY");
      setBudgetIntervalDays("30");
      setDescription("");
      setAmount("");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setIsRecurring(false);
      setIncomeSource("");
      setIncomeAmount("");
      setIncomeDate(new Date().toISOString().split("T")[0]);
      setIncomeDesc("");
      setIncomeIsRecurring(false);
      setGoalName("");
      setGoalTargetAmount("");
      setGoalInitialAmount("");
      setGoalIsRecurring(false);
      setErrors({});
    }
  }, [userId, params.editId, params.editType]);

  useEffect(() => {
    if (activeTab === 'budget' && userId) {
      loadExistingBudgets();
    }
  }, [activeTab, userId]);

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
          { text: 'OK', onPress: () => { resetToAddNew(); router.replace('/(tabs)'); } },
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
  /**
   * Validates and logs an income stream to the backend.
   */
  const handleSaveIncome = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!incomeSource.trim()) {
      showAlert('Validation Error', 'Please provide the income source or payor name.');
      return;
    }
    const numAmt = parseFloat(incomeAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      showAlert('Validation Error', 'Please enter a valid positive income amount.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        source: incomeSource.trim(),
        amount: numAmt,
        incomeDate: incomeDate,
        description: incomeDesc.trim(),
        isRecurring: incomeIsRecurring,
        frequency: incomeIsRecurring ? incomeFrequency : null,
        intervalDays: incomeIsRecurring && incomeFrequency === "CUSTOM" ? (parseInt(incomeIntervalDays, 10) || 1) : null,
      };

      if (isEditMode && params.editType === "income" && params.editId) {
        await apiRequest(`/incomes/${params.editId}/user/${userId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert("Updated!", "Income stream updated successfully.", [
          { text: "View Dashboard", onPress: () => router.replace("/(tabs)") },
        ]);
      } else {
        await apiRequest(`/incomes/user/${userId}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert("Recorded!", "Income stream logged successfully.", [
          { text: "View Dashboard", onPress: () => router.replace("/(tabs)") },
        ]);
      }
      setIncomeSource("");
      setIncomeAmount("");
      setIncomeDesc("");
      setIncomeIsRecurring(false);
      setIncomeFrequency("MONTHLY");
      setIncomeIntervalDays("1");
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : 'Could not save income record.';
      showAlert('Save Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Validates and establishes a new savings goal target.
   */
  const handleSaveSavingsGoal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!goalName.trim()) {
      showAlert('Validation Error', 'Please provide a name for this savings milestone.');
      return;
    }
    const numTarget = parseFloat(goalTargetAmount);
    if (isNaN(numTarget) || numTarget <= 0) {
      showAlert('Validation Error', 'Please enter a valid positive target amount.');
      return;
    }
    const numCurrent = parseFloat(goalInitialAmount || '0') || 0;
    const numRecurring = goalIsRecurring ? parseFloat(goalRecurringAmount || '0') || 0 : 0;
    if (goalIsRecurring && numRecurring <= 0) {
      showAlert('Validation Error', 'Please specify a valid positive installment amount for your Chit/RD.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: goalName.trim(),
        targetAmount: numTarget,
        currentAmount: numCurrent,
        targetDate: goalTargetDate,
        isRecurring: goalIsRecurring,
        recurringAmount: goalIsRecurring ? numRecurring : null,
        frequency: goalIsRecurring ? goalFrequency : null,
        intervalDays: goalIsRecurring && goalFrequency === "CUSTOM" ? parseInt(goalIntervalDays, 10) || 30 : null,
        nextDueDate: goalIsRecurring ? new Date().toISOString().split("T")[0] : null,
      };

      if (isEditMode && params.editType === "savings" && params.editId) {
        await apiRequest(`/savings/goals/${params.editId}/user/${userId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert("Goal Updated!", "Savings milestone updated successfully.", [
          { text: "View Dashboard", onPress: () => router.replace("/(tabs)") },
        ]);
      } else {
        await apiRequest(`/savings/goals/user/${userId}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert("Goal Configured!", goalIsRecurring ? "Recurring Chit / RD plan activated successfully." : "Savings milestone configured successfully.", [
          { text: "View Dashboard", onPress: () => router.replace("/(tabs)") },
        ]);
      }
      setGoalName("");
      setGoalTargetAmount("");
      setGoalInitialAmount("");
      setGoalIsRecurring(false);
      setGoalRecurringAmount("");
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : 'Could not save savings goal.';
      showAlert('Save Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBudgetFromList = (b: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    showAlert(
      'Delete Category Budget?',
      `Are you sure you want to remove the spending limit for ${b.categoryName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Budget',
          style: 'destructive',
          onPress: async () => {
            try {
              if (b.budgetId) {
                await apiRequest(`/expenses/budget/${b.budgetId}`, { method: 'DELETE' });
              } else {
                await apiRequest(`/expenses/budget/user/${userId}/category/${b.categoryId}`, { method: 'DELETE' });
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              showAlert('Budget Deleted', 'Category spending cap removed successfully.', undefined, 'success');
              loadExistingBudgets();
            } catch (e: any) {
              const msg = e instanceof ApiError ? e.message : 'Could not delete budget.';
              showAlert('Delete Failed', msg, undefined, 'error');
            }
          },
        },
      ],
      'destructive'
    );
  };

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

    if (budgetPeriod === 'CUSTOM') {
      const days = parseInt(budgetIntervalDays.trim(), 10);
      if (isNaN(days) || days <= 0) {
        fieldErrors.budgetIntervalDays = 'Please enter a valid number of days.';
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
      const customDays = budgetPeriod === 'CUSTOM' ? (parseInt(budgetIntervalDays.trim(), 10) || 30) : null;
      await apiRequest(`/expenses/budget/user/${userId}`, {
        method: 'POST',
        body: JSON.stringify({
          categoryId: budgetCategoryId,
          limitAmount: numLimit,
          limit: numLimit,
          period: budgetPeriod,
          intervalDays: customDays,
        }),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert(isEditMode ? '🎯 Budget Updated' : '🎯 Budget Saved', 'Category spending cap saved successfully.', [
        {
          text: 'OK',
          onPress: () => {
            loadExistingBudgets();
            if (isEditMode) router.replace('/(tabs)');
          },
        },
      ], 'success');
      if (!isEditMode) {
        setBudgetLimit('');
      }
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
          {
            paddingTop: Math.max(insets.top + 10, 48),
            maxWidth: 900,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: isDesktopOrTV ? 36 : (isLargeScreen ? 24 : 16),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={[styles.header, isEditMode && { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
          <View style={{ flex: 1, paddingRight: isEditMode ? 12 : 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[styles.pageTitle, { color: c.text }]}>
                {isEditMode
                  ? params.editType === "income"
                    ? "Edit Inflow"
                    : params.editType === "savings"
                    ? "Edit Milestone"
                    : "Edit Expense"
                  : "Record Outflow"}
              </Text>
              {isEditMode && (
                <View style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#F59E0B" }}>
                  <Text style={{ color: "#F59E0B", fontSize: 11, fontWeight: "700" }}>EDITING</Text>
                </View>
              )}
            </View>
            <Text style={[styles.pageSubtitle, { color: c.textMuted }]}>
              {isEditMode
                ? "Update existing transaction or plan details"
                : "Log a purchase, inflow or set category budget limits"}
            </Text>
          </View>

          {isEditMode && (
            <TouchableOpacity
              onPress={resetToAddNew}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <Ionicons name="add-circle" size={16} color={c.primary} />
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: c.primary }}>+ Add New</Text>
            </TouchableOpacity>
          )}
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
                activeTab === 'budget' && { backgroundColor: c.primary },
              ]}
            >
              <Ionicons
                name="shield-outline"
                size={15}
                color={activeTab === 'budget' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'budget' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted },
                ]}
              >
                Budget
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'income' ? (
          /* =========================================
              CASE: LOG INCOME FORM
             ========================================= */
          <StaggeredView delay={100} direction="up">
            <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Source / Payor</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                  placeholder="e.g. Primary Tech Salary, Consulting"
                  placeholderTextColor={c.textMuted}
                  value={incomeSource}
                  onChangeText={setIncomeSource}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Amount ({currSymbol})</Text>
                <View style={[styles.amountInputWrap, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                  <Text style={[styles.currencyPrefix, { color: "#10B981" }]}>{currSymbol}</Text>
                  <TextInput
                    style={[styles.amountInput, { color: c.text }]}
                    placeholder="0.00"
                    placeholderTextColor={c.textMuted}
                    keyboardType="decimal-pad"
                    value={incomeAmount}
                    onChangeText={setIncomeAmount}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Date Received (Tap to Pick)</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setCalendarTarget("income");
                    setShowCalendarModal(true);
                  }}
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: c.inputBg,
                      borderColor: c.border,
                      justifyContent: "space-between",
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Ionicons name="calendar" size={18} color="#10B981" style={styles.inputIcon} />
                    <Text style={[{ fontSize: 14, fontWeight: "700", color: c.text }]}>
                      {incomeDate || "Select Date"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                  placeholder="e.g. Direct deposit from employer"
                  placeholderTextColor={c.textMuted}
                  value={incomeDesc}
                  onChangeText={setIncomeDesc}
                />
              </View>

              <View style={styles.fieldGroup}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIncomeIsRecurring(!incomeIsRecurring)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <Ionicons
                    name={incomeIsRecurring ? "checkbox" : "square-outline"}
                    size={22}
                    color={incomeIsRecurring ? "#10B981" : c.textMuted}
                  />
                  <Text style={{ color: c.text, fontWeight: "600", fontSize: 13.5 }}>
                    Recurring Stream (e.g. Wages / Retainer)
                  </Text>
                </TouchableOpacity>
              </View>

              {incomeIsRecurring && (
                <View style={[styles.recurringBox, { backgroundColor: c.inputBg, borderColor: "rgba(16, 185, 129, 0.3)" }]}>
                  <Text style={[styles.recurringBoxLabel, { color: "#10B981" }]}>PAYMENT CADENCE</Text>
                  <View style={styles.freqRow}>
                    {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as const).map((freq) => {
                      const isSelected = incomeFrequency === freq;
                      return (
                        <TouchableOpacity
                          key={freq}
                          activeOpacity={0.8}
                          onPress={() => setIncomeFrequency(freq)}
                          style={[
                            styles.freqChip,
                            {
                              backgroundColor: isSelected ? "#10B981" : c.card,
                              borderColor: isSelected ? "#10B981" : c.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.freqChipText,
                              {
                                color: isSelected ? "#FFFFFF" : c.textMuted,
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

                  {incomeFrequency === 'CUSTOM' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Custom Interval (Days)</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          styles.customDaysInput,
                          {
                            backgroundColor: c.card,
                            borderColor: c.border,
                            color: c.text,
                          },
                        ]}
                        keyboardType="number-pad"
                        placeholder="e.g. 14, 30, 45"
                        placeholderTextColor={c.textMuted}
                        value={incomeIntervalDays}
                        onChangeText={setIncomeIntervalDays}
                      />
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSaveIncome}
                disabled={isSubmitting}
                style={[styles.submitBtn, { backgroundColor: "#10B981", opacity: isSubmitting ? 0.7 : 1 }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <View style={styles.submitBtnInner}>
                    <Text style={[styles.submitBtnText, { color: "#FFF" }]}>{isEditMode && params.editType === "income" ? "Update Inflow" : "Record Inflow"}</Text>
                    <Ionicons name="arrow-down-circle" size={20} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </StaggeredView>
        ) : activeTab === 'savings' ? (
          /* =========================================
              CASE: SAVINGS GOAL FORM
             ========================================= */
          <StaggeredView delay={100} direction="up">
            <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Milestone Name</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                  placeholder="e.g. Emergency Fund, Tesla Model Y"
                  placeholderTextColor={c.textMuted}
                  value={goalName}
                  onChangeText={setGoalName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Target Cap ({currSymbol})</Text>
                <View style={[styles.amountInputWrap, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                  <Text style={[styles.currencyPrefix, { color: "#F59E0B" }]}>{currSymbol}</Text>
                  <TextInput
                    style={[styles.amountInput, { color: c.text }]}
                    placeholder="10000.00"
                    placeholderTextColor={c.textMuted}
                    keyboardType="decimal-pad"
                    value={goalTargetAmount}
                    onChangeText={setGoalTargetAmount}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Initial Balance Saved ({currSymbol})</Text>
                <View style={[styles.amountInputWrap, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                  <Text style={[styles.currencyPrefix, { color: c.textMuted }]}>{currSymbol}</Text>
                  <TextInput
                    style={[styles.amountInput, { color: c.text }]}
                    placeholder="0.00"
                    placeholderTextColor={c.textMuted}
                    keyboardType="decimal-pad"
                    value={goalInitialAmount}
                    onChangeText={setGoalInitialAmount}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Target Due Date (Tap to Pick)</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setCalendarTarget("savings");
                    setShowCalendarModal(true);
                  }}
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: c.inputBg,
                      borderColor: c.border,
                      justifyContent: "space-between",
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Ionicons name="calendar" size={18} color="#F59E0B" style={styles.inputIcon} />
                    <Text style={[{ fontSize: 14, fontWeight: "700", color: c.text }]}>
                      {goalTargetDate || "Select Date"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Recurring Chit / RD Switch */}
              <View style={[styles.recurringToggleRow, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <View style={styles.recurringToggleLeft}>
                  <Ionicons name="shield-checkmark" size={20} color={goalIsRecurring ? '#F59E0B' : c.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recurringTitle, { color: c.text }]}>Recurring Chit / Deposit</Text>
                    <Text style={[styles.recurringSub, { color: c.textMuted }]}>
                      Automate installment tracking for chits, RDs, or SIPs
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    const nextVal = !goalIsRecurring;
                    setGoalIsRecurring(nextVal);
                    if (nextVal && !goalRecurringAmount && goalTargetAmount) {
                      setGoalRecurringAmount(String(Math.round(parseFloat(goalTargetAmount) / 12) || ''));
                    }
                  }}
                  style={[
                    styles.togglePill,
                    {
                      backgroundColor: goalIsRecurring ? '#F59E0B' : c.card,
                      borderColor: goalIsRecurring ? '#F59E0B' : c.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      {
                        backgroundColor: goalIsRecurring ? '#FFF' : c.textMuted,
                        transform: [{ translateX: goalIsRecurring ? 18 : 2 }],
                      },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {/* Recurring Installment Configuration Panel */}
              {goalIsRecurring && (
                <View style={[styles.recurringBox, { backgroundColor: c.inputBg, borderColor: '#F59E0B40' }]}>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: '#F59E0B' }]}>Installment Amount ({currSymbol})</Text>
                    <View style={[styles.amountInputWrap, { backgroundColor: c.card, borderColor: c.border }]}>
                      <Text style={[styles.currencyPrefix, { color: '#F59E0B' }]}>{currSymbol}</Text>
                      <TextInput
                        style={[styles.amountInput, { color: c.text }]}
                        placeholder="1000.00"
                        placeholderTextColor={c.textMuted}
                        keyboardType="decimal-pad"
                        value={goalRecurringAmount}
                        onChangeText={setGoalRecurringAmount}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.recurringBoxLabel, { color: c.textMuted }]}>DEPOSIT FREQUENCY</Text>
                    <View style={styles.freqRow}>
                      {['MONTHLY', 'WEEKLY', 'BI_WEEKLY', 'YEARLY', 'CUSTOM'].map((freq) => {
                        const isSel = goalFrequency === freq;
                        return (
                          <TouchableOpacity
                            key={freq}
                            activeOpacity={0.8}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              setGoalFrequency(freq);
                            }}
                            style={[
                              styles.freqChip,
                              {
                                backgroundColor: isSel ? '#F59E0B' : c.card,
                                borderColor: isSel ? '#F59E0B' : c.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.freqChipText,
                                {
                                  color: isSel ? '#FFF' : c.textMuted,
                                  fontWeight: isSel ? '800' : '600',
                                  fontSize: 11,
                                },
                              ]}
                            >
                              {freq.replace('_', ' ')}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {goalFrequency === 'CUSTOM' && (
                    <View style={[styles.fieldGroup, { marginTop: 12 }]}>
                      <Text style={[styles.recurringBoxLabel, { color: c.textMuted }]}>CUSTOM INTERVAL (DAYS)</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          styles.customDaysInput,
                          {
                            backgroundColor: c.card,
                            borderColor: c.border,
                            color: c.text,
                          },
                        ]}
                        placeholder="e.g. 30"
                        placeholderTextColor={c.textMuted}
                        keyboardType="number-pad"
                        value={goalIntervalDays}
                        onChangeText={setGoalIntervalDays}
                      />
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSaveSavingsGoal}
                disabled={isSubmitting}
                style={[styles.submitBtn, { backgroundColor: "#F59E0B", opacity: isSubmitting ? 0.7 : 1 }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <View style={styles.submitBtnInner}>
                    <Text style={[styles.submitBtnText, { color: "#FFF" }]}>{isEditMode && params.editType === "savings" ? "Update Milestone" : (goalIsRecurring ? "Activate Recurring Plan" : "Configure Milestone")}</Text>
                    <Ionicons name="flag" size={20} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </StaggeredView>
        ) : activeTab === 'expense' ? (
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
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setCalendarTarget("expense");
                    setShowCalendarModal(true);
                  }}
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

              {/* Budget Period Selector */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Budget Period</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'MONTHLY', label: 'Monthly' },
                    { id: 'WEEKLY', label: 'Weekly' },
                    { id: 'YEARLY', label: 'Yearly' },
                    { id: 'CUSTOM', label: 'Custom Interval' },
                  ].map((p) => {
                    const isSelected = budgetPeriod === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        activeOpacity={0.8}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setBudgetPeriod(p.id);
                        }}
                        style={[
                          styles.catChip,
                          {
                            backgroundColor: isSelected ? c.primary : c.inputBg,
                            borderColor: isSelected ? c.primary : c.border,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.catChipText,
                            {
                              color: isSelected ? (theme === 'light' ? '#FFF' : '#10120E') : c.text,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Custom Number of Days */}
              {budgetPeriod === 'CUSTOM' && (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Number of Days</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: c.inputBg,
                        borderColor: errors.budgetIntervalDays ? c.accent : c.border,
                        color: c.text,
                      },
                    ]}
                    placeholder="e.g. 30"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                    value={budgetIntervalDays}
                    onChangeText={(v) => {
                      setBudgetIntervalDays(v);
                      if (errors.budgetIntervalDays) setErrors((prev) => ({ ...prev, budgetIntervalDays: '' }));
                    }}
                  />
                  {!!errors.budgetIntervalDays && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.budgetIntervalDays}</Text>}
                </View>
              )}

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
                      {isEditMode ? 'Update Budget Cap' : 'Establish Budget Cap'}
                    </Text>
                    <Ionicons name="shield-checkmark" size={20} color={isLight ? '#FFF' : '#10120E'} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Existing Active Budgets List */}
            {existingBudgets.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={{ color: c.text, marginBottom: 12, fontSize: 16, fontWeight: '700' }}>
                  Configured Category Budgets
                </Text>
                <View style={{ gap: 10 }}>
                  {existingBudgets.map((b: any, idx: number) => {
                    const limitVal = Number(b.limit || 0);
                    const spentVal = Number(b.spent || 0);
                    const pct = limitVal > 0 ? Math.min(Math.round((spentVal / limitVal) * 100), 100) : 0;
                    return (
                      <View
                        key={b.budgetId || b.categoryId || idx}
                        style={[
                          styles.formCard,
                          {
                            backgroundColor: c.card,
                            borderColor: c.border,
                            padding: 14,
                            marginBottom: 0,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <Text style={{ fontSize: 18 }}>{getCategoryEmoji(b.categoryName)}</Text>
                            <View>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{b.categoryName}</Text>
                              <Text style={{ fontSize: 12, color: c.textMuted }}>
                                {b.period === 'CUSTOM' ? `${b.intervalDays || 30} Days` : b.period || 'Monthly'}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setBudgetCategoryId(b.categoryId);
                                setBudgetLimit(String(b.limit || ''));
                                setBudgetPeriod(b.period || 'MONTHLY');
                                if (b.intervalDays) setBudgetIntervalDays(String(b.intervalDays));
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="pencil" size={16} color={c.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteBudgetFromList(b)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="trash-outline" size={16} color={c.accent} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, color: c.textMuted }}>
                            {currSymbol}{Math.round(spentVal).toLocaleString()} spent
                          </Text>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: c.text }}>
                            {currSymbol}{Math.round(limitVal).toLocaleString()} limit ({pct}%)
                          </Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: c.inputBg, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 100 ? c.accent : pct >= 80 ? c.warning : c.primary }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </StaggeredView>
        )}
      </ScrollView>

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
          calendarTarget === "income"
            ? "Select Inflow Date"
            : calendarTarget === "savings"
            ? "Select Target Due Date"
            : "Select Expense Date"
        }
        initialDate={
          calendarTarget === "income"
            ? incomeDate
            : calendarTarget === "savings"
            ? goalTargetDate
            : expenseDate
        }
        onClose={() => setShowCalendarModal(false)}
        onSelectDate={(selectedDate) => {
          if (calendarTarget === "income") {
            setIncomeDate(selectedDate);
          } else if (calendarTarget === "savings") {
            setGoalTargetDate(selectedDate);
          } else {
            setExpenseDate(selectedDate);
            if (errors.date) setErrors((prev) => ({ ...prev, date: "" }));
          }
          setShowCalendarModal(false);
        }}
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
