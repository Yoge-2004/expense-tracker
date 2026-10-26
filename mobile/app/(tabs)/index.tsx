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

import React, { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Animated,
  Dimensions,
  useWindowDimensions,
  AppState,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
  LogBox,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedScrollbar, ThemedScrollView } from '../../components/ThemedScrollbar';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { apiRequest, ApiError, checkServerHealth, resolveAvatarUrl } from '../../services/api';
import { getCurrencySymbol } from '../../services/currency';
import { scheduleSmartReminders } from '../../services/notifications';
import { Colors, getCategoryColor, getCategoryEmoji, ThemeColors } from '../../constants/theme';
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
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';
import { TransactionRow } from '../../components/dashboard/TransactionRow';
import { SearchField } from '../../components/dashboard/SearchField';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { DashboardMetricsMatrix } from '../../components/dashboard/DashboardMetricsMatrix';
import { DashboardLedger } from '../../components/dashboard/DashboardLedger';
import { SavingsGoalsSection } from '../../components/dashboard/SavingsGoalsSection';
import { dashboardStyles as styles } from '../../components/dashboard/dashboardStyles';
import { UnifiedTxItem } from '../../components/dashboard/dashboardTypes';
import { earnedTotal, effectiveMonth, monthKey, netSpent } from '../../utils/moneyFlow';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ImmersiveLoader } from '../../components/ImmersiveLoader';
import { LoansSection } from '../../components/LoansSection';
import {
  LoanAdjustment,
  LoanMetrics,
  getLoans,
  getLoanMetrics,
} from '../../services/loans';

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
  period?: string;
  intervalDays?: number;
  startDate?: string;
  endDate?: string;
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
  kind?: string;
  countsTowardMonth?: string;
  reimbursedCategoryId?: number | null;
  nextDueDate?: string | null;
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
  nextDueDate?: string | null;
}

interface Subscription {
  id: number;
  description: string;
  amount: number;
  frequency: string;
  nextDueDate?: string | null;
}

/**
 * Main dashboard screen component.
 */



// The ledger FlatList sits in the page's ScrollView, but it has a fixed height and scrolls on its own, so its
// windowing works as intended. React Native still prints its generic nesting warning in development builds.
LogBox.ignoreLogs(['VirtualizedLists should never be nested inside plain ScrollViews']);

/** Stable key for the virtualised ledger. */
const ledgerKeyExtractor = (tx: UnifiedTxItem) => tx.uniqueKey;

/** The 8px gap between ledger rows (a FlatList has no `gap`). */
const LedgerSeparator = () => <View style={styles.ledgerSeparator} />;

