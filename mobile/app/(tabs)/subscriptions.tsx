import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  TextInput,
  Modal,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { apiRequest, ApiError } from '../../services/api';
import { getCurrencySymbol } from '../../services/currency';
import { Colors, getCategoryColor, getCategoryEmoji } from '../../constants/theme';
import { AmbientAura } from '../../components/AmbientAura';
import { StaggeredView } from '../../components/StaggeredView';
import { NumberTicker } from '../../components/NumberTicker';
import { EditSubscriptionModal } from '../../components/EditSubscriptionModal';

interface Subscription {
  id: number;
  description: string;
  amount: number;
  nextDueDate: string;
  frequency: string;
  categoryId: number;
  categoryName?: string;
  intervalDays?: number;
}

interface Category {
  id: number;
  name: string;
}

interface RecurringIncome {
  id: number;
  source: string;
  amount: number;
  frequency: string;
  intervalDays?: number;
  nextDueDate?: string;
  incomeDate?: string;
  description?: string;
  isRecurring?: boolean;
}

interface RecurringSavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  recurringAmount: number;
  frequency: string;
  intervalDays?: number;
  nextDueDate?: string;
  targetDate?: string;
  status: string;
  progressPercentage?: number;
  isRecurring?: boolean;
}

/**
 * Calculates calendar days remaining until the target due date.
 */
