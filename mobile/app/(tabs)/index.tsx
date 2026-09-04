/**
 * @file index.tsx
 * @description Primary Financial Dashboard screen.
 * Displays:
 * - Top greeting bar with data hub export & theme toggle.
 * - Safe area notch adaptation via useSafeAreaInsets.
 * - Offline cached status and retry banners.
 * - 4-metric matrix with animated NumberTicker components.
 * - In-depth financial intelligence insight module.
 * - 5 SVG graphical charts (Category Donut, Spend Trend, Recurring Split, Day-of-Week, Budget vs Actual).
 * - Bounded Recent Transactions Ledger Container with internal scrolling to prevent infinite page growth.
 * - Multi-criteria search, global & custom category filter pills, custom date range (start & end date), and sorting.
 * - Custom in-app Alert and Confirmation modal integration.
 * - Pull-to-refresh and local cache hydration with exception recovery.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Animated,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { apiRequest, ApiError } from '../../services/api';
import { getCurrencySymbol } from '../../services/currency';
import { Colors, getCategoryColor, getCategoryEmoji } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { AmbientAura } from '../../components/AmbientAura';
import { NumberTicker } from '../../components/NumberTicker';
import { AnimatedCard } from '../../components/AnimatedCard';
import { AnimatedProgressBar } from '../../components/AnimatedProgressBar';
import { StaggeredView } from '../../components/StaggeredView';
import { InsightCards } from '../../components/InsightCards';
import {
  CategoryDonutChart,
  SpendTrendChart,
  RecurringSplitChart,
  DayOfWeekChart,
  BudgetVsActualChart,
} from '../../components/FinancialCharts';
import { CategoryPillsBar, DatePresetType } from '../../components/CategoryPillsBar';
import { ExportImportModal } from '../../components/ExportImportModal';

// Responsive dimensions handled dynamically via useWindowDimensions()

interface Expense {
  id: number;
  description: string;
  amount: number;
  expenseDate: string;
  categoryId: number;
  categoryName: string;
  isRecurring?: boolean;
  recurring?: boolean;
}

interface BudgetStatus {
  budgetId: number;
  categoryId: number;
  categoryName: string;
  limit: number;
  spent: number;
  percentage: number;
  status: string;
}

interface Category {
  id: number;
  name: string;
}

interface Income {
  id: number;
  source: string;
  amount: number;
  incomeDate: string;
  description?: string;
  isRecurring?: boolean;
  recurring?: boolean;
  frequency?: string;
  intervalDays?: number;
}

interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  status: string;
  isRecurring?: boolean;
  recurringAmount?: number;
  frequency?: string;
  intervalDays?: number;
}

interface Subscription {
  id: number;
  description: string;
  amount: number;
  frequency: string;
}

/**
 * Main dashboard screen component.
 */
export default function DashboardScreen() {
  const { userId, userName, theme, toggleTheme, currency } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currSymbol = getCurrencySymbol(currency);
  const isLight = theme === 'light';
  const c = Colors[theme];

  // Dynamic responsive window dimensions & adaptive layout breakpoints
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600 && width < 1024;
  const isDesktopOrTV = width >= 1024;
  const isLargeScreen = width >= 600;

  const containerPad = isDesktopOrTV ? 36 : (isTablet ? 24 : 16);
  const contentWidth = Math.min(width, 1180);
  const effectiveWidth = contentWidth - (containerPad * 2);
  const matrixCardWidth = isLargeScreen ? (effectiveWidth - (3 * 12)) / 4 : (effectiveWidth - 10) / 2;

  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cachedTime, setCachedTime] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [datePreset, setDatePreset] = useState<DatePresetType>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOption, setSortOption] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [showFilters, setShowFilters] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [ledgerTab, setLedgerTab] = useState<'all' | 'expenses' | 'incomes'>('all');

  // Animation values
  const filterAnim = useRef(new Animated.Value(0)).current;

  const CACHE_KEY = `expense_cache_v4_${userId}`;

  /**
   * Persists dashboard state to AsyncStorage for offline resilience.
   */
  const saveCache = async (data: any) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), ...data }));
    } catch (e) {
      console.warn('[Dashboard] Could not save cache to AsyncStorage:', e);
    }
  };

  /**
   * Loads offline cached state from AsyncStorage.
   */
  const loadCache = async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.savedAt) {
        const d = new Date(parsed.savedAt);
        setCachedTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      return parsed;
    } catch (e) {
      console.warn('[Dashboard] Corrupted cache detected, clearing:', e);
      await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
      return null;
    }
  };

  /**
   * Synchronizes dashboard state from backend endpoints with error containment.
   * Merges global categories and user custom categories.
   */
  const fetchData = async (silent: boolean = false) => {
    if (!userId) return;
    if (!silent) setIsLoading(true);

    try {
      const [expensesData, budgetsData, globalCats, userCats, subsData, incomesData, savingsData] = await Promise.all([
        apiRequest(`/expenses/user/${userId}`),
        apiRequest(`/expenses/budget/status/user/${userId}`),
        apiRequest(`/categories/global`).catch(() => []),
        apiRequest(`/categories/user/${userId}`).catch(() => []),
        apiRequest(`/expenses/recurring/user/${userId}`),
        apiRequest(`/incomes/user/${userId}`).catch(() => []),
        apiRequest(`/savings/goals/user/${userId}`).catch(() => []),
      ]);

      const safeExp = Array.isArray(expensesData) ? expensesData : [];
      const safeBud = Array.isArray(budgetsData) ? budgetsData : [];
      const safeSub = Array.isArray(subsData) ? subsData : [];

      // Merge global & custom user categories without duplicates
      const mergedCats = [
        ...(Array.isArray(globalCats) ? globalCats : []),
        ...(Array.isArray(userCats) ? userCats : []),
      ];
      const seenNames = new Set<string>();
      const safeCat: Category[] = [];
      mergedCats.forEach((cat) => {
        if (cat && cat.name && !seenNames.has(cat.name.trim().toLowerCase())) {
          seenNames.add(cat.name.trim().toLowerCase());
          safeCat.push(cat);
        }
      });

      setExpenses(safeExp);
      setBudgets(safeBud);
      setCategories(safeCat);
      setSubscriptions(safeSub);
      setIncomes(Array.isArray(incomesData) ? incomesData : []);
      setSavingsGoals(Array.isArray(savingsData) ? savingsData : []);
      setFetchError(null);
      setCachedTime(null);

      saveCache({
        expenses: safeExp,
        budgets: safeBud,
        categories: safeCat,
        subscriptions: safeSub,
        incomes: Array.isArray(incomesData) ? incomesData : [],
        savingsGoals: Array.isArray(savingsData) ? savingsData : [],
      });
    } catch (err: any) {
      console.warn('[Dashboard] Error fetching dashboard data:', err);
      const isApiErr = err instanceof ApiError;
      const msg = isApiErr ? err.message : 'Unable to synchronize with server.';
      setFetchError(msg);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Hydrates from offline storage first then initiates network sync.
   */
  const loadWithCache = async () => {
    const cached = await loadCache();
    if (cached) {
      if (Array.isArray(cached.expenses)) setExpenses(cached.expenses);
      if (Array.isArray(cached.budgets)) setBudgets(cached.budgets);
      if (Array.isArray(cached.categories)) setCategories(cached.categories);
      if (Array.isArray(cached.subscriptions)) setSubscriptions(cached.subscriptions);
      if (Array.isArray(cached.incomes)) setIncomes(cached.incomes);
      if (Array.isArray(cached.savingsGoals)) setSavingsGoals(cached.savingsGoals);
      setIsLoading(false);
      fetchData(true);
    } else {
      fetchData(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadWithCache();
    }, [userId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fetchData(true);
  };

  const toggleFilterPanel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const toValue = showFilters ? 0 : 1;
    setShowFilters(!showFilters);
    Animated.spring(filterAnim, {
      toValue,
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start();
  };

  const handleTransactionEdit = (tx: UnifiedTxItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (tx.type === "expense") {
      router.push({
        pathname: "/(tabs)/add-expense",
        params: {
          editType: "expense",
          editId: String(tx.id),
          editDescription: tx.expenseRaw?.description || tx.title,
          editAmount: String(tx.expenseRaw?.amount || tx.amount),
          editCategoryId: String(tx.expenseRaw?.categoryId || ""),
          editDate: tx.expenseRaw?.expenseDate || tx.date,
        },
      });
    } else {
      router.push({
        pathname: "/(tabs)/add-expense",
        params: {
          editType: "income",
          editId: String(tx.id),
          editSource: tx.incomeRaw?.source || tx.title,
          editAmount: String(tx.incomeRaw?.amount || tx.amount),
          editDate: tx.incomeRaw?.incomeDate || tx.date,
          editDescription: tx.incomeRaw?.description || "",
          editIsRecurring: String(tx.incomeRaw?.isRecurring || false),
          editFrequency: tx.incomeRaw?.frequency || "MONTHLY",
          editIntervalDays: String(tx.incomeRaw?.intervalDays || "1"),
        },
      });
    }
  };

  const handleTransactionDelete = (tx: UnifiedTxItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const isIncome = tx.type === "income";
    showAlert(
      `Delete ${isIncome ? "Inflow" : "Expense"}?`,
      `Are you sure you want to delete "${tx.title}" (${isIncome ? "+" : "-"}${currSymbol}${Number(tx.amount || 0).toLocaleString()})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (isIncome) {
                await apiRequest(`/incomes/${tx.id}/user/${userId}`, { method: "DELETE" });
                setIncomes((prev) => prev.filter((i) => i.id !== tx.id));
              } else {
                await apiRequest(`/expenses/${tx.id}/user/${userId}`, { method: "DELETE" });
                setExpenses((prev) => prev.filter((e) => e.id !== tx.id));
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              showAlert("Deleted", `${isIncome ? "Inflow" : "Expense"} record removed successfully.`, undefined, "success");
              fetchData(true);
            } catch (e: any) {
              const msg = e instanceof ApiError ? e.message : `Could not delete ${isIncome ? "income" : "expense"} record.`;
              showAlert("Delete Failed", msg, undefined, "error");
            }
          },
        },
      ],
      "destructive"
    );
  };

  const handleTransactionPress = (tx: UnifiedTxItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const isIncome = tx.type === "income";
    showAlert(
      `${isIncome ? "Inflow" : "Expense"} Actions`,
      `"${tx.title}" — ${isIncome ? "+" : "-"}${currSymbol}${Number(tx.amount || 0).toLocaleString()}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Edit",
          onPress: () => handleTransactionEdit(tx),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleTransactionDelete(tx),
        },
      ]
    );
  };

  const handleGoalEdit = (goal: SavingsGoal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: "/(tabs)/add-expense",
      params: {
        editType: "savings",
        editId: String(goal.id),
        editName: goal.name,
        editTargetAmount: String(goal.targetAmount),
        editCurrentAmount: String(goal.currentAmount),
        editTargetDate: goal.targetDate || "",
        editIsRecurring: String(goal.isRecurring || false),
        editRecurringAmount: String(goal.recurringAmount || ""),
        editFrequency: goal.frequency || "MONTHLY",
        editIntervalDays: String(goal.intervalDays || "30"),
      },
    });
  };

  const handleGoalDelete = (goal: SavingsGoal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    showAlert(
      "Delete Savings Goal?",
      `Are you sure you want to remove "${goal.name}"? Accumulated progress (${currSymbol}${Number(goal.currentAmount || 0).toLocaleString()}) will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Goal",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/savings/goals/${goal.id}/user/${userId}`, { method: "DELETE" });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setSavingsGoals((prev) => prev.filter((g) => g.id !== goal.id));
              showAlert("Deleted", "Savings goal removed successfully.", undefined, "success");
              fetchData(true);
            } catch (e: any) {
              const msg = e instanceof ApiError ? e.message : "Could not delete savings goal.";
              showAlert("Delete Failed", msg, undefined, "error");
            }
          },
        },
      ],
      "destructive"
    );
  };

  // Calculations for Matrix & Cash Flow Metrics
  const totalSpent = expenses.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
  const totalIncome = incomes.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
  const netCashFlow = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? ((netCashFlow / totalIncome) * 100).toFixed(1) : "0.0";

  const now = new Date();
  const currentDay = Math.max(now.getDate(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentMonthExpenses = expenses.filter((e) => {
    if (!e.expenseDate) return false;
    try {
      const d = new Date(e.expenseDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch {
      return false;
    }
  });
  const currentMonthSpent = currentMonthExpenses.reduce((s, e) => s + Math.max(0, Number(e.amount || 0)), 0);
  const dailyBurn = currentMonthSpent / currentDay;
  const monthEndForecast = dailyBurn * daysInMonth;

  // Category summary
  const catSummary: Record<string, number> = {};
  expenses.forEach((e) => {
    const name = e.categoryName || 'General';
    catSummary[name] = (catSummary[name] || 0) + Math.max(0, Number(e.amount || 0));
  });
  const sortedCats = Object.entries(catSummary).sort((a, b) => b[1] - a[1]);
  const highestCatName = sortedCats.length > 0 ? sortedCats[0][0] : 'None';
  const highestCatAmt = sortedCats.length > 0 ? sortedCats[0][1] : 0;

  // Filtered Expenses List (including Custom Date Range)
  const filteredExpenses = expenses
    .filter((e) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.categoryName && e.categoryName.toLowerCase().includes(q));

      const matchCategory =
        selectedCategory === 'all' ||
        (e.categoryName && e.categoryName.toLowerCase() === selectedCategory.toLowerCase());

      let matchDate = true;
      if (e.expenseDate) {
        try {
          const expD = new Date(e.expenseDate);
          const expDStr = e.expenseDate.split('T')[0];

          if (datePreset === 'today') {
            const todayStr = now.toISOString().split('T')[0];
            matchDate = expDStr === todayStr;
          } else if (datePreset === 'month') {
            matchDate = expD.getMonth() === now.getMonth() && expD.getFullYear() === now.getFullYear();
          } else if (datePreset === 'last30') {
            const thirtyAgo = new Date();
            thirtyAgo.setDate(thirtyAgo.getDate() - 30);
            matchDate = expD >= thirtyAgo;
          } else if (datePreset === 'custom') {
            if (startDate.trim() && expDStr < startDate.trim()) {
              matchDate = false;
            }
            if (endDate.trim() && expDStr > endDate.trim()) {
              matchDate = false;
            }
          }
        } catch {
          matchDate = true;
        }
      }

      return matchSearch && matchCategory && matchDate;
    });

  // Filtered Incomes List
  const filteredIncomes = incomes
    .filter((inc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (inc.source && inc.source.toLowerCase().includes(q)) ||
        (inc.description && inc.description.toLowerCase().includes(q));

      let matchDate = true;
      const dateStr = inc.incomeDate;
      if (dateStr) {
        try {
          const incD = new Date(dateStr);
          const incDStr = dateStr.split('T')[0];

          if (datePreset === 'today') {
            const todayStr = now.toISOString().split('T')[0];
            matchDate = incDStr === todayStr;
          } else if (datePreset === 'month') {
            matchDate = incD.getMonth() === now.getMonth() && incD.getFullYear() === now.getFullYear();
          } else if (datePreset === 'last30') {
            const thirtyAgo = new Date();
            thirtyAgo.setDate(thirtyAgo.getDate() - 30);
            matchDate = incD >= thirtyAgo;
          } else if (datePreset === 'custom') {
            if (startDate.trim() && incDStr < startDate.trim()) {
              matchDate = false;
            }
            if (endDate.trim() && incDStr > endDate.trim()) {
              matchDate = false;
            }
          }
        } catch {
          matchDate = true;
        }
      }

      return matchSearch && matchDate;
    });

  interface UnifiedTxItem {
    id: number;
    uniqueKey: string;
    type: "expense" | "income";
    title: string;
    categoryOrSource: string;
    amount: number;
    date: string;
    isRecurring: boolean;
    expenseRaw?: Expense;
    incomeRaw?: Income;
  }

  // Unified chronological ledger
  const unifiedTransactions: UnifiedTxItem[] = [
    ...(ledgerTab === "all" || ledgerTab === "expenses"
      ? filteredExpenses.map((e) => ({
          id: e.id,
          uniqueKey: `exp-${e.id}`,
          type: "expense" as const,
          title: e.description || "Expense",
          categoryOrSource: e.categoryName || "General",
          amount: Number(e.amount || 0),
          date: e.expenseDate || "",
          isRecurring: !!(e.isRecurring || e.recurring),
          expenseRaw: e,
        }))
      : []),
    ...(ledgerTab === "all" || ledgerTab === "incomes"
      ? filteredIncomes.map((i) => ({
          id: i.id,
          uniqueKey: `inc-${i.id}`,
          type: "income" as const,
          title: i.source || "Income",
          categoryOrSource: i.source || "Inflow",
          amount: Number(i.amount || 0),
          date: i.incomeDate || "",
          isRecurring: !!(i.isRecurring || i.recurring),
          incomeRaw: i,
        }))
      : []),
  ].sort((a, b) => {
    try {
      if (sortOption === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortOption === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortOption === 'amount-desc') return b.amount - a.amount;
      if (sortOption === 'amount-asc') return a.amount - b.amount;
    } catch {
      return 0;
    }
    return 0;
  });

  if (!isLoading && fetchError && expenses.length === 0) {
    return (
      <View style={[styles.errorWrapper, { backgroundColor: c.bg }]}>
        <AmbientAura />
        <View style={styles.errorCard}>
          <View style={[styles.errorIconBox, { backgroundColor: c.accent + '20' }]}>
            <Ionicons name="cloud-offline-outline" size={38} color={c.accent} />
          </View>
          <Text style={[styles.errorTitle, { color: c.text }]}>Unable to Load Ledger</Text>
          <Text style={[styles.errorDesc, { color: c.textMuted }]}>{fetchError}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => fetchData(false)}
            style={[styles.retryBtn, { backgroundColor: c.primary }]}
          >
            <Ionicons name="refresh" size={18} color="#10120E" />
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading && !refreshing && expenses.length === 0) {
    return (
      <View style={[styles.loadingWrapper, { backgroundColor: c.bg }]}>
        <AmbientAura />
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={[styles.loadingSub, { color: c.textMuted }]}>Assembling Financial Ledger...</Text>
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
            maxWidth: 1180,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: containerPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {/* =========================================
            1. TOP COMMAND BAR
           ========================================= */}
        <View style={styles.topBar}>
          <View style={styles.userCol}>
            <View style={[styles.avatarCircle, { backgroundColor: c.primary, borderColor: c.primary + '60' }]}>
              <Text style={styles.avatarLetter}>{(userName || 'U').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.userGreetingCol}>
              <Text style={[styles.greetingTitle, { color: c.text }]} numberOfLines={1} ellipsizeMode="tail">
                Welcome back, {userName || 'User'} 👋
              </Text>
              <Text style={[styles.todayDate, { color: c.textMuted }]} numberOfLines={1}>
                {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          </View>

          <View style={styles.topBarRight}>
            {/* Export / Data Hub Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setExportModalVisible(true)}
              style={[styles.topActionBtn, { backgroundColor: c.card, borderColor: c.border }]}
              accessibilityLabel="Export Data"
            >
              <Ionicons name="share-outline" size={18} color={c.primary} />
            </TouchableOpacity>

            {/* Theme Toggle Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                toggleTheme();
              }}
              style={[styles.topActionBtn, { backgroundColor: c.card, borderColor: c.border }]}
              accessibilityLabel="Toggle Theme"
            >
              <Ionicons name={isLight ? 'moon' : 'sunny'} size={18} color={c.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Offline / Cached Data Banner */}
        {fetchError && expenses.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => fetchData(true)}
            style={[styles.offlineBanner, { backgroundColor: '#C79A3E18', borderColor: '#C79A3E40' }]}
          >
            <Ionicons name="cloud-offline" size={16} color="#C79A3E" />
            <Text style={[styles.offlineBannerText, { color: '#C79A3E' }]}>
              Offline mode {cachedTime ? `· Cached at ${cachedTime}` : ''} · Tap to retry
            </Text>
          </TouchableOpacity>
        )}

        {/* =========================================
            1.5 EXECUTIVE CASH FLOW OVERVIEW
           ========================================= */}
        <StaggeredView delay={40} direction="up">
          <AnimatedCard style={[styles.cashFlowCard, { backgroundColor: c.card, borderColor: c.border }]} scaleTo={0.98}>
            <View style={styles.cashFlowHeader}>
              <View style={styles.cashFlowHeaderLeft}>
                <Ionicons name="trending-up" size={16} color={c.primary} />
                <Text style={[styles.cashFlowTitle, { color: c.text }]}>Executive Cash Flow</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: netCashFlow >= 0 ? "#10B98120" : "#EF444420" }]}>
                <Text style={[styles.statusPillText, { color: netCashFlow >= 0 ? "#10B981" : "#EF4444" }]}>
                  {netCashFlow >= 0 ? "Surplus" : "Deficit"}
                </Text>
              </View>
            </View>

            <View style={styles.cashFlowMetricsRow}>
              <View style={styles.cashFlowCol}>
                <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>Total Inflow</Text>
                <NumberTicker
                  value={totalIncome}
                  prefix={`+${currSymbol}`}
                  decimals={0}
                  style={[styles.cashFlowAmount, { color: "#10B981" }]}
                />
              </View>

              <View style={[styles.cashFlowDivider, { backgroundColor: c.border }]} />

              <View style={styles.cashFlowCol}>
                <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>Total Outflow</Text>
                <NumberTicker
                  value={totalSpent}
                  prefix={`-${currSymbol}`}
                  decimals={0}
                  style={[styles.cashFlowAmount, { color: c.text }]}
                />
              </View>

              <View style={[styles.cashFlowDivider, { backgroundColor: c.border }]} />

              <View style={styles.cashFlowCol}>
                <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>Savings Rate</Text>
                <NumberTicker
                  value={parseFloat(savingsRate) || 0}
                  suffix="%"
                  decimals={1}
                  style={[styles.cashFlowAmount, { color: c.primary }]}
                />
              </View>
            </View>
          </AnimatedCard>
        </StaggeredView>

        {/* =========================================
            2. FOUR-METRIC MATRIX KPI GRID
           ========================================= */}
        <StaggeredView delay={100} direction="up">
          <View style={[styles.matrixGrid, { gap: isLargeScreen ? 12 : 10 }]}>
            {/* Total Ledger Outflow */}
            <AnimatedCard style={[styles.matrixCard, { width: matrixCardWidth, backgroundColor: c.card, borderColor: c.primary + '40' }]} scaleTo={0.96}>
              <View style={styles.matrixTop}>
                <Text style={[styles.matrixLabel, { color: c.textMuted }]}>Total Outflow</Text>
                <View style={[styles.matrixBadge, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name="wallet-outline" size={13} color={c.primary} />
                </View>
              </View>
              <NumberTicker
                value={totalSpent}
                prefix={currSymbol}
                decimals={0}
                style={[styles.matrixValue, { color: c.text }]}
              />
              <Text style={[styles.matrixSub, { color: c.textMuted }]}>All-time cumulative</Text>
            </AnimatedCard>

            {/* Current Month Burn */}
            <AnimatedCard style={[styles.matrixCard, { width: matrixCardWidth, backgroundColor: c.card, borderColor: c.teal + '40' }]} scaleTo={0.96}>
              <View style={styles.matrixTop}>
                <Text style={[styles.matrixLabel, { color: c.textMuted }]}>This Month</Text>
                <View style={[styles.matrixBadge, { backgroundColor: c.teal + '18' }]}>
                  <Ionicons name="calendar-outline" size={13} color={c.teal} />
                </View>
              </View>
              <NumberTicker
                value={currentMonthSpent}
                prefix={currSymbol}
                decimals={0}
                style={[styles.matrixValue, { color: c.teal }]}
              />
              <Text style={[styles.matrixSub, { color: c.textMuted }]}>
                Day {currentDay} of {daysInMonth}
              </Text>
            </AnimatedCard>

            {/* Daily Velocity / Burn Rate */}
            <AnimatedCard style={[styles.matrixCard, { width: matrixCardWidth, backgroundColor: c.card, borderColor: c.accent + '40' }]} scaleTo={0.96}>
              <View style={styles.matrixTop}>
                <Text style={[styles.matrixLabel, { color: c.textMuted }]}>Daily Velocity</Text>
                <View style={[styles.matrixBadge, { backgroundColor: c.accent + '18' }]}>
                  <Ionicons name="speedometer-outline" size={13} color={c.accent} />
                </View>
              </View>
              <NumberTicker
                value={dailyBurn}
                prefix={currSymbol}
                suffix="/d"
                decimals={0}
                style={[styles.matrixValue, { color: c.accent }]}
              />
              <Text style={[styles.matrixSub, { color: c.textMuted }]}>
                Proj: {currSymbol}{Math.round(monthEndForecast).toLocaleString('en-IN')}
              </Text>
            </AnimatedCard>

            {/* Top Cost Driver */}
            <AnimatedCard style={[styles.matrixCard, { width: matrixCardWidth, backgroundColor: c.card, borderColor: c.warning + '40' }]} scaleTo={0.96}>
              <View style={styles.matrixTop}>
                <Text style={[styles.matrixLabel, { color: c.textMuted }]}>Top Category</Text>
                <View style={[styles.matrixBadge, { backgroundColor: c.warning + '18' }]}>
                  <Ionicons name="pie-chart-outline" size={13} color={c.warning} />
                </View>
              </View>
              <Text style={[styles.matrixValue, { color: c.text, fontSize: 16 }]} numberOfLines={1}>
                {highestCatName}
              </Text>
              <Text style={[styles.matrixSub, { color: c.textMuted }]}>
                {currSymbol}{Math.round(highestCatAmt).toLocaleString('en-IN')} (
                {totalSpent > 0 ? ((highestCatAmt / totalSpent) * 100).toFixed(0) : 0}%)
              </Text>
            </AnimatedCard>
          </View>
        </StaggeredView>

        {/* =========================================
            3. IN-DEPTH FINANCIAL INTELLIGENCE CARDS
           ========================================= */}
        <InsightCards
          expenses={expenses}
          budgets={budgets}
          incomes={incomes}
          savingsGoals={savingsGoals}
        />

        {/* =========================================
            4. VISUAL SVG ANALYTICS & CHARTS
           ========================================= */}
        <StaggeredView delay={180} direction="up">
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Visual Analytics</Text>
              <Text style={[styles.sectionSub, { color: c.textMuted }]}>
                Dynamic trend breakdown & category distributions
              </Text>
            </View>
          </View>
        </StaggeredView>

        {/* 1. Category Donut */}
        <StaggeredView delay={220} direction="up">
          <CategoryDonutChart expenses={expenses} />
        </StaggeredView>

        {/* 2. Spend Trend Line */}
        <StaggeredView delay={280} direction="up">
          <SpendTrendChart expenses={expenses} />
        </StaggeredView>

        {/* 3. Recurring vs Variable Spend Split */}
        <StaggeredView delay={340} direction="up">
          <RecurringSplitChart expenses={expenses} />
        </StaggeredView>

        {/* 4. Day of the Week Distribution */}
        <StaggeredView delay={400} direction="up">
          <DayOfWeekChart expenses={expenses} />
        </StaggeredView>

        {/* 5. Budget vs Actual Progress Bar */}
        <StaggeredView delay={460} direction="up">
          <BudgetVsActualChart budgets={budgets} />
        </StaggeredView>

        {/* =========================================
            4.5 SAVINGS GOALS & MILESTONES
           ========================================= */}
        {savingsGoals.length > 0 && (
          <StaggeredView delay={480} direction="up">
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Savings Goals</Text>
                <Text style={[styles.sectionSub, { color: c.textMuted }]}>
                  Target milestones and asset accumulation
                </Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
              {savingsGoals.map((goal) => {
                const ratio = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
                return (
                  <AnimatedCard key={goal.id} style={[styles.goalCard, { width: isLargeScreen ? 280 : 240, backgroundColor: c.card, borderColor: c.border }]} scaleTo={0.96}>
                    <View style={styles.goalTopRow}>
                      <Text style={[styles.goalName, { color: c.text }]} numberOfLines={1}>{goal.name}</Text>
                      <Text style={[styles.goalPercent, { color: ratio >= 100 ? "#10B981" : c.primary }]}>{ratio}%</Text>
                    </View>
                    <AnimatedProgressBar
                      progress={ratio}
                      height={7}
                      backgroundColor={c.inputBg}
                      fillColor={ratio >= 100 ? "#10B981" : "#F59E0B"}
                      style={{ borderRadius: 4, marginVertical: 8 }}
                    />
                    <View style={styles.goalBottomRow}>
                      <Text style={[styles.goalSaved, { color: c.textMuted }]}>
                        {currSymbol}{Math.round(goal.currentAmount).toLocaleString("en-IN")} / {currSymbol}{Math.round(goal.targetAmount).toLocaleString("en-IN")}
                      </Text>
                      <Text style={[styles.goalDate, { color: c.textMuted }]}>Due: {goal.targetDate || "Flexible"}</Text>
                    </View>
                    <View style={styles.goalActionsRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleGoalEdit(goal)}
                        style={[styles.goalMiniActionBtn, { backgroundColor: c.inputBg }]}
                        accessibilityLabel="Edit savings goal"
                      >
                        <Ionicons name="pencil" size={12} color="#F59E0B" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleGoalDelete(goal)}
                        style={[styles.goalMiniActionBtn, { backgroundColor: c.inputBg }]}
                        accessibilityLabel="Delete savings goal"
                      >
                        <Ionicons name="trash-outline" size={12} color={c.accent} />
                      </TouchableOpacity>
                    </View>
                  </AnimatedCard>
                );
              })}
            </ScrollView>
          </StaggeredView>
        )}

        {/* =========================================
            5. BOUNDED TRANSACTIONS CONTAINER
            (Prevents the entire screen from growing infinitely)
           ========================================= */}
        <StaggeredView delay={520} direction="up">
          <View style={[styles.ledgerContainer, { backgroundColor: c.card, borderColor: c.border }]}>
            {/* Ledger Container Header */}
            <View style={styles.ledgerHeader}>
              <View style={styles.ledgerHeaderLeft}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Recent Transactions</Text>
                <View style={[styles.countBadge, { backgroundColor: c.primary + '18' }]}>
                  <Text style={[styles.countBadgeText, { color: c.primary }]}>
                    {unifiedTransactions.length}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={toggleFilterPanel}
                style={[
                  styles.filterToggleBtn,
                  {
                    backgroundColor: showFilters ? c.primary + '20' : c.inputBg,
                    borderColor: showFilters ? c.primary : c.border,
                  },
                ]}
              >
                <Ionicons
                  name={showFilters ? 'options' : 'options-outline'}
                  size={14}
                  color={showFilters ? c.primary : c.textMuted}
                />
                <Text
                  style={[
                    styles.filterToggleText,
                    { color: showFilters ? c.primary : c.textMuted },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>
            </View>

            {/* Activity Stream Selector Pills: All | Expenses | Incomes */}
            <View style={[styles.streamTabsBar, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setLedgerTab('all');
                }}
                style={[styles.streamTabBtn, ledgerTab === 'all' && { backgroundColor: c.card, borderColor: c.primary, borderWidth: 1 }]}
              >
                <Text style={[styles.streamTabText, { color: ledgerTab === 'all' ? c.primary : c.textMuted, fontWeight: ledgerTab === 'all' ? '800' : '600' }]}>
                  All Activity ({filteredExpenses.length + filteredIncomes.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setLedgerTab('expenses');
                }}
                style={[styles.streamTabBtn, ledgerTab === 'expenses' && { backgroundColor: c.card, borderColor: c.primary, borderWidth: 1 }]}
              >
                <Text style={[styles.streamTabText, { color: ledgerTab === 'expenses' ? c.primary : c.textMuted, fontWeight: ledgerTab === 'expenses' ? '800' : '600' }]}>
                  Outflows ({filteredExpenses.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setLedgerTab('incomes');
                }}
                style={[styles.streamTabBtn, ledgerTab === 'incomes' && { backgroundColor: c.card, borderColor: '#10B981', borderWidth: 1 }]}
              >
                <Text style={[styles.streamTabText, { color: ledgerTab === 'incomes' ? '#10B981' : c.textMuted, fontWeight: ledgerTab === 'incomes' ? '800' : '600' }]}>
                  Inflows ({filteredIncomes.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={[styles.searchBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <Ionicons name="search" size={16} color={c.textMuted} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: c.text }]}
                placeholder="Search description or category..."
                placeholderTextColor={c.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={c.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Pills & Custom Date Presets */}
            <CategoryPillsBar
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              datePreset={datePreset}
              onSelectDatePreset={setDatePreset}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
            />

            {/* Expandable Advanced Sort & Controls */}
            {showFilters && (
              <View style={[styles.advancedPanel, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <Text style={[styles.advancedLabel, { color: c.textMuted }]}>Sort Order:</Text>
                <View style={styles.sortChipsWrap}>
                  {[
                    { id: 'date-desc', label: 'Latest First' },
                    { id: 'date-asc', label: 'Oldest First' },
                    { id: 'amount-desc', label: 'Highest Amount' },
                    { id: 'amount-asc', label: 'Lowest Amount' },
                  ].map((s) => {
                    const isSelected = sortOption === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setSortOption(s.id as any)}
                        style={[
                          styles.sortChip,
                          {
                            backgroundColor: isSelected ? c.primary : c.card,
                            borderColor: isSelected ? c.primary : c.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sortChipText,
                            {
                              color: isSelected ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Bounded Scrollable Items Box */}
            <View style={[styles.scrollableLedgerBox, { borderColor: c.border }]}>
              {unifiedTransactions.length === 0 ? (
                <View style={styles.emptyLedgerInside}>
                  <Ionicons name="receipt-outline" size={38} color={c.textMuted} />
                  <Text style={[styles.emptyLedgerTitle, { color: c.text }]}>No activity found</Text>
                  <Text style={[styles.emptyLedgerSub, { color: c.textMuted }]}>
                    {searchQuery || selectedCategory !== 'all' || datePreset !== 'all'
                      ? 'Adjust your search query, dates, or stream tabs.'
                      : 'Log transactions to see live inflows and outflows.'}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.innerListScroll}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                >
                  <View style={styles.transactionsList}>
                    {unifiedTransactions.map((tx) => {
                      const isIncome = tx.type === "income";
                      const catColor = isIncome ? "#10B981" : getCategoryColor(tx.categoryOrSource || "General").color;
                      return (
                        <TouchableOpacity
                          key={tx.uniqueKey}
                          activeOpacity={0.7}
                          onPress={() => handleTransactionPress(tx)}
                          onLongPress={() => handleTransactionPress(tx)}
                          style={[styles.txCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
                        >
                          <View style={styles.txLeft}>
                            <View style={[styles.catIconWrap, { backgroundColor: catColor + "18" }]}>
                              {isIncome ? (
                                <Ionicons name="arrow-down-circle" size={18} color="#10B981" />
                              ) : (
                                <Text style={styles.catEmojiText}>{getCategoryEmoji(tx.categoryOrSource || "General")}</Text>
                              )}
                            </View>
                            <View style={styles.txMeta}>
                              <Text style={[styles.txDesc, { color: c.text }]} numberOfLines={1}>
                                {tx.title}
                              </Text>
                              <View style={styles.txSubRow}>
                                <Text style={[styles.txCatName, { color: catColor }]}>
                                  {isIncome ? "Inflow" : tx.categoryOrSource}
                                </Text>
                                <Text style={[styles.txDot, { color: c.textMuted }]}>•</Text>
                                <Text style={[styles.txDate, { color: c.textMuted }]}>{tx.date}</Text>
                                {tx.isRecurring && (
                                  <View style={[styles.recurringBadge, { backgroundColor: (isIncome ? "#10B981" : c.primary) + "18" }]}>
                                    <Ionicons name="repeat" size={10} color={isIncome ? "#10B981" : c.primary} />
                                    <Text style={[styles.recurringBadgeText, { color: isIncome ? "#10B981" : c.primary }]}>
                                      {isIncome ? "Recurring Inflow" : "Sub"}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>

                          <View style={styles.txRight}>
                            <Text style={[styles.txAmount, { color: isIncome ? "#10B981" : c.text, fontWeight: "800" }]}>
                              {isIncome ? "+" : "-"}{currSymbol}
                              {Number(tx.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </Text>
                            <View style={styles.txRowActions}>
                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => handleTransactionEdit(tx)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={[styles.txMiniActionBtn, { backgroundColor: c.card }]}
                                accessibilityLabel="Edit transaction"
                              >
                                <Ionicons name="pencil" size={12} color={isIncome ? "#10B981" : c.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => handleTransactionDelete(tx)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={[styles.txMiniActionBtn, { backgroundColor: c.card }]}
                                accessibilityLabel="Delete transaction"
                              >
                                <Ionicons name="trash-outline" size={12} color={c.accent} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </StaggeredView>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Export / Import Modal */}
      <ExportImportModal
        visible={exportModalVisible}
        expenses={expenses}
        onClose={() => setExportModalVisible(false)}
        onDataImported={() => fetchData(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSub: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  errorWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorCard: {
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  errorIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  errorDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 10,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryBtnText: {
    color: '#10120E',
    fontWeight: '800',
    fontSize: 14,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  userGreetingCol: {
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    flexShrink: 0,
  },
  avatarLetter: {
    color: '#10120E',
    fontSize: 18,
    fontWeight: '900',
  },
  greetingTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  todayDate: {
    fontSize: 12,
    marginTop: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  topActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cashFlowCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cashFlowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cashFlowHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cashFlowTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  cashFlowMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cashFlowCol: {
    flex: 1,
    alignItems: "center",
  },
  cashFlowDivider: {
    width: 1,
    height: 28,
  },
  cashFlowLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  cashFlowAmount: {
    fontSize: 15,
    fontWeight: "900",
  },
  goalCard: {
    width: 240,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  goalTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  goalName: {
    fontSize: 13.5,
    fontWeight: "800",
    flex: 1,
    marginRight: 6,
  },
  goalPercent: {
    fontSize: 13,
    fontWeight: "900",
  },
  goalProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  goalProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  goalBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  goalSaved: {
    fontSize: 11,
    fontWeight: "600",
  },
  goalDate: {
    fontSize: 10.5,
  },
  matrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  matrixCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  matrixTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  matrixLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matrixBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matrixValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  matrixSub: {
    fontSize: 10.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 1,
  },
  ledgerContainer: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  streamTabsBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
    gap: 4,
  },
  streamTabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamTabText: {
    fontSize: 12,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  ledgerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
  },
  advancedPanel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  advancedLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sortChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 11.5,
  },
  scrollableLedgerBox: {
    height: 380,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
  },
  innerListScroll: {
    flex: 1,
    padding: 8,
  },
  emptyLedgerInside: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyLedgerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyLedgerSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  transactionsList: {
    gap: 8,
  },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  catIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catEmojiText: {
    fontSize: 16,
  },
  txMeta: {
    flex: 1,
  },
  txDesc: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  txSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txCatName: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  txDot: {
    fontSize: 8,
  },
  txDate: {
    fontSize: 10.5,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  recurringBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14.5,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  txRowActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  txMiniActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  goalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  goalMiniActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
});