export default function DashboardScreen() {
  const { userId, userName, theme, toggleTheme, currency, profilePicture, isStealthMode, toggleStealthMode, refreshUserProfile } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();

  // Unread count for the bell, refreshed whenever this screen comes into focus.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      refreshUserProfile?.().catch(() => {});
      apiRequest(`/notifications/user/${userId}?limit=1`)
        .then((inbox) => setUnreadNotifications(inbox?.unreadCount || 0))
        .catch(() => {});
    }, [userId, refreshUserProfile])
  );
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
  const [loans, setLoans] = useState<LoanAdjustment[]>([]);
  const [loanMetrics, setLoanMetrics] = useState<LoanMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  /** True when the main data loaded but categories, incomes or goals did not. */
  const [partialError, setPartialError] = useState(false);
  /** Unread notifications, shown as a badge on the bell. */
  const [unreadNotifications, setUnreadNotifications] = useState(0);
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
  // Gesture support for swiping between stream tabs (All <-> Outflows <-> Inflows)
  const streamTabsResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -35) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setLedgerTab((curr) => (curr === "all" ? "expenses" : "incomes"));
        } else if (g.dx > 35) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setLedgerTab((curr) => (curr === "incomes" ? "expenses" : "all"));
        }
      },
    })
  ).current;


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
    else setRefreshing(true);

    try {
      const [expensesData, budgetsData, globalCats, userCats, subsData, incomesData, savingsData, loansData, loanMetricsData] = await Promise.all([
        apiRequest(`/expenses/user/${userId}`),
        apiRequest(`/expenses/budget/status/user/${userId}`),
        // null (not []) marks a failed request, so a transient error is never
        // mistaken for "the user has no categories/incomes/goals".
        apiRequest(`/categories/global`).catch(() => null),
        apiRequest(`/categories/user/${userId}`).catch(() => null),
        apiRequest(`/expenses/recurring/user/${userId}`),
        apiRequest(`/incomes/user/${userId}`).catch(() => null),
        apiRequest(`/savings/goals/user/${userId}`).catch(() => null),
        getLoans(userId).catch(() => null),
        getLoanMetrics(userId).catch(() => null),
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

      // Keep what we already had for any optional list whose request failed.
      // Previously a failed categories request replaced the list with [] and
      // saveCache() wrote that empty list to disk, wiping the cached
      // categories the Add tab hydrates from.
      const categoriesLoaded = Array.isArray(globalCats) || Array.isArray(userCats);
      const nextCategories = categoriesLoaded ? safeCat : categories;
      const nextIncomes = Array.isArray(incomesData) ? incomesData : incomes;
      const nextSavingsGoals = Array.isArray(savingsData) ? savingsData : savingsGoals;

      setExpenses(safeExp);
      setBudgets(safeBud);
      setCategories(nextCategories);
      setSubscriptions(safeSub);
      setIncomes(nextIncomes);
      setSavingsGoals(nextSavingsGoals);
      const safeLoans = Array.isArray(loansData) ? loansData : [];
      setLoans(safeLoans);
      if (loanMetricsData) setLoanMetrics(loanMetricsData);
      setFetchError(null);
      setPartialError(!categoriesLoaded || !Array.isArray(incomesData) || !Array.isArray(savingsData));
      setCachedTime(null);

      void saveCache({
        expenses: safeExp,
        budgets: safeBud,
        categories: nextCategories,
        subscriptions: safeSub,
        incomes: nextIncomes,
        savingsGoals: nextSavingsGoals,
        loans: safeLoans,
        loanMetrics: loanMetricsData,
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
      if (Array.isArray(cached.loans)) setLoans(cached.loans);
      if (cached.loanMetrics) setLoanMetrics(cached.loanMetrics);
      setIsLoading(false);
      void fetchData(true);
    } else {
      void fetchData(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadWithCache();
    }, [userId])
  );

  // Keep the on-device bill, salary and savings reminders in step with the data on screen. Same
  // mechanism as the 1:30 PM and 8:30 PM reminders: scheduled on the phone, no server needed.
  useEffect(() => {
    if (isLoading) return;
    scheduleSmartReminders({ currency: currSymbol, subscriptions, incomes, goals: savingsGoals }).catch(() => {});
  }, [isLoading, subscriptions, incomes, savingsGoals, currSymbol]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void Promise.all([
      fetchData(true),
      refreshUserProfile?.().catch(() => {}),
    ]);
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
          editKind: tx.incomeRaw?.kind || "",
          editCountsToward: tx.incomeRaw?.countsTowardMonth || "",
          editReimbursedCategoryId: String(tx.incomeRaw?.reimbursedCategoryId || ""),
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
              void fetchData(true);
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
        ...(!isIncome && userId ? [
          {
            text: "Split / Link to Loan",
            style: "teal" as any,
            onPress: () => {
              showAlert(
                "Convert / Link to Loan",
                `Convert "${tx.title}" (${currSymbol}${tx.amount}) into a loan / split record (peer, personal, or bank)?`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Create Loan",
                    style: "teal" as any,
                    onPress: async () => {
                      try {
                        const { createLoan, getLoanMetrics } = await import('../../services/loans');
                        const created = await createLoan(userId, {
                          counterparty: "Friend",
                          type: "LENT",
                          amount: tx.amount,
                          adjustmentDate: tx.date || new Date().toISOString().split('T')[0],
                          notes: `Split from: ${tx.title}`,
                          expenseId: tx.id,
                        });
                        setLoans((prev) => [created, ...prev]);
                        getLoanMetrics(userId).then((m) => setLoanMetrics(m)).catch(() => {});
                        showAlert("Loan Record Created", `Created friend adjustment for ${tx.title}. Tap Edit under Loans to adjust counterparty or split amount.`, undefined, "success");
                      } catch (err: any) {
                        showAlert("Action Failed", err?.message || "Could not link expense to loan", undefined, "error");
                      }
                    },
                  },
                ]
              );
            },
          },
        ] : []),
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
              void fetchData(true);
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

  const handleBudgetEdit = (b: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: "/(tabs)/add-expense",
      params: {
        editType: "budget",
        editId: String(b.budgetId || b.categoryId),
        editCategoryId: String(b.categoryId),
        editAmount: String(b.limit),
        editPeriod: b.period || "MONTHLY",
        editIntervalDays: String(b.intervalDays || "30"),
      },
    });
  };

  const handleBudgetDelete = (b: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    showAlert(
      "Delete Category Budget?",
      `Are you sure you want to remove the spending limit for ${b.categoryName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Budget",
          style: "destructive",
          onPress: async () => {
            try {
              if (b.budgetId) {
                await apiRequest(`/expenses/budget/${b.budgetId}`, { method: "DELETE" });
              } else {
                await apiRequest(`/expenses/budget/user/${userId}/category/${b.categoryId}`, { method: "DELETE" });
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setBudgets((prev) => prev.filter((item) => (item.budgetId ? item.budgetId !== b.budgetId : item.categoryId !== b.categoryId)));
              showAlert("Budget Deleted", "Category spending cap removed successfully.", undefined, "success");
              void fetchData(true);
            } catch (e: any) {
              const msg = e instanceof ApiError ? e.message : "Could not delete category budget.";
              showAlert("Delete Failed", msg, undefined, "error");
            }
          },
        },
      ],
      "destructive"
    );
  };

  // Filtered Expenses List (memoized across theme changes)
  const filteredExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const isToday = datePreset === 'today';
    const isMonth = datePreset === 'month';
    const isLast30 = datePreset === 'last30';
    const isCustom = datePreset === 'custom';
    const nowD = new Date();
    const todayStr = isToday ? nowD.toISOString().split('T')[0] : '';
    const nowMonth = isMonth ? nowD.getMonth() : -1;
    const nowYear = isMonth ? nowD.getFullYear() : -1;
    const thirtyAgo = isLast30 ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null;

    return expenses.filter((e) => {
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
          const expDStr = e.expenseDate.split('T')[0];

          if (isToday) {
            matchDate = expDStr === todayStr;
          } else if (isMonth) {
            matchDate = monthKey(e.expenseDate) === monthKey(nowD);
          } else if (isLast30 && thirtyAgo) {
            matchDate = new Date(e.expenseDate) >= thirtyAgo;
          } else if (isCustom) {
            if (startDate.trim() && expDStr < startDate.trim()) matchDate = false;
            if (endDate.trim() && expDStr > endDate.trim()) matchDate = false;
          }
        } catch {
          matchDate = true;
        }
      }

      return matchSearch && matchCategory && matchDate;
    });
  }, [expenses, searchQuery, selectedCategory, datePreset, startDate, endDate]);

  // Filtered Incomes List (memoized across theme changes)
  const filteredIncomes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const isToday = datePreset === 'today';
    const isMonth = datePreset === 'month';
    const isLast30 = datePreset === 'last30';
    const isCustom = datePreset === 'custom';
    const nowD = new Date();
    const todayStr = isToday ? nowD.toISOString().split('T')[0] : '';
    const thisMonth = isMonth ? monthKey(nowD) : '';
    const thirtyAgo = isLast30 ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null;

    return incomes.filter((inc) => {
      const matchSearch =
        !q ||
        (inc.source && inc.source.toLowerCase().includes(q)) ||
        (inc.description && inc.description.toLowerCase().includes(q));

      let matchDate = true;
      const dateStr = inc.incomeDate;
      if (dateStr) {
        try {
          const incDStr = dateStr.split('T')[0];

          if (isToday) {
            matchDate = incDStr === todayStr;
          } else if (isMonth) {
            // An income counts toward the month it is FOR (salary paid on the 30th for next month).
            matchDate = effectiveMonth(inc) === thisMonth;
          } else if (isLast30 && thirtyAgo) {
            matchDate = new Date(dateStr) >= thirtyAgo;
          } else if (isCustom) {
            if (startDate.trim() && incDStr < startDate.trim()) matchDate = false;
            if (endDate.trim() && incDStr > endDate.trim()) matchDate = false;
          }
        } catch {
          matchDate = true;
        }
      }

      return matchSearch && matchDate;
    });
  }, [incomes, searchQuery, datePreset, startDate, endDate]);

  // Dashboard metrics intentionally derive from the exact same filtered datasets as the ledger.
  const dashboardExpenses = filteredExpenses;
  const dashboardIncomes = filteredIncomes;

  const now = new Date();

  // Memoized KPIs & Category Summaries (zero compute on theme switch)
  const {
    totalSpent,
    totalIncome,
    netCashFlow,
    savingsRate,
    dailyBurn,
    monthEndForecast,
    currentMonthSpent,
    currentMonthInflow,
    currentDay,
    daysInMonth,
    highestCatName,
    highestCatAmt,
    safeDailySpend,
    noSpendStreak,
  } = useMemo(() => {
    // Money handed back reduces spending and is not income.
    const spent = netSpent(dashboardExpenses, dashboardIncomes);
    const income = earnedTotal(dashboardIncomes);
    const net = income - spent;
    const rate = income > 0 ? ((net / income) * 100).toFixed(1) : "0.0";

    const nowD = new Date();
    const cDay = Math.max(nowD.getDate(), 1);
    const dInMonth = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0).getDate();
    const thisMonth = monthKey(nowD);
    const thisMonthIncomes = incomes.filter((i) => effectiveMonth(i) === thisMonth);
    const thisMonthInflow = earnedTotal(thisMonthIncomes);
    const currentMonthExpenses = expenses.filter((e) => {
      if (!e.expenseDate) return false;
      return monthKey(e.expenseDate) === thisMonth;
    });
    const cMonthSpent = netSpent(
      currentMonthExpenses,
      thisMonthIncomes
    );
    const burn = cMonthSpent / cDay;
    const forecast = burn * dInMonth;

    const catSummary: Record<string, number> = {};
    dashboardExpenses.forEach((e) => {
      const name = e.categoryName || 'General';
      catSummary[name] = (catSummary[name] || 0) + Math.max(0, Number(e.amount || 0));
    });
    const sortedCats = Object.entries(catSummary).sort((a, b) => b[1] - a[1]);
    const topCatName = sortedCats.length > 0 ? sortedCats[0][0] : 'None';
    const topCatAmt = sortedCats.length > 0 ? sortedCats[0][1] : 0;

    // Safe-to-Spend Daily Allowance
    const daysLeft = Math.max(1, dInMonth - cDay + 1);
    const totalBudgetLimit = budgets.reduce((sum, b) => sum + Number(b.limit || 0), 0);
    let safeSpend = 0;
    if (totalBudgetLimit > 0) {
      safeSpend = Math.max(0, (totalBudgetLimit - cMonthSpent) / daysLeft);
    } else if (thisMonthInflow > 0) {
      safeSpend = Math.max(0, (thisMonthInflow - cMonthSpent) / daysLeft);
    } else {
      safeSpend = Math.max(0, burn * 0.85);
    }

    // No-Spend Day Streak
    const spendByDate = new Map<string, number>();
    expenses.forEach((e) => {
      if (!e.expenseDate) return;
      const dStr = e.expenseDate.split('T')[0];
      if (dStr) {
        spendByDate.set(dStr, (spendByDate.get(dStr) || 0) + Number(e.amount || 0));
      }
    });

    const formatD = (d: Date) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      return yr + '-' + mo + '-' + da;
    };

    let streak = 0;
    const checkD = new Date();
    const todayStr = formatD(checkD);
    const todaySpent = spendByDate.get(todayStr) || 0;
    if (todaySpent === 0) {
      streak = 1;
      checkD.setDate(checkD.getDate() - 1);
    } else {
      checkD.setDate(checkD.getDate() - 1);
    }
    for (let i = 0; i < 365; i++) {
      const dStr = formatD(checkD);
      const spentOnD = spendByDate.get(dStr) || 0;
      if (spentOnD === 0) {
        streak++;
        checkD.setDate(checkD.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      totalSpent: spent,
      totalIncome: income,
      netCashFlow: net,
      savingsRate: rate,
      dailyBurn: burn,
      monthEndForecast: forecast,
      currentMonthSpent: cMonthSpent,
      currentMonthInflow: thisMonthInflow,
      currentDay: cDay,
      daysInMonth: dInMonth,
      highestCatName: topCatName,
      highestCatAmt: topCatAmt,
      safeDailySpend: safeSpend,
      noSpendStreak: streak,
    };
  }, [dashboardExpenses, dashboardIncomes, expenses, incomes, budgets]);

  // Unified chronological ledger (memoized across theme changes)
  const unifiedTransactions: UnifiedTxItem[] = useMemo(() => {
    const list: UnifiedTxItem[] = [
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
            title: (i.description && i.description.trim()) ? i.description.trim() : (i.source || "Income"),
            categoryOrSource: i.source || "Inflow",
            amount: Number(i.amount || 0),
            date: i.incomeDate || "",
            isRecurring: !!(i.isRecurring || i.recurring),
            incomeRaw: i,
          }))
        : []),
    ];

    return list.sort((a, b) => {
      try {
        if (sortOption === 'date-desc') {
          if (b.date !== a.date) return b.date > a.date ? 1 : -1;
          return (b.id || 0) - (a.id || 0);
        }
        if (sortOption === 'date-asc') {
          if (a.date !== b.date) return a.date > b.date ? 1 : -1;
          return (a.id || 0) - (b.id || 0);
        }
        if (sortOption === 'amount-desc') {
          const aDiff = b.amount - a.amount;
          if (aDiff !== 0) return aDiff;
          if (b.date !== a.date) return b.date > a.date ? 1 : -1;
          return (b.id || 0) - (a.id || 0);
        }
        if (sortOption === 'amount-asc') {
          const aDiff = a.amount - b.amount;
          if (aDiff !== 0) return aDiff;
          if (b.date !== a.date) return b.date > a.date ? 1 : -1;
          return (b.id || 0) - (a.id || 0);
        }
      } catch {
        return 0;
      }
      return 0;
    });
  }, [ledgerTab, filteredExpenses, filteredIncomes, sortOption]);

  // Rows are memoised, so the handlers they receive must keep the same identity between renders.
  const rowActions = useRef({ press: handleTransactionPress, edit: handleTransactionEdit, remove: handleTransactionDelete });
  rowActions.current = { press: handleTransactionPress, edit: handleTransactionEdit, remove: handleTransactionDelete };
  const onRowPress = useCallback((tx: UnifiedTxItem) => rowActions.current.press(tx), []);
  const onRowEdit = useCallback((tx: UnifiedTxItem) => rowActions.current.edit(tx), []);
  const onRowDelete = useCallback((tx: UnifiedTxItem) => rowActions.current.remove(tx), []);

  // The ledger is a virtualised FlatList: only the rows on screen (plus a small buffer) exist, however many
  // transactions are loaded. A theme change therefore repaints a handful of rows, not every row scrolled past.
  const ledgerScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const ledgerScrollY = useRef(new Animated.Value(0)).current;
  const [ledgerContentHeight, setLedgerContentHeight] = useState(0);
  const [ledgerViewHeight, setLedgerViewHeight] = useState(0);
  const [ledgerDisplayLimit, setLedgerDisplayLimit] = useState(20);
  const onLedgerScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => ledgerScrollY.setValue(e.nativeEvent.contentOffset.y),
    [ledgerScrollY]
  );
  const matrixCardStyles = useMemo(() => ({
    cardPrimary: [styles.matrixCard, { width: matrixCardWidth, backgroundColor: c.card, borderColor: `${c.primary}40` }],
    badgePrimary: [styles.matrixBadge, { backgroundColor: `${c.primary}18` }],
    cardTeal: [styles.matrixCard, { width: matrixCardWidth, backgroundColor: c.card, borderColor: `${c.teal}40` }],
    badgeTeal: [styles.matrixBadge, { backgroundColor: `${c.teal}18` }],
    cardAccent: [styles.matrixCard, { width: matrixCardWidth, backgroundColor: c.card, borderColor: `${c.accent}40` }],
    badgeAccent: [styles.matrixBadge, { backgroundColor: `${c.accent}18` }],
    cardWarning: [styles.matrixCard, { width: matrixCardWidth, backgroundColor: c.card, borderColor: `${c.warning}40` }],
    badgeWarning: [styles.matrixBadge, { backgroundColor: `${c.warning}18` }],
  }), [matrixCardWidth, c.card, c.primary, c.teal, c.accent, c.warning]);

  const displayedTransactions = useMemo(
    () => unifiedTransactions.slice(0, ledgerDisplayLimit),
    [unifiedTransactions, ledgerDisplayLimit]
  );

  const onLedgerContentSize = useCallback((_w: number, h: number) => setLedgerContentHeight(h), []);
  const onLedgerLayout = useCallback((e: LayoutChangeEvent) => setLedgerViewHeight(e.nativeEvent.layout.height), []);
  const renderLedgerItem = useCallback(
    ({ item }: { item: UnifiedTxItem }) => (
      <TransactionRow
        tx={item}
        colors={c}
        currSymbol={currSymbol}
        isStealth={isStealthMode}
        onPress={onRowPress}
        onEdit={onRowEdit}
        onDelete={onRowDelete}
      />
    ),
    [c, currSymbol, isStealthMode, onRowPress, onRowEdit, onRowDelete]
  );
  // Changing the filters or sort order starts the list from the top again.
  useEffect(() => {
    ledgerScrollRef.current?.scrollTo({ y: 0, animated: false });
    setLedgerDisplayLimit(20);
  }, [searchQuery, selectedCategory, datePreset, startDate, endDate, ledgerTab, sortOption]);

  // The search text is typed in SearchField; applying it to the list is a non-urgent update.
  const handleSearch = useCallback((query: string) => {
    startTransition(() => setSearchQuery(query));
  }, []);

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
      <ImmersiveLoader
        message="Assembling Financial Ledger..."
        subMessage="Calculating spend velocity & intelligence"
      />
    );
  }

  return (
    <View style={[styles.screenWrapper, { backgroundColor: c.bg }]}>
      <AmbientAura />

      <ThemedScrollView
        hideScrollbar={true}
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 10, 48),
            maxWidth: 1180,
            width: '100%',
            alignSelf: 'center',
            paddingLeft: Math.max(containerPad, insets.left),
            paddingRight: Math.max(containerPad, insets.right),
            paddingBottom: Math.max(insets.bottom + 20, 36),
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {/* =========================================
            1. TOP COMMAND BAR
           ========================================= */}
        <DashboardHeader
          userName={userName}
          profilePicture={profilePicture}
          unreadNotifications={unreadNotifications}
          isStealthMode={isStealthMode}
          toggleStealthMode={toggleStealthMode}
          onOpenExportModal={() => setExportModalVisible(true)}
          colors={c}
          theme={theme}
        />

        {/* Offline / Cached Data Banner */}
        {(fetchError || partialError) && expenses.length > 0 && (
          <OfflineBanner
            message={
              fetchError
                ? `Offline mode${cachedTime ? ` · Cached at ${cachedTime}` : ""}`
                : "Some data couldn't be refreshed"
            }
            onRetry={() => fetchData(true)}
            retrying={refreshing}
          />
        )}

        {/* =========================================
            2. CASH FLOW OVERVIEW & 4-METRIC MATRIX KPI GRID
           ========================================= */}
        <DashboardMetricsMatrix
          colors={c}
          theme={theme}
          currSymbol={currSymbol}
          isStealthMode={isStealthMode}
          isLargeScreen={isLargeScreen}
          matrixCardWidth={matrixCardWidth}
          netCashFlow={netCashFlow}
          totalIncomeMonth={totalIncomeMonth}
          totalExpenseMonth={totalExpenseMonth}
          safeDailySpend={safeDailySpend}
          noSpendStreak={noSpendStreak}
          totalSpent={totalSpent}
          currentMonthSpent={currentMonthSpent}
          currentMonthInflow={currentMonthInflow}
          currentDay={currentDay}
          daysInMonth={daysInMonth}
          dailyBurn={dailyBurn}
          monthEndForecast={monthEndForecast}
          highestCatName={highestCatName}
          highestCatAmt={highestCatAmt}
        />

        {/* =========================================
            3. IN-DEPTH FINANCIAL INTELLIGENCE CARDS
           ========================================= */}
        <InsightCards
          expenses={dashboardExpenses}
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
          <CategoryDonutChart expenses={dashboardExpenses} />
        </StaggeredView>

        {/* 2. Spend Trend Line */}
        <StaggeredView delay={280} direction="up">
          <SpendTrendChart expenses={dashboardExpenses} />
        </StaggeredView>

        {/* 3. Recurring vs Variable Spend Split */}
        <StaggeredView delay={340} direction="up">
          <RecurringSplitChart expenses={dashboardExpenses} />
        </StaggeredView>

        {/* 4. Day of the Week Distribution */}
        <StaggeredView delay={400} direction="up">
          <DayOfWeekChart expenses={dashboardExpenses} />
        </StaggeredView>

        {/* 5. Budget vs Actual Progress Bar */}
        <StaggeredView delay={460} direction="up">
          <BudgetVsActualChart
            budgets={budgets}
            onEditBudget={handleBudgetEdit}
            onDeleteBudget={handleBudgetDelete}
          />
        </StaggeredView>

        {/* =========================================
            4.5 SAVINGS GOALS & MILESTONES
           ========================================= */}
        <SavingsGoalsSection
          savingsGoals={savingsGoals}
          colors={c}
          currSymbol={currSymbol}
          isStealthMode={isStealthMode}
          isLargeScreen={isLargeScreen}
          onEditGoal={handleGoalEdit}
          onDeleteGoal={handleGoalDelete}
        />

        {/* =========================================
            4.8 LOANS & FRIEND ADJUSTMENTS
           ========================================= */}
        <StaggeredView delay={500} direction="up">
          <LoansSection
            userId={userId}
            currSymbol={currSymbol}
            isStealthMode={isStealthMode}
            isLargeScreen={isLargeScreen}
            colors={c}
            theme={theme}
            loans={loans}
            loanMetrics={loanMetrics}
            expenses={expenses}
            setLoans={setLoans}
            setLoanMetrics={setLoanMetrics}
            showAlert={showAlert}
          />
        </StaggeredView>

        {/* =========================================
            5. BOUNDED TRANSACTIONS CONTAINER
           ========================================= */}
        <StaggeredView delay={520} direction="up">
          <DashboardLedger
            colors={c}
            theme={theme}
            currSymbol={currSymbol}
            isStealthMode={isStealthMode}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            datePreset={datePreset}
            onSelectDatePreset={setDatePreset}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            ledgerTab={ledgerTab}
            setLedgerTab={setLedgerTab}
            filteredExpensesCount={filteredExpenses.length}
            filteredIncomesCount={filteredIncomes.length}
            unifiedTransactions={unifiedTransactions}
            onSearch={handleSearch}
            searchQuery={searchQuery}
            sortOption={sortOption}
            setSortOption={setSortOption}
            onRowPress={onRowPress}
            onRowEdit={onRowEdit}
            onRowDelete={onRowDelete}
          />
        </StaggeredView>

        <View style={{ height: 40 }} />
      </ThemedScrollView>

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