function getDaysUntil(dateStr?: string): number {
  if (!dateStr) return 999;
  try {
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

/**
 * Normalizes any frequency string to an approximate monthly run-rate.
 */
function toMonthlyRate(amt: number, frequency?: string, intervalDays?: number): number {
  const safeAmt = Math.max(0, Number(amt || 0));
  const freq = (frequency || 'MONTHLY').toUpperCase();
  if (freq === 'DAILY') return safeAmt * 30;
  if (freq === 'WEEKLY') return safeAmt * 4.33;
  if (freq === 'BI_WEEKLY' || freq === 'BIWEEKLY') return safeAmt * 2.16;
  if (freq === 'YEARLY') return safeAmt / 12;
  if (freq === 'CUSTOM' && intervalDays && intervalDays > 0) return (safeAmt / intervalDays) * 30;
  return safeAmt;
}

/**
 * Subscriptions & Recurring commitments management screen.
 * Unifies Recurring Subscriptions (Expenses), Recurring Incomes (Inflows),
 * and Recurring Chit Funds / Deposits (Savings) into one comprehensive view.
 */
export default function SubscriptionsScreen() {
  const { userId, theme, currency } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currSym = getCurrencySymbol(currency);
  const c = Colors[theme];
  const isLight = theme === 'light';

  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 700;
  const isDesktopOrTV = width >= 1024;

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
  const [recurringSavings, setRecurringSavings] = useState<RecurringSavingsGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Active commitment category filter
  const [activeTab, setActiveTab] = useState<'all' | 'expenses' | 'incomes' | 'savings'>('all');

  // Quick Deposit modal for Chit / Savings
  const [depositModalGoal, setDepositModalGoal] = useState<RecurringSavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);

  /**
   * Fetches recurring subscriptions, recurring incomes, and recurring savings goals.
   */
  const fetchAllRecurringData = async () => {
    if (!userId) return;
    try {
      const [subsData, globalCats, userCats, incomesData, savingsData] = await Promise.all([
        apiRequest(`/expenses/recurring/user/${userId}`).catch(() => []),
        apiRequest(`/categories/global`).catch(() => []),
        apiRequest(`/categories/user/${userId}`).catch(() => []),
        apiRequest(`/incomes/user/${userId}`).catch(() => []),
        apiRequest(`/savings/goals/user/${userId}`).catch(() => []),
      ]);

      setSubscriptions(Array.isArray(subsData) ? subsData : []);

      // Filter only recurring incomes
      const allIncomes = Array.isArray(incomesData) ? incomesData : [];
      const recIncomes: RecurringIncome[] = allIncomes.filter(
        (i: any) => i.isRecurring === true || i.recurring === true
      );
      setRecurringIncomes(recIncomes);

      // Filter only recurring savings (chits, recurring deposits, SIPs)
      const allSavings = Array.isArray(savingsData) ? savingsData : [];
      const recSavings: RecurringSavingsGoal[] = allSavings.filter(
        (s: any) =>
          s.isRecurring === true ||
          s.recurring === true ||
          (s.recurringAmount != null && Number(s.recurringAmount) > 0)
      );
      setRecurringSavings(recSavings);

      // Merge categories
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
      setFetchError(null);
    } catch (e: any) {
      console.warn('[SubscriptionsScreen] Failed to load recurring commitments:', e);
      const isApiErr = e instanceof ApiError;
      setFetchError(isApiErr ? e.message : 'Could not synchronize recurring commitments.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAllRecurringData();
    }, [userId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fetchAllRecurringData();
  };

  /**
   * Deletes a recurring subscription.
   */
  const handleDeleteSubscription = (sub: Subscription) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    showAlert(
      'Cancel Subscription?',
      `Are you sure you want to stop tracking "${sub.description}"? Past transactions won't be deleted.`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Cancel Plan',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/expenses/recurring/${sub.id}`, {
                method: 'DELETE',
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id));
            } catch (e: any) {
              const msg = e instanceof ApiError ? e.message : 'Could not delete subscription.';
              showAlert('Cancellation Error', msg);
            }
          },
        },
      ]
    );
  };

  /**
   * Deletes a recurring income stream.
   */
  const handleDeleteIncome = (inc: RecurringIncome) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    showAlert(
      "Delete Recurring Income?",
      `Are you sure you want to remove recurring income "${inc.source}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Inflow",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/incomes/${inc.id}/user/${userId}`, {
                method: "DELETE",
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setRecurringIncomes((prev) => prev.filter((i) => i.id !== inc.id));
              showAlert("Deleted", "Recurring income stream removed successfully.", undefined, "success");
            } catch (e: any) {
              const msg = e instanceof ApiError ? e.message : "Could not delete income stream.";
              showAlert("Delete Error", msg, undefined, "error");
            }
          },
        },
      ],
      "destructive"
    );
  };

  /**
   * Opens the edit form for a recurring income stream.
   */
  const handleEditIncome = (inc: RecurringIncome) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: "/(tabs)/add-expense",
      params: {
        editType: "income",
        editId: String(inc.id),
        editSource: inc.source,
        editAmount: String(inc.amount),
        editDate: inc.incomeDate || new Date().toISOString().split("T")[0],
        editDescription: inc.description || "",
        editIsRecurring: "true",
        editFrequency: inc.frequency || "MONTHLY",
        editIntervalDays: String(inc.intervalDays || "1"),
      },
    });
  };

  /**
   * Deletes a recurring chit plan or savings goal.
   */
  const handleDeleteSavingsGoal = (goal: RecurringSavingsGoal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    showAlert(
      "Delete Chit / Savings Plan?",
      `Are you sure you want to remove "${goal.name}"? Accumulated progress will be cleared.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Plan",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/savings/goals/${goal.id}/user/${userId}`, {
                method: "DELETE",
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setRecurringSavings((prev) => prev.filter((g) => g.id !== goal.id));
              showAlert("Deleted", "Chit / savings plan removed successfully.", undefined, "success");
            } catch (e: any) {
              const msg = e instanceof ApiError ? e.message : "Could not delete savings goal.";
              showAlert("Delete Error", msg, undefined, "error");
            }
          },
        },
      ],
      "destructive"
    );
  };

  /**
   * Opens the edit form for a recurring chit / savings plan.
   */
  const handleEditSavingsGoal = (goal: RecurringSavingsGoal) => {
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
        editIsRecurring: String(goal.isRecurring !== false),
        editRecurringAmount: String(goal.recurringAmount || ""),
        editFrequency: goal.frequency || "MONTHLY",
        editIntervalDays: String(goal.intervalDays || "30"),
      },
    });
  };


  /**
   * Quick deposit towards a Chit Fund or Recurring Savings Goal.
   */
  const handleQuickDeposit = async () => {
    if (!depositModalGoal || !depositAmount.trim()) return;
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid positive installment amount.');
      return;
    }

    setIsDepositing(true);
    try {
      await apiRequest(`/savings/goals/${depositModalGoal.id}/deposit/user/${userId}?amount=${amt}`, {
        method: 'POST',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('Installment Deposited', `Successfully contributed ${currSym}${amt.toLocaleString()} to ${depositModalGoal.name}.`);
      setDepositModalGoal(null);
      setDepositAmount('');
      fetchAllRecurringData();
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : 'Could not record installment deposit.';
      showAlert('Deposit Failed', msg);
    } finally {
      setIsDepositing(false);
    }
  };

  // Run-rate calculations
  const monthlyExpenseTotal = subscriptions.reduce(
    (sum, s) => sum + toMonthlyRate(s.amount, s.frequency, s.intervalDays),
    0
  );

  const monthlyIncomeTotal = recurringIncomes.reduce(
    (sum, i) => sum + toMonthlyRate(i.amount, i.frequency, i.intervalDays),
    0
  );

  const monthlySavingsTotal = recurringSavings.reduce(
    (sum, s) => sum + toMonthlyRate(s.recurringAmount, s.frequency, s.intervalDays),
    0
  );

  const netRecurringFlow = monthlyIncomeTotal - (monthlyExpenseTotal + monthlySavingsTotal);
  const totalCommitmentCount = subscriptions.length + recurringIncomes.length + recurringSavings.length;

  if (isLoading && !refreshing && totalCommitmentCount === 0) {
    return (
      <View style={[styles.loadingBox, { backgroundColor: c.bg }]}>
        <AmbientAura />
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  // Offline Error State
  if (!isLoading && fetchError && totalCommitmentCount === 0) {
    return (
      <View style={[styles.errorWrapper, { backgroundColor: c.bg }]}>
        <AmbientAura />
        <View style={styles.errorCard}>
          <View style={[styles.errorIconBox, { backgroundColor: c.accent + '20' }]}>
            <Ionicons name="cloud-offline-outline" size={38} color={c.accent} />
          </View>
          <Text style={[styles.errorTitle, { color: c.text }]}>Unable to Load Commitments</Text>
          <Text style={[styles.errorDesc, { color: c.textMuted }]}>{fetchError}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setIsLoading(true);
              fetchAllRecurringData();
            }}
            style={[styles.retryBtn, { backgroundColor: c.primary }]}
          >
            <Ionicons name="refresh" size={18} color="#10120E" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const showExpenses = activeTab === 'all' || activeTab === 'expenses';
  const showIncomes = activeTab === 'all' || activeTab === 'incomes';
  const showSavings = activeTab === 'all' || activeTab === 'savings';

  return (
    <View style={[styles.screenWrapper, { backgroundColor: c.bg }]}>
      <AmbientAura />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 10, 48),
            maxWidth: 1100,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: isDesktopOrTV ? 36 : (isLargeScreen ? 24 : 16),
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.pageTitle, { color: c.text }]}>Subscriptions & Recurring</Text>
            <Text style={[styles.pageSubtitle, { color: c.textMuted }]}>
              {totalCommitmentCount} active recurring commitment{totalCommitmentCount === 1 ? '' : 's'}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/(tabs)/add-expense', params: { editId: '', editType: '' } })}
            style={[styles.addBtn, { backgroundColor: c.primary }]}
            accessibilityLabel="Add Commitment"
          >
            <Ionicons name="add" size={20} color={isLight ? '#FFF' : '#10120E'} />
            <Text style={[styles.addBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Tri-Domain Recurring Run-Rate Banner */}
        <StaggeredView delay={80} direction="up">
          <View style={styles.kpiGrid}>
            {/* Recurring Inflow Stream */}
            <View style={[styles.kpiCard, { backgroundColor: c.card, borderColor: '#10B98135' }]}>
              <View style={styles.kpiHeader}>
                <Text style={[styles.kpiLabel, { color: c.textMuted }]}>Recurring Inflow</Text>
                <View style={[styles.kpiBadge, { backgroundColor: '#10B98118' }]}>
                  <Ionicons name="arrow-down-outline" size={13} color="#10B981" />
                </View>
              </View>
              <NumberTicker
                value={monthlyIncomeTotal}
                prefix={'+' + currSym}
                decimals={0}
                style={[styles.kpiValue, { color: '#10B981' }]}
              />
              <Text style={[styles.kpiSub, { color: c.textMuted }]}>Guaranteed / mo</Text>
            </View>

            {/* Subscriptions Outflow */}
            <View style={[styles.kpiCard, { backgroundColor: c.card, borderColor: c.primary + '35' }]}>
              <View style={styles.kpiHeader}>
                <Text style={[styles.kpiLabel, { color: c.textMuted }]}>Subscriptions</Text>
                <View style={[styles.kpiBadge, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name="repeat" size={13} color={c.primary} />
                </View>
              </View>
              <NumberTicker
                value={monthlyExpenseTotal}
                prefix={'-' + currSym}
                decimals={0}
                style={[styles.kpiValue, { color: c.accent || '#EF4444' }]}
              />
              <Text style={[styles.kpiSub, { color: c.textMuted }]}>Fixed Outflow / mo</Text>
            </View>

            {/* Chits & Savings Installments */}
            <View style={[styles.kpiCard, { backgroundColor: c.card, borderColor: '#F59E0B35' }]}>
              <View style={styles.kpiHeader}>
                <Text style={[styles.kpiLabel, { color: c.textMuted }]}>Chits & RDs</Text>
                <View style={[styles.kpiBadge, { backgroundColor: '#F59E0B18' }]}>
                  <Ionicons name="shield-checkmark-outline" size={13} color="#F59E0B" />
                </View>
              </View>
              <NumberTicker
                value={monthlySavingsTotal}
                prefix={currSym}
                decimals={0}
                style={[styles.kpiValue, { color: '#F59E0B' }]}
              />
              <Text style={[styles.kpiSub, { color: c.textMuted }]}>Committed Savings / mo</Text>
            </View>

            {/* Net Recurring Autonomy */}
            <View style={[styles.kpiCard, { backgroundColor: c.card, borderColor: (netRecurringFlow >= 0 ? '#10B981' : '#EF4444') + '35' }]}>
              <View style={styles.kpiHeader}>
                <Text style={[styles.kpiLabel, { color: c.textMuted }]}>Net Free Flow</Text>
                <View style={[styles.kpiBadge, { backgroundColor: (netRecurringFlow >= 0 ? '#10B981' : '#EF4444') + '18' }]}>
                  <Ionicons name="wallet-outline" size={13} color={netRecurringFlow >= 0 ? '#10B981' : '#EF4444'} />
                </View>
              </View>
              <NumberTicker
                value={Math.abs(netRecurringFlow)}
                prefix={(netRecurringFlow >= 0 ? '+' : '-') + currSym}
                decimals={0}
                style={[styles.kpiValue, { color: netRecurringFlow >= 0 ? '#10B981' : '#EF4444' }]}
              />
              <Text style={[styles.kpiSub, { color: c.textMuted }]}>Inflows - Outflows - Chits</Text>
            </View>
          </View>
        </StaggeredView>

        {/* Filter Segment Tabs */}
        <View style={[styles.filterBar, { backgroundColor: c.card, borderColor: c.border }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setActiveTab('all');
            }}
            style={[styles.filterTab, activeTab === 'all' && { backgroundColor: c.primary }]}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: activeTab === 'all' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted },
              ]}
            >
              All ({totalCommitmentCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setActiveTab('expenses');
            }}
            style={[styles.filterTab, activeTab === 'expenses' && { backgroundColor: c.primary }]}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: activeTab === 'expenses' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted },
              ]}
            >
              Subs ({subscriptions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setActiveTab('incomes');
            }}
            style={[styles.filterTab, activeTab === 'incomes' && { backgroundColor: c.primary }]}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: activeTab === 'incomes' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted },
              ]}
            >
              Inflows ({recurringIncomes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setActiveTab('savings');
            }}
            style={[styles.filterTab, activeTab === 'savings' && { backgroundColor: c.primary }]}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: activeTab === 'savings' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted },
              ]}
            >
              Chits & RDs ({recurringSavings.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Zero State if nothing matches current filter */}
        {totalCommitmentCount === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: c.primary + '15' }]}>
              <Ionicons name="sparkles" size={32} color={c.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Zero Active Commitments</Text>
            <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
              Track salary paychecks, chit fund installments, recurring deposits, and subscriptions all in one place.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/(tabs)/add-expense', params: { editId: '', editType: '' } })}
              style={[styles.emptyActionBtn, { backgroundColor: c.primary }]}
            >
              <Ionicons name="add" size={18} color={isLight ? '#FFF' : '#10120E'} />
              <Text style={[styles.emptyActionBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>
                Add New Commitment
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* =========================================
            SECTION: RECURRING INCOMES (INFLOWS)
            ========================================= */}
        {showIncomes && recurringIncomes.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionBadgeWrap}>
                <Ionicons name="arrow-down-circle" size={16} color="#10B981" />
                <Text style={[styles.sectionTitle, { color: c.text }]}>Recurring Inflow Streams</Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: '#10B981' }]}>
                +{currSym}{monthlyIncomeTotal.toLocaleString()}/mo
              </Text>
            </View>

            {recurringIncomes.map((inc) => {
              const days = getDaysUntil(inc.nextDueDate);
              const isToday = days === 0;
              return (
                <View
                  key={`inc-${inc.id}`}
                  style={[
                    styles.subCard,
                    {
                      backgroundColor: c.card,
                      borderColor: isToday ? '#10B981' : c.border,
                    },
                  ]}
                >
                  <View style={styles.subTopRow}>
                    <View style={styles.subLeft}>
                      <View style={[styles.catIconWrap, { backgroundColor: '#10B98118' }]}>
                        <Ionicons name="cash-outline" size={18} color="#10B981" />
                      </View>
                      <View style={styles.subMeta}>
                        <Text style={[styles.subTitle, { color: c.text }]}>{inc.source}</Text>
                        <View style={styles.subSubRow}>
                          <Text style={[styles.subCatText, { color: '#10B981' }]}>Income Stream</Text>
                          <Text style={[styles.dotText, { color: c.textMuted }]}>•</Text>
                          <Text style={[styles.subFreqText, { color: c.textMuted }]}>
                            {inc.frequency || 'MONTHLY'}
                            {inc.frequency === 'CUSTOM' && inc.intervalDays ? ` (${inc.intervalDays}d)` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.subRight}>
                      <Text style={[styles.subAmtText, { color: '#10B981', fontWeight: '800' }]}>
                        +{currSym}
                        {Number(inc.amount || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.subBottomRow, { borderTopColor: c.border }]}>
                    <View style={[styles.dueBadge, { backgroundColor: '#10B98115' }]}>
                      <Ionicons name="calendar-outline" size={12} color="#10B981" />
                      <Text style={[styles.dueBadgeText, { color: '#10B981' }]}>
                        {days === 999
                          ? 'Automated Schedule'
                          : isToday
                          ? 'Expected Today!'
                          : days < 0
                          ? `Processed ${Math.abs(days)}d ago`
                          : `Next Deposit: in ${days} days`}
                      </Text>
                    </View>
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleEditIncome(inc)}
                        style={[styles.iconActionBtn, { backgroundColor: c.inputBg }]}
                        accessibilityLabel="Edit recurring income"
                      >
                        <Ionicons name="pencil" size={14} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDeleteIncome(inc)}
                        style={[styles.iconActionBtn, { backgroundColor: c.inputBg }]}
                        accessibilityLabel="Delete recurring income"
                      >
                        <Ionicons name="trash-outline" size={14} color={c.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* =========================================
            SECTION: RECURRING CHITS & SAVINGS GOALS
            ========================================= */}
        {showSavings && recurringSavings.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionBadgeWrap}>
                <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
                <Text style={[styles.sectionTitle, { color: c.text }]}>Chits & Recurring Deposits</Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: '#F59E0B' }]}>
                {currSym}{monthlySavingsTotal.toLocaleString()}/mo
              </Text>
            </View>

            {recurringSavings.map((goal) => {
              const days = getDaysUntil(goal.nextDueDate);
              const isUrgent = days <= 3 && days >= 0;
              const isOverdue = days < 0;
              const target = Number(goal.targetAmount || 0);
              const current = Number(goal.currentAmount || 0);
              const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

              return (
                <View
                  key={`sav-${goal.id}`}
                  style={[
                    styles.subCard,
                    {
                      backgroundColor: c.card,
                      borderColor: isUrgent ? '#F59E0B' : isOverdue ? c.warning : c.border,
                    },
                  ]}
                >
                  <View style={styles.subTopRow}>
                    <View style={styles.subLeft}>
                      <View style={[styles.catIconWrap, { backgroundColor: '#F59E0B18' }]}>
                        <Ionicons name="file-tray-full-outline" size={18} color="#F59E0B" />
                      </View>
                      <View style={styles.subMeta}>
                        <Text style={[styles.subTitle, { color: c.text }]}>{goal.name}</Text>
                        <View style={styles.subSubRow}>
                          <Text style={[styles.subCatText, { color: '#F59E0B' }]}>Chit / RD Plan</Text>
                          <Text style={[styles.dotText, { color: c.textMuted }]}>•</Text>
                          <Text style={[styles.subFreqText, { color: c.textMuted }]}>
                            {goal.frequency === 'CUSTOM' && goal.intervalDays ? `Every ${goal.intervalDays}d` : (goal.frequency || 'MONTHLY')}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.subRight}>
                      <Text style={[styles.subAmtText, { color: '#F59E0B', fontWeight: '800' }]}>
                        {currSym}
                        {Number(goal.recurringAmount || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                        <Text style={{ fontSize: 11, fontWeight: '500', color: c.textMuted }}> / cycle</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.goalProgressWrap}>
                    <View style={styles.goalProgressRow}>
                      <Text style={[styles.progressValText, { color: c.textMuted }]}>
                        Accumulated: {currSym}{current.toLocaleString()} of {currSym}{target.toLocaleString()}
                      </Text>
                      <Text style={[styles.progressPctText, { color: '#F59E0B' }]}>{pct}%</Text>
                    </View>
                    <View style={[styles.progressBarTrack, { backgroundColor: c.inputBg }]}>
                      <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: '#F59E0B' }]} />
                    </View>
                  </View>

                  <View style={[styles.subBottomRow, { borderTopColor: c.border }]}>
                    <View
                      style={[
                        styles.dueBadge,
                        {
                          backgroundColor: isUrgent
                            ? '#F59E0B20'
                            : isOverdue
                            ? c.warning + '20'
                            : c.inputBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isUrgent ? 'flame' : 'alarm-outline'}
                        size={12}
                        color={isUrgent ? '#F59E0B' : isOverdue ? c.warning : c.textMuted}
                      />
                      <Text
                        style={[
                          styles.dueBadgeText,
                          {
                            color: isUrgent ? '#F59E0B' : isOverdue ? c.warning : c.textMuted,
                          },
                        ]}
                      >
                        {days === 999
                          ? 'Cycle Active'
                          : isOverdue
                          ? `Due by ${Math.abs(days)}d`
                          : days === 0
                          ? 'Installment Due Today!'
                          : `Due in ${days} days`}
                      </Text>
                    </View>

                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleEditSavingsGoal(goal)}
                        style={[styles.iconActionBtn, { backgroundColor: c.inputBg }]}
                        accessibilityLabel="Edit chit plan"
                      >
                        <Ionicons name="pencil" size={14} color="#F59E0B" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDeleteSavingsGoal(goal)}
                        style={[styles.iconActionBtn, { backgroundColor: c.inputBg }]}
                        accessibilityLabel="Delete chit plan"
                      >
                        <Ionicons name="trash-outline" size={14} color={c.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setDepositModalGoal(goal);
                          setDepositAmount(String(goal.recurringAmount || ''));
                        }}
                        style={[styles.depositBtn, { backgroundColor: '#F59E0B' }]}
                      >
                        <Ionicons name="add-circle-outline" size={13} color="#FFF" />
                        <Text style={styles.depositBtnText}>Deposit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* =========================================
            SECTION: EXPENSE SUBSCRIPTIONS (OUTFLOWS)
            ========================================= */}
        {showExpenses && subscriptions.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionBadgeWrap}>
                <Ionicons name="repeat" size={16} color={c.primary} />
                <Text style={[styles.sectionTitle, { color: c.text }]}>Subscription Outflows</Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: c.primary }]}>
                -{currSym}{monthlyExpenseTotal.toLocaleString()}/mo
              </Text>
            </View>

            {subscriptions.map((sub) => {
              const days = getDaysUntil(sub.nextDueDate);
              const isUrgent = days <= 3 && days >= 0;
              const isOverdue = days < 0;
              const catColor = getCategoryColor(sub.categoryName || '').color;

              return (
                <View
                  key={`sub-${sub.id}`}
                  style={[
                    styles.subCard,
                    {
                      backgroundColor: c.card,
                      borderColor: isUrgent ? c.accent : isOverdue ? c.warning : c.border,
                    },
                  ]}
                >
                  <View style={styles.subTopRow}>
                    <View style={styles.subLeft}>
                      <View style={[styles.catIconWrap, { backgroundColor: catColor + '18' }]}>
                        <Text style={styles.catEmojiText}>
                          {getCategoryEmoji(sub.categoryName || 'General')}
                        </Text>
                      </View>
                      <View style={styles.subMeta}>
                        <Text style={[styles.subTitle, { color: c.text }]}>{sub.description}</Text>
                        <View style={styles.subSubRow}>
                          <Text style={[styles.subCatText, { color: catColor }]}>
                            {sub.categoryName || 'General'}
                          </Text>
                          <Text style={[styles.dotText, { color: c.textMuted }]}>•</Text>
                          <Text style={[styles.subFreqText, { color: c.textMuted }]}>
                            {sub.frequency}
                            {sub.frequency === 'CUSTOM' && sub.intervalDays ? ` (${sub.intervalDays}d)` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.subRight}>
                      <Text style={[styles.subAmtText, { color: c.text }]}>
                        {currSym}
                        {Number(sub.amount || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* Bottom Status Row & Actions */}
                  <View style={[styles.subBottomRow, { borderTopColor: c.border }]}>
                    <View
                      style={[
                        styles.dueBadge,
                        {
                          backgroundColor: isUrgent
                            ? c.accent + '20'
                            : isOverdue
                            ? c.warning + '20'
                            : c.inputBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isUrgent ? 'flame' : 'alarm-outline'}
                        size={12}
                        color={isUrgent ? c.accent : isOverdue ? c.warning : c.textMuted}
                      />
                      <Text
                        style={[
                          styles.dueBadgeText,
                          {
                            color: isUrgent ? c.accent : isOverdue ? c.warning : c.textMuted,
                          },
                        ]}
                      >
                        {isOverdue
                          ? `Overdue by ${Math.abs(days)}d`
                          : days === 0
                          ? 'Due Today!'
                          : `Due in ${days} days`}
                      </Text>
                    </View>

                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setEditingSub(sub)}
                        style={[styles.iconActionBtn, { backgroundColor: c.inputBg }]}
                      >
                        <Ionicons name="pencil" size={14} color={c.primary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDeleteSubscription(sub)}
                        style={[styles.iconActionBtn, { backgroundColor: c.inputBg }]}
                      >
                        <Ionicons name="trash-outline" size={14} color={c.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Quick Deposit Modal for Chit / Savings */}
      <Modal
        visible={!!depositModalGoal}
        transparent
        animationType="fade"
        onRequestClose={() => setDepositModalGoal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.text }]}>Record Chit / RD Installment</Text>
              <TouchableOpacity onPress={() => setDepositModalGoal(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: c.textMuted }]}>
              Contributing to <Text style={{ fontWeight: '700', color: c.text }}>{depositModalGoal?.name}</Text>
            </Text>

            <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <Text style={[styles.inputPrefix, { color: c.textMuted }]}>{currSym}</Text>
              <TextInput
                style={[styles.textInput, { color: c.text }]}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={c.textMuted}
                value={depositAmount}
                onChangeText={setDepositAmount}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: c.border }]}
                onPress={() => setDepositModalGoal(null)}
              >
                <Text style={[styles.modalCancelText, { color: c.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#F59E0B' }]}
                onPress={handleQuickDeposit}
                disabled={isDepositing}
              >
                {isDepositing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Deposit Installment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Subscription Modal */}
      <EditSubscriptionModal
        visible={!!editingSub}
        subscription={editingSub}
        categories={categories}
        onClose={() => setEditingSub(null)}
        onUpdated={() => fetchAllRecurringData()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    padding: 24,
  },
  errorIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10120E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleWrap: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  kpiSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  filterBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  subCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  subTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  catIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catEmojiText: {
    fontSize: 20,
  },
  subMeta: {
    flex: 1,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  subSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subCatText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotText: {
    fontSize: 12,
  },
  subFreqText: {
    fontSize: 12,
  },
  subRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  subAmtText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  goalProgressWrap: {
    marginTop: 10,
    marginBottom: 4,
  },
  goalProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressValText: {
    fontSize: 11,
  },
  progressPctText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  subBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 10,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  depositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  depositBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginVertical: 20,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 320,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
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
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSub: {
    fontSize: 13,
    marginBottom: 16,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  inputPrefix: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    padding: 0,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
