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
import { ThemedScrollbar } from '../../components/ThemedScrollbar';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { apiRequest, ApiError, checkServerHealth } from '../../services/api';
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

// The ledger FlatList sits in the page's ScrollView, but it has a fixed height and scrolls on its own, so its
// windowing works as intended. React Native still prints its generic nesting warning in development builds.
LogBox.ignoreLogs(['VirtualizedLists should never be nested inside plain ScrollViews']);

/** Stable key for the virtualised ledger. */
const ledgerKeyExtractor = (tx: UnifiedTxItem) => tx.uniqueKey;

/** The 8px gap between ledger rows (a FlatList has no `gap`). */
const LedgerSeparator = () => <View style={styles.ledgerSeparator} />;

interface TransactionRowProps {
  tx: UnifiedTxItem;
  colors: ThemeColors;
  currSymbol: string;
  isStealth?: boolean;
  onPress: (tx: UnifiedTxItem) => void;
  onEdit: (tx: UnifiedTxItem) => void;
  onDelete: (tx: UnifiedTxItem) => void;
}

/**
 * One ledger row. Memoised: it redraws only when its own transaction, the theme or the currency
 * changes, so typing in search, scrolling or unrelated state changes on the screen do not repaint
 * every row.
 */
function areRowPropsEqual(prev: TransactionRowProps, next: TransactionRowProps) {
  return (
    prev.tx.uniqueKey === next.tx.uniqueKey &&
    prev.tx.amount === next.tx.amount &&
    prev.tx.title === next.tx.title &&
    prev.tx.date === next.tx.date &&
    prev.tx.categoryOrSource === next.tx.categoryOrSource &&
    prev.tx.isRecurring === next.tx.isRecurring &&
    prev.currSymbol === next.currSymbol &&
    prev.isStealth === next.isStealth &&
    prev.colors === next.colors &&
    prev.onPress === next.onPress &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete
  );
}

const rowThemeStyles = {
  dark: StyleSheet.create({
    trough: { backgroundColor: "rgba(18, 20, 16, 0.95)", borderColor: Colors.dark.border },
    editAction: { backgroundColor: "#C79A3E" },
    deleteAction: { backgroundColor: "#991B1B" },
    card: { backgroundColor: Colors.dark.inputBg, borderColor: Colors.dark.border },
    descText: { color: Colors.dark.text },
    mutedText: { color: Colors.dark.textMuted },
    miniBtn: { backgroundColor: Colors.dark.card },
    amountText: { color: Colors.dark.text },
  }),
  light: StyleSheet.create({
    trough: { backgroundColor: "#EAEFF5", borderColor: Colors.light.border },
    editAction: { backgroundColor: "#D4AF37" },
    deleteAction: { backgroundColor: "#BE123C" },
    card: { backgroundColor: Colors.light.inputBg, borderColor: Colors.light.border },
    descText: { color: Colors.light.text },
    mutedText: { color: Colors.light.textMuted },
    miniBtn: { backgroundColor: Colors.light.card },
    amountText: { color: Colors.light.text },
  }),
};

