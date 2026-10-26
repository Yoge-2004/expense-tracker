/**
 * @file add-expense.tsx
 * @description Screen for logging new/edited transactions, configuring recurring commitments,
 * and setting category spending caps with enterprise-grade defensive validation and exception handling.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { apiRequest, ApiError } from '../../services/api';
import { getCurrencySymbol } from '../../services/currency';
import { notifyTransactionRecorded, parseFinancialMessage, formatNotificationAmount } from '../../services/notifications';
import { Colors, getCategoryEmoji } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { AmbientAura } from '../../components/AmbientAura';
import { StaggeredView } from '../../components/StaggeredView';
import { ManageCategoriesModal } from '../../components/ManageCategoriesModal';
import { CalendarPickerModal } from '../../components/CalendarPickerModal';
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';
import { ChoiceChips } from '../../components/ChoiceChips';
import { IncomeKind, monthKey, monthLabel, shiftMonth } from '../../utils/moneyFlow';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ImmersiveLoader } from '../../components/ImmersiveLoader';
import { ThemedScrollView } from '../../components/ThemedScrollbar';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { parseReceiptText, scanReceiptWithOcr, SAMPLE_RECEIPTS, ParsedReceipt } from '../../services/receiptOcr';
import { SampleReceiptsPicker } from '../../components/SampleReceiptsPicker';
import { IncomeFormTab } from '../../components/forms/IncomeFormTab';
import { SavingsGoalFormTab } from '../../components/forms/SavingsGoalFormTab';
import { BudgetFormTab } from '../../components/forms/BudgetFormTab';
import { ExpenseFormTab } from '../../components/forms/ExpenseFormTab';
import { screenStyles as styles } from '../../components/forms/screenStyles';

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
  const y = Number.parseInt(yearStr, 10);
  const m = Number.parseInt(monthStr, 10);
  const d = Number.parseInt(dayStr, 10);

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
      amount: "",
      description: "",
      merchant: "",
      categoryId: "",
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
    setAiSuggestion(null);
    userOverrodeCategory.current = false;
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
  /** '' = automatic (salary if the source says so). */
  const [incomeKind, setIncomeKind] = useState<'' | IncomeKind>('');
  /** '' = the month it is received. Otherwise a "YYYY-MM" the money counts toward. */
  const [incomeCountsToward, setIncomeCountsToward] = useState('');
  const [incomeReimbursedCategoryId, setIncomeReimbursedCategoryId] = useState<number | null>(null);

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
  // "Counts toward" choices follow the date being entered: same month, next, previous
  // (plus a stored month when editing an income assigned further away).
  const incomeMonthOptions = React.useMemo(() => {
    const base = monthKey(incomeDate) || monthKey(new Date());
    const next = shiftMonth(base, 1);
    const previous = shiftMonth(base, -1);
    const options = [
      { value: '', label: `Same month (${monthLabel(base)})` },
      { value: next, label: `Next month (${monthLabel(next)})` },
      { value: previous, label: `Previous month (${monthLabel(previous)})` },
    ];
    if (incomeCountsToward && !options.some((o) => o.value === incomeCountsToward)) {
      options.push({ value: incomeCountsToward, label: monthLabel(incomeCountsToward) });
    }
    return options;
  }, [incomeDate, incomeCountsToward]);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<"expense" | "income" | "savings">("expense");

  // Expense form state
  const [description, setDescription] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<{
    category: string;
    confidence: number;
    matchedCatId?: number;
    matchedCatName?: string;
  } | null>(null);
  const [isAiClassifying, setIsAiClassifying] = useState(false);
  const userOverrodeCategory = useRef(false);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrSuccessData, setOcrSuccessData] = useState<ParsedReceipt | null>(null);
  const [showSampleReceipts, setShowSampleReceipts] = useState(false);
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

  const [refreshing, setRefreshing] = useState(false);
  /** True when the last attempt to load categories failed outright. */
  const [categoriesError, setCategoriesError] = useState(false);
  /** Bumped on every failed load so the auto-retry effect re-arms. */
  const [categoryRetryTick, setCategoryRetryTick] = useState(0);
  const categoryRetryCount = useRef(0);

  const applyReceiptData = (parsed: ParsedReceipt) => {
    if (parsed.merchant && parsed.merchant !== 'Receipt Purchase') {
      setDescription(parsed.merchant);
    } else if (!description) {
      setDescription('Receipt Expense');
    }
    if (parsed.amount > 0) {
      setAmount(String(parsed.amount));
    }
    if (parsed.date) {
      setExpenseDate(parsed.date);
    }
    if (parsed.category && categories.length > 0) {
      const matched = categories.find(
        (c) => c.name.toLowerCase() === parsed.category.toLowerCase()
      );
      if (matched) {
        setCategoryId(matched.id);
      }
    }
    setOcrSuccessData(parsed);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showAlert(
      'Receipt Scanned!',
      `Extracted: ${parsed.merchant} · ${currSymbol}${parsed.amount} (${parsed.confidence}% OCR confidence)`,
      undefined,
      'success'
    );
  };

  const handlePickReceipt = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const file = res.assets[0];
      setIsScanningOcr(true);
      const parsed = await scanReceiptWithOcr(file.uri, file.name, file.mimeType || 'image/png');
      applyReceiptData(parsed);
    } catch (err: any) {
      showAlert('OCR Scan Failed', err?.message || 'Unable to scan receipt document.');
    } finally {
      setIsScanningOcr(false);
    }
  };

  const handleTestSampleReceipt = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setShowSampleReceipts(false);
    setIsScanningOcr(true);
    setTimeout(() => {
      const sample = SAMPLE_RECEIPTS[idx] || SAMPLE_RECEIPTS[0];
      const parsed = parseReceiptText(sample.text);
      applyReceiptData(parsed);
      setIsScanningOcr(false);
    }, 400);
  };

  const handlePasteBankSms = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const hasStr = await Clipboard.hasStringAsync();
      if (hasStr) {
        const text = await Clipboard.getStringAsync();
        if (text && text.trim().length > 0) {
          const parsed = parseFinancialMessage(text);
          if (parsed.isFinancial && parsed.amount && parsed.amount > 0) {
            if (parsed.direction === "DEBIT") {
              setActiveTab("expense");
              setAmount(String(parsed.amount));
              const desc = parsed.merchant
                ? `${parsed.merchant}${parsed.accountTail ? ` (A/c xx${parsed.accountTail})` : ""}`
                : `Bank Debit${parsed.accountTail ? ` (A/c xx${parsed.accountTail})` : ""}`;
              setDescription(desc);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              const formattedParsedAmt = formatNotificationAmount(parsed.amount, parsed.currency, 2);
              showAlert("Bank SMS Parsed! ⚡", `Pre-filled ${formattedParsedAmt} at ${parsed.merchant || "Merchant"}.`, undefined, "success");
              return;
            } else if (parsed.direction === "CREDIT") {
              setActiveTab("income");
              setIncomeAmount(String(parsed.amount));
              setIncomeSource(parsed.merchant || "Bank Credit");
              setIncomeDesc(parsed.merchant ? `Credit from ${parsed.merchant}` : "Bank Inflow");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              const formattedParsedCredit = formatNotificationAmount(parsed.amount, parsed.currency, 2);
              showAlert("Bank Credit Parsed! 💰", `Pre-filled ${formattedParsedCredit} from ${parsed.merchant || "Source"}.`, undefined, "success");
              return;
            }
          }
        }
      }
      showAlert(
        "Paste Bank SMS",
        "Copy a bank SMS alert from your SMS app or notification drawer, then tap here to auto-fill amount, merchant, and details.",
        undefined,
        "info"
      );
    } catch (err: any) {
      showAlert("Could Not Read SMS", err?.message || "Please check clipboard permissions.");
    }
  };

  /**
   * Fetches merged global & user-defined categories with offline cache fallback.
   */
  const loadCategories = async () => {
    if (!userId) return;
    try {
      // Hydrate from cached categories if current state is empty
      if (categories.length === 0) {
        try {
          const cachedRaw = await AsyncStorage.getItem(`expense_cache_v4_${userId}`);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
              setCategories(parsed.categories);
              if (!categoryId) setCategoryId(parsed.categories[0].id);
              if (!budgetCategoryId) setBudgetCategoryId(parsed.categories[0].id);
            }
          }
        } catch (_) {}
      }

      // allSettled (not .catch(() => [])): a failed request must not look like
      // "there are no categories", otherwise the screen shows nothing and never
      // tells the user or retries.
      const [globalRes, userRes] = await Promise.allSettled([
        apiRequest('/categories/global'),
        apiRequest(`/categories/user/${userId}`),
      ]);
      const globalCats = globalRes.status === 'fulfilled' ? globalRes.value : null;
      const userCats = userRes.status === 'fulfilled' ? userRes.value : null;
      const loadedAny = Array.isArray(globalCats) || Array.isArray(userCats);
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

      if (uniqueCats.length > 0) {
        setCategories(uniqueCats);
        if (!categoryId) setCategoryId(uniqueCats[0].id);
        if (!budgetCategoryId) setBudgetCategoryId(uniqueCats[0].id);
      }
      if (loadedAny) {
        categoryRetryCount.current = 0;
        setCategoriesError(false);
      } else {
        setCategoriesError(true);
        setCategoryRetryTick((n) => n + 1);
      }
    } catch (e: any) {
      console.warn('[AddExpenseScreen] Error fetching categories:', e);
      setCategoriesError(true);
      setCategoryRetryTick((n) => n + 1);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadCategories();
    }, [userId])
  );

  // While categories cannot be loaded (typically the server is still waking
  // up), retry on its own with a growing delay, up to 4 times. The Retry button
  // and pull-to-refresh stay available after that.
  useEffect(() => {
    if (!categoriesError || categoryRetryCount.current >= 4) return;
    const delay = 4000 * (categoryRetryCount.current + 1);
    const timer = setTimeout(() => {
      categoryRetryCount.current += 1;
      void loadCategories();
    }, delay);
    return () => clearTimeout(timer);
  }, [categoriesError, categoryRetryTick]);

  useEffect(() => {
    void loadCategories();
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
        setIncomeKind((params.editKind as '' | IncomeKind) || '');
        const editMonth = params.editCountsToward || '';
        setIncomeCountsToward(editMonth && editMonth !== monthKey(params.editDate) ? editMonth : '');
        setIncomeReimbursedCategoryId(params.editReimbursedCategoryId ? Number(params.editReimbursedCategoryId) : null);
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
      setDescription(params.description || params.merchant || "");
      setAmount(params.amount || "");
      if (params.categoryId) {
        setCategoryId(Number(params.categoryId));
      }
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
  }, [userId, params.editId, params.editType, params.amount, params.description, params.merchant, params.categoryId]);

  useEffect(() => {
    if (activeTab !== 'expense' || isEditMode) return;
    const cleanDesc = description.trim();
    if (cleanDesc.length < 3) {
      setAiSuggestion(null);
      setIsAiClassifying(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsAiClassifying(true);
      try {
        const res = await apiRequest('/ml/classify', {
          method: 'POST',
          body: JSON.stringify({ description: cleanDesc, top_n: 3 }),
        });
        if (res && res.category) {
          const canonical = String(res.category);
          const conf = Number(res.confidence) || 0;
          const normCanonical = canonical.toLowerCase().replace(/[_-]/g, ' ');

          const matched = categories.find((cat) => {
            const name = (cat.name || '').toLowerCase().replace(/[_-]/g, ' ');
            return name === normCanonical || name.includes(normCanonical) || normCanonical.includes(name);
          });

          setAiSuggestion({
            category: canonical,
            confidence: conf,
            matchedCatId: matched?.id,
            matchedCatName: matched?.name,
          });

          if (!userOverrodeCategory.current && matched?.id && conf >= 0.65) {
            setCategoryId(matched.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }
      } catch (_) {
        // Silently skip if network or ML unavailable
      } finally {
        setIsAiClassifying(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [description, categories, activeTab, isEditMode]);

  useEffect(() => {
    if (activeTab === 'budget' && userId) {
      void loadExistingBudgets();
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
      const numAmount = Number.parseFloat(cleanAmount);
      if (Number.isNaN(numAmount) || numAmount <= 0) {
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
      const days = Number.parseInt(intervalDays.trim(), 10);
      if (Number.isNaN(days) || days < 1 || days > 365) {
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
      const numAmount = Number.parseFloat(cleanAmount);

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
            payload.intervalDays = Number.parseInt(intervalDays.trim(), 10);
          }
        }

        await apiRequest(`/expenses/user/${userId}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        // Confirm every new debit with its amount (edits do not notify).
        notifyTransactionRecorded({
          kind: 'DEBIT',
          amount: numAmount,
          currency: currSymbol,
          label: categories.find((cat) => cat.id === categoryId)?.name ?? 'Expense',
          detail: cleanDesc,
        }).catch(() => {});

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
    const numAmt = Number.parseFloat(incomeAmount);
    if (Number.isNaN(numAmt) || numAmt <= 0) {
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
        isRecurring: incomeKind === 'REIMBURSEMENT' ? false : incomeIsRecurring,
        frequency: incomeIsRecurring ? incomeFrequency : null,
        intervalDays: incomeIsRecurring && incomeFrequency === "CUSTOM" ? (Number.parseInt(incomeIntervalDays, 10) || 1) : null,
        kind: incomeKind,
        countsTowardMonth: incomeCountsToward,
        reimbursedCategoryId: incomeKind === 'REIMBURSEMENT' ? (incomeReimbursedCategoryId ?? 0) : 0,
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
        // Confirm every new credit with its amount (edits do not notify).
        notifyTransactionRecorded({
          kind: 'CREDIT',
          amount: numAmt,
          currency: currSymbol,
          label: incomeSource.trim(),
          detail: incomeDesc.trim() || undefined,
        }).catch(() => {});
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
      setIncomeKind('');
      setIncomeCountsToward('');
      setIncomeReimbursedCategoryId(null);
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
    const numTarget = Number.parseFloat(goalTargetAmount);
    if (Number.isNaN(numTarget) || numTarget <= 0) {
      showAlert('Validation Error', 'Please enter a valid positive target amount.');
      return;
    }
    const numCurrent = Number.parseFloat(goalInitialAmount || '0') || 0;
    const numRecurring = goalIsRecurring ? Number.parseFloat(goalRecurringAmount || '0') || 0 : 0;
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
        intervalDays: goalIsRecurring && goalFrequency === "CUSTOM" ? Number.parseInt(goalIntervalDays, 10) || 30 : null,
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
              void loadExistingBudgets();
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
      const numLimit = Number.parseFloat(cleanLimit);
      if (Number.isNaN(numLimit) || numLimit <= 0) {
        fieldErrors.budgetLimit = 'Please enter a valid positive budget amount.';
      } else if (numLimit > 100000000) {
        fieldErrors.budgetLimit = 'Budget cap cannot exceed 100,000,000.';
      }
    }

    if (budgetPeriod === 'CUSTOM') {
      const days = Number.parseInt(budgetIntervalDays.trim(), 10);
      if (Number.isNaN(days) || days <= 0) {
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
      const numLimit = Number.parseFloat(cleanLimit);
      const customDays = budgetPeriod === 'CUSTOM' ? (Number.parseInt(budgetIntervalDays.trim(), 10) || 30) : null;
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
            void loadExistingBudgets();
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
              categoryRetryCount.current = 0;
              setRefreshing(true);
              void loadCategories();
            }}
            retrying={refreshing}
          />
        )}

        {/* Top Header */}
        <View style={[styles.header, { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
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

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: c.primary }}>Add New</Text>
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
          <IncomeFormTab
            colors={c}
            currSymbol={currSymbol}
            incomeSource={incomeSource}
            setIncomeSource={setIncomeSource}
            incomeAmount={incomeAmount}
            setIncomeAmount={setIncomeAmount}
            incomeDate={incomeDate}
            onPickDate={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setCalendarTarget("income");
              setShowCalendarModal(true);
            }}
            incomeDesc={incomeDesc}
            setIncomeDesc={setIncomeDesc}
            incomeKind={incomeKind}
            setIncomeKind={setIncomeKind}
            incomeCountsToward={incomeCountsToward}
            setIncomeCountsToward={setIncomeCountsToward}
            incomeMonthOptions={incomeMonthOptions}
            categories={categories}
            incomeReimbursedCategoryId={incomeReimbursedCategoryId}
            setIncomeReimbursedCategoryId={setIncomeReimbursedCategoryId}
            incomeIsRecurring={incomeIsRecurring}
            setIncomeIsRecurring={setIncomeIsRecurring}
            incomeFrequency={incomeFrequency}
            setIncomeFrequency={setIncomeFrequency}
            incomeIntervalDays={incomeIntervalDays}
            setIncomeIntervalDays={setIncomeIntervalDays}
            focusedField={focusedField}
            setFocusedField={setFocusedField}
            handleSaveIncome={handleSaveIncome}
            isSubmitting={isSubmitting}
            isEditMode={isEditMode}
            editType={params.editType}
          />
        ) : activeTab === 'savings' ? (
          <SavingsGoalFormTab
            colors={c}
            currSymbol={currSymbol}
            goalName={goalName}
            setGoalName={setGoalName}
            goalTargetAmount={goalTargetAmount}
            setGoalTargetAmount={setGoalTargetAmount}
            goalInitialAmount={goalInitialAmount}
            setGoalInitialAmount={setGoalInitialAmount}
            goalTargetDate={goalTargetDate}
            onPickDate={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setCalendarTarget("savings");
              setShowCalendarModal(true);
            }}
            goalIsRecurring={goalIsRecurring}
            setGoalIsRecurring={setGoalIsRecurring}
            goalRecurringAmount={goalRecurringAmount}
            setGoalRecurringAmount={setGoalRecurringAmount}
            goalFrequency={goalFrequency}
            setGoalFrequency={setGoalFrequency}
            goalIntervalDays={goalIntervalDays}
            setGoalIntervalDays={setGoalIntervalDays}
            focusedField={focusedField}
            setFocusedField={setFocusedField}
            handleSaveSavingsGoal={handleSaveSavingsGoal}
            isSubmitting={isSubmitting}
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
              setCalendarTarget("expense");
              setShowCalendarModal(true);
            }}
            description={description}
            setDescription={setDescription}
            amount={amount}
            setAmount={setAmount}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            expenseDate={expenseDate}
            isRecurring={isRecurring}
            toggleRecurring={toggleRecurring}
            frequency={frequency}
            setFrequency={setFrequency}
            intervalDays={intervalDays}
            setIntervalDays={setIntervalDays}
            aiSuggestion={aiSuggestion}
            isAiClassifying={isAiClassifying}
            userOverrodeCategory={userOverrodeCategory}
            isScanningOcr={isScanningOcr}
            ocrSuccessData={ocrSuccessData}
            setOcrSuccessData={setOcrSuccessData}
            showSampleReceipts={showSampleReceipts}
            setShowSampleReceipts={setShowSampleReceipts}
            handlePickReceipt={handlePickReceipt}
            handlePasteBankSms={handlePasteBankSms}
            handleTestSampleReceipt={handleTestSampleReceipt}
            handleSmsDetectionInDesc={(v) => {
              if (v.length > 25 && (v.toLowerCase().includes('debited') || v.toLowerCase().includes('spent') || v.toLowerCase().includes('paid') || v.toLowerCase().includes('inr') || v.toLowerCase().includes('rs'))) {
                const parsed = parseFinancialMessage(v);
                if (parsed && parsed.amount != null && parsed.amount > 0) {
                  setDescription(parsed.merchant || 'Expense');
                  setAmount(String(parsed.amount));
                  if (parsed.timestamp) {
                    setExpenseDate(new Date(parsed.timestamp).toISOString().split('T')[0]);
                  }
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  showAlert('SMS Auto-Detected!', `Extracted ${currSymbol}${parsed.amount} for ${parsed.merchant || "Expense"}.`, undefined, 'success');
                  return;
                }
              }
              setDescription(v);
              if (errors.description) setErrors((prev) => ({ ...prev, description: "" }));
            }}
            focusedField={focusedField}
            setFocusedField={setFocusedField}
            errors={errors}
            setErrors={setErrors}
            handleSaveExpense={handleSaveExpense}
            isSubmitting={isSubmitting}
            isEditMode={isEditMode}
          />
        ) : (
          <BudgetFormTab
            colors={c}
            theme={theme}
            currSymbol={currSymbol}
            categories={categories}
            budgetCategoryId={budgetCategoryId}
            setBudgetCategoryId={setBudgetCategoryId}
            budgetLimit={budgetLimit}
            setBudgetLimit={setBudgetLimit}
            budgetPeriod={budgetPeriod}
            setBudgetPeriod={setBudgetPeriod}
            budgetIntervalDays={budgetIntervalDays}
            setBudgetIntervalDays={setBudgetIntervalDays}
            errors={errors}
            setErrors={setErrors}
            handleSaveBudget={handleSaveBudget}
            handleDeleteBudgetFromList={handleDeleteBudgetFromList}
            existingBudgets={existingBudgets}
            isSubmitting={isSubmitting}
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