const TransactionRow = React.memo(function TransactionRow({ tx, colors, currSymbol, isStealth, onPress, onEdit, onDelete }: TransactionRowProps) {
  const isIncome = tx.type === "income";
  const catColor = isIncome ? "#10B981" : getCategoryColor(tx.categoryOrSource || "General").color;
  // useRef(new X()) builds a throwaway X on every render; the lazy initialisers below build each one once.
  const [pan] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const isSwiping = useRef(false);

  const actionRefs = useRef({ tx, onEdit, onDelete });
  actionRefs.current = { tx, onEdit, onDelete };

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        isSwiping.current = true;
      },
      onPanResponderMove: (_, gesture) => {
        const clampedX = Math.max(-110, Math.min(110, gesture.dx));
        pan.setValue({ x: clampedX, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -70) {
          // Swiped left: Delete
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 50, useNativeDriver: true }).start(() => {
            isSwiping.current = false;
            actionRefs.current.onDelete(actionRefs.current.tx);
          });
        } else if (gesture.dx > 70) {
          // Swiped right: Edit
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 50, useNativeDriver: true }).start(() => {
            isSwiping.current = false;
            actionRefs.current.onEdit(actionRefs.current.tx);
          });
        } else {
          // Snap back
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 60, useNativeDriver: true }).start(() => {
            isSwiping.current = false;
          });
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 60, useNativeDriver: true }).start(() => {
          isSwiping.current = false;
        });
      },
    }),
  [pan]);

  const animatedNodes = useMemo(() => ({
    bgOpacity: pan.x.interpolate({
      inputRange: [-50, -10, 0, 10, 50],
      outputRange: [1, 0.2, 0, 0.2, 1],
      extrapolate: "clamp",
    }),
    deleteOpacity: pan.x.interpolate({
      inputRange: [-80, -25, 0],
      outputRange: [1, 0.4, 0],
      extrapolate: "clamp",
    }),
    deleteScale: pan.x.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.85],
      extrapolate: "clamp",
    }),
    editOpacity: pan.x.interpolate({
      inputRange: [0, 25, 80],
      outputRange: [0, 0.4, 1],
      extrapolate: "clamp",
    }),
    editScale: pan.x.interpolate({
      inputRange: [0, 80],
      outputRange: [0.85, 1],
      extrapolate: "clamp",
    }),
  }), [pan]);
  const { bgOpacity, deleteOpacity, deleteScale, editOpacity, editScale } = animatedNodes;

  const isLight = colors.bg === '#F8F9FA';
  const tStyles = isLight ? rowThemeStyles.light : rowThemeStyles.dark;
  const editColorHex = isLight ? '#0F172A' : '#10120E';
  const deleteColorHex = '#FFFFFF';

  return (
    <View style={styles.swipeRowWrapper}>
      <Animated.View style={[styles.swipeRowBg, tStyles.trough, { opacity: bgOpacity }]}>
        <Animated.View style={[styles.swipeActionLeft, tStyles.editAction, { opacity: editOpacity, transform: [{ scale: editScale }] }]}>
          <Ionicons name="pencil" size={14} color={editColorHex} />
          <Text style={[styles.swipeActionText, { color: editColorHex }]}>Edit</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeActionRight, tStyles.deleteAction, { opacity: deleteOpacity, transform: [{ scale: deleteScale }] }]}>
          <Text style={[styles.swipeActionText, { color: deleteColorHex }]}>Delete</Text>
          <Ionicons name="trash" size={14} color={deleteColorHex} />
        </Animated.View>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX: pan.x }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (!isSwiping.current) onPress(tx);
          }}
          onLongPress={() => onPress(tx)}
          style={[styles.txCard, tStyles.card]}
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
              <Text style={[styles.txDesc, tStyles.descText]} numberOfLines={1}>
                {tx.title}
              </Text>
              <View style={styles.txSubRow}>
                <Text style={[styles.txCatName, { color: catColor }]}>
                  {isIncome ? `Inflow: ${tx.categoryOrSource}` : tx.categoryOrSource}
                </Text>
                <Text style={[styles.txDot, tStyles.mutedText]}>•</Text>
                <Text style={[styles.txDate, tStyles.mutedText]}>{tx.date}</Text>
                {tx.isRecurring && (
                  <View style={[styles.recurringBadge, { backgroundColor: (isIncome ? "#10B981" : colors.primary) + "18" }]}>
                    <Ionicons name="repeat" size={10} color={isIncome ? "#10B981" : colors.primary} />
                    <Text style={[styles.recurringBadgeText, { color: isIncome ? "#10B981" : colors.primary }]}>
                      {isIncome ? "Recurring Inflow" : "Sub"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.txRight}>
            <Text style={[styles.txAmount, isIncome ? { color: "#10B981", fontWeight: "800" } : tStyles.amountText, { fontWeight: "800" }]}>
              {isStealth
                ? `${isIncome ? "+" : "-"}${currSymbol}••••••`
                : `${isIncome ? "+" : "-"}${currSymbol}${Number(tx.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            </Text>
            <View style={styles.txRowActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  onEdit(tx);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.txMiniActionBtn, tStyles.miniBtn]}
                accessibilityLabel="Edit transaction"
              >
                <Ionicons name="pencil" size={12} color={isIncome ? "#10B981" : colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  onDelete(tx);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.txMiniActionBtn, tStyles.miniBtn]}
                accessibilityLabel="Delete transaction"
              >
                <Ionicons name="trash-outline" size={12} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}, areRowPropsEqual);

/**
 * The ledger search box. It owns the text being typed, so typing and the clear button update at once;
 * the filtering of the list follows shortly after (and immediately on clear), without holding the
 * input back.
 */
const SearchField = React.memo(function SearchField({ onSearch, colors }: { onSearch: (query: string) => void; colors: ThemeColors }) {
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const change = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(value), 200);
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setText('');
    onSearch('');
  };

  return (
    <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder="Search description or category..."
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={change}
        returnKeyType="search"
      />
      {text.length > 0 && (
        <TouchableOpacity
          onPress={clear}
          onPressIn={clear}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
});

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
          setLedgerTab((curr) => (curr === "all" ? "expenses" : curr === "expenses" ? "incomes" : "incomes"));
        } else if (g.dx > 35) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setLedgerTab((curr) => (curr === "incomes" ? "expenses" : curr === "expenses" ? "all" : "all"));
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

      saveCache({
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

  // Keep the on-device bill, salary and savings reminders in step with the data on screen. Same
  // mechanism as the 1:30 PM and 8:30 PM reminders: scheduled on the phone, no server needed.
  useEffect(() => {
    if (isLoading) return;
    scheduleSmartReminders({ currency: currSymbol, subscriptions, incomes, goals: savingsGoals }).catch(() => {});
  }, [isLoading, subscriptions, incomes, savingsGoals, currSymbol]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Promise.all([
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
        ...(!isIncome && userId ? [
          {
            text: "Split / Link to Peer Loan",
            onPress: () => {
              showAlert(
                "Convert / Link to Peer Loan",
                `Convert "${tx.title}" (${currSymbol}${tx.amount}) into a friend loan / split record?`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Create Loan",
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
              fetchData(true);
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
  const ledgerScrollRef = useRef<ScrollView>(null);
  const ledgerScrollY = useRef(new Animated.Value(0)).current;
  const [ledgerContentHeight, setLedgerContentHeight] = useState(0);
  const [ledgerViewHeight, setLedgerViewHeight] = useState(0);
  const [ledgerDisplayLimit, setLedgerDisplayLimit] = useState(20);
  const onLedgerScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => ledgerScrollY.setValue(e.nativeEvent.contentOffset.y),
    [ledgerScrollY]
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

      <ScrollView
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
        <View style={styles.topBar}>
          <View style={styles.userCol}>
            <View style={[styles.avatarCircle, { backgroundColor: c.primary, borderColor: c.primary + '60' }]}>
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarLetter}>{(userName || 'U').charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.userGreetingCol}>
              <Text style={[styles.greetingSubtitle, { color: c.textMuted }]}>
                Welcome back 👋
              </Text>
              <Text
                style={[styles.greetingTitle, { color: c.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {userName || 'User'}
              </Text>
              <Text style={[styles.todayDate, { color: c.textMuted }]} numberOfLines={1}>
                {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          </View>

          <View style={styles.topBarRight}>
            {/* Export / Data Hub Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setExportModalVisible(true)}
              style={[
                styles.topActionBtn,
                {
                  backgroundColor: isLight ? '#FFFFFF' : c.card,
                  borderColor: isLight ? 'rgba(212, 175, 55, 0.45)' : c.border,
                  shadowColor: isLight ? 'transparent' : '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isLight ? 0 : 0.08,
                  shadowRadius: 4,
                  elevation: isLight ? 0 : 2,
                },
              ]}
              accessibilityLabel="Export Data"
            >
              <Ionicons name="share-outline" size={18} color={c.primary} />
            </TouchableOpacity>

            {/* Notification inbox with unread badge (isolated wrapper prevents container clipping) */}
            <View style={styles.bellBtnWrapper}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => router.push('/notifications' as any)}
                style={[
                  styles.topActionBtn,
                  {
                    backgroundColor: isLight ? '#FFFFFF' : c.card,
                    borderColor: isLight ? 'rgba(212, 175, 55, 0.45)' : c.border,
                    shadowColor: isLight ? 'transparent' : '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isLight ? 0 : 0.08,
                    shadowRadius: 4,
                    elevation: isLight ? 0 : 2,
                  },
                ]}
                accessibilityLabel={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
              >
                <Ionicons name="notifications-outline" size={18} color={c.primary} />
              </TouchableOpacity>
              {unreadNotifications > 0 && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.bellBadge,
                    {
                      borderColor: isLight ? '#FFFFFF' : (c.card || '#171A14'),
                    },
                  ]}
                >
                  <Text style={styles.bellBadgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
                </View>
              )}
            </View>

            {/* Privacy / Stealth Mode Toggle Button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                toggleStealthMode();
              }}
              style={({ pressed }) => [
                styles.topActionBtn,
                {
                  backgroundColor: isStealthMode
                    ? (isLight ? (pressed ? 'rgba(212, 175, 55, 0.28)' : 'rgba(212, 175, 55, 0.18)') : 'rgba(199, 154, 62, 0.22)')
                    : (isLight ? (pressed ? '#F1F5F9' : '#FFFFFF') : (pressed ? c.cardHover : c.card)),
                  borderColor: isStealthMode
                    ? (isLight ? '#B8860B' : c.primary)
                    : (isLight ? 'rgba(212, 175, 55, 0.45)' : c.border),
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Toggle Privacy Mode"
            >
              <Ionicons
                name={isStealthMode ? 'eye-off' : 'eye-outline'}
                size={19}
                color={
                  isStealthMode
                    ? (isLight ? '#B8860B' : c.primary)
                    : (isLight ? '#D4AF37' : c.primary)
                }
              />
            </Pressable>

            {/* Modern Instant-Feedback Theme Toggle Button */}
            <ThemeToggleBtn />
          </View>
        </View>

        {/* Offline / Cached Data Banner (only the Retry button is pressable) */}
        {(fetchError || partialError) && expenses.length > 0 && (
          <OfflineBanner
            message={
              fetchError
                ? `Offline mode${cachedTime ? ` · Cached at ${cachedTime}` : ''}`
                : "Some data couldn't be refreshed"
            }
            onRetry={() => fetchData(true)}
            retrying={refreshing}
          />
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
                  isStealth={isStealthMode}
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
                  isStealth={isStealthMode}
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

        {/* Safe-to-Spend & No-Spend Streak Highlights Bar */}
        <StaggeredView delay={70} direction="up">
          <View style={[styles.proMetricsRow, { gap: 10 }]}>
            {/* Safe-to-Spend Daily Allowance */}
            <View style={[styles.proMetricBadge, { backgroundColor: c.card, borderColor: safeDailySpend > 0 ? '#10B98150' : '#EF444450' }]}>
              <View style={[styles.proMetricIconCircle, { backgroundColor: safeDailySpend > 0 ? '#10B98120' : '#EF444420' }]}>
                <Ionicons name="shield-checkmark" size={13} color={safeDailySpend > 0 ? '#10B981' : '#EF4444'} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.proMetricLabel, { color: c.textMuted }]}>Safe to Spend</Text>
                <Text style={[styles.proMetricVal, { color: safeDailySpend > 0 ? '#10B981' : '#EF4444' }]} numberOfLines={1}>
                  {isStealthMode ? currSymbol + '••••••' : currSymbol + Math.round(safeDailySpend).toLocaleString('en-IN')}<Text style={{ fontSize: 10, color: c.textMuted }}> /day</Text>
                </Text>
              </View>
            </View>

            {/* No-Spend Streak */}
            <View style={[styles.proMetricBadge, { backgroundColor: c.card, borderColor: '#F59E0B50' }]}>
              <View style={[styles.proMetricIconCircle, { backgroundColor: '#F59E0B20' }]}>
                <Text style={{ fontSize: 12 }}>🔥</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.proMetricLabel, { color: c.textMuted }]}>No-Spend Streak</Text>
                <Text style={[styles.proMetricVal, { color: '#F59E0B' }]} numberOfLines={1}>
                  {noSpendStreak} <Text style={{ fontSize: 11, fontWeight: '600', color: c.textMuted }}>{'day' + (noSpendStreak === 1 ? '' : 's')}</Text>
                </Text>
              </View>
            </View>
          </View>
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
                isStealth={isStealthMode}
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
                isStealth={isStealthMode}
                prefix={currSymbol}
                decimals={0}
                style={[styles.matrixValue, { color: c.teal }]}
              />
              <Text style={[styles.matrixSub, { color: c.textMuted }]}>
                {currentMonthInflow > 0 ? (isStealthMode ? `In: +${currSymbol}•••••• · ` : `In: +${currSymbol}${Math.round(currentMonthInflow).toLocaleString('en-IN')} · `) : ''}Day {currentDay} of {daysInMonth}
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
                isStealth={isStealthMode}
                prefix={currSymbol}
                suffix="/d"
                decimals={0}
                style={[styles.matrixValue, { color: c.accent }]}
              />
              <Text style={[styles.matrixSub, { color: c.textMuted }]}>
                Proj: {isStealthMode ? `${currSymbol}••••••` : `${currSymbol}${Math.round(monthEndForecast).toLocaleString('en-IN')}`}
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
                {isStealthMode ? `${currSymbol}••••••` : `${currSymbol}${Math.round(highestCatAmt).toLocaleString('en-IN')}`} (
                {totalSpent > 0 ? ((highestCatAmt / totalSpent) * 100).toFixed(0) : 0}%)
              </Text>
            </AnimatedCard>
          </View>
        </StaggeredView>

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
                        {isStealthMode ? `${currSymbol}•••••• / ${currSymbol}••••••` : `${currSymbol}${Math.round(goal.currentAmount).toLocaleString("en-IN")} / ${currSymbol}${Math.round(goal.targetAmount).toLocaleString("en-IN")}`}
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
            <View style={[styles.streamTabsBar, { backgroundColor: c.inputBg, borderColor: c.border }]} {...streamTabsResponder.panHandlers}>
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
            <SearchField onSearch={handleSearch} colors={c} />

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
                <>
                  <ScrollView
                    ref={ledgerScrollRef}
                    style={styles.innerListScroll}
                    contentContainerStyle={styles.transactionsList}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={onLedgerScroll}
                    onContentSizeChange={onLedgerContentSize}
                    onLayout={onLedgerLayout}
                  >
                    {unifiedTransactions.slice(0, ledgerDisplayLimit).map((item, idx) => (
                      <React.Fragment key={item.uniqueKey}>
                        {idx > 0 && <LedgerSeparator />}
                        <TransactionRow
                          tx={item}
                          colors={c}
                          currSymbol={currSymbol}
                          isStealth={isStealthMode}
                          onPress={onRowPress}
                          onEdit={onRowEdit}
                          onDelete={onRowDelete}
                        />
                      </React.Fragment>
                    ))}
                    {unifiedTransactions.length > ledgerDisplayLimit && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setLedgerDisplayLimit((prev) => prev + 20)}
                        style={[styles.loadMoreRowBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
                      >
                        <Text style={[styles.loadMoreRowText, { color: c.primary }]}>
                          Load More ({unifiedTransactions.length - ledgerDisplayLimit} remaining)
                        </Text>
                        <Ionicons name="chevron-down" size={14} color={c.primary} />
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                  <ThemedScrollbar
                    scrollY={ledgerScrollY}
                    contentHeight={ledgerContentHeight}
                    viewHeight={ledgerViewHeight}
                    trackColor={c.scrollTrack}
                    thumbColor={c.scrollThumb}
                  />
                </>
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
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  avatarLetter: {
    color: '#10120E',
    fontSize: 18,
    fontWeight: '900',
  },
  greetingSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginBottom: 1,
  },
  greetingTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 22,
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
  bellBtnWrapper: {
    position: 'relative',
    overflow: 'visible',
    width: 40,
    height: 40,
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
    elevation: 6,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
    includeFontPadding: false,
  },
  topActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
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
  proMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  proMetricBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  proMetricIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  proMetricVal: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
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
    paddingBottom: 4,
  },
  loadMoreRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  loadMoreRowText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ledgerSeparator: {
    height: 8,
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
  swipeRowWrapper: {
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
  },
  swipeRowBg: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  swipeActionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  swipeActionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  swipeActionText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});