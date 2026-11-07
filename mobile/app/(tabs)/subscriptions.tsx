import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { ThemedText as Text } from '../../components/ThemedText';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { apiRequest, ApiError } from '../../services/api';
import { getCurrencySymbol } from '../../services/currency';
import { Colors } from '../../constants/theme';
import { AmbientAura } from '../../components/AmbientAura';
import { EditSubscriptionModal } from '../../components/EditSubscriptionModal';
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ImmersiveLoader } from '../../components/ImmersiveLoader';
import { ThemedScrollView } from '../../components/ThemedScrollbar';

import {
  Subscription,
  RecurringIncome,
  RecurringSavingsGoal,
  Category,
  SubscriptionFilterTab,
  toMonthlyRate,
} from '../../components/subscriptions/subscriptionsTypes';
import { SubscriptionsKpiCards } from '../../components/subscriptions/SubscriptionsKpiCards';
import { SubscriptionsSegmentFilter } from '../../components/subscriptions/SubscriptionsSegmentFilter';
import { RecurringItemCard } from '../../components/subscriptions/RecurringItemCard';
import { QuickDepositModal } from '../../components/subscriptions/QuickDepositModal';

/**
 * Subscriptions & Recurring commitments management screen.
 * Unifies Recurring Subscriptions (Expenses), Recurring Incomes (Inflows),
 * and Recurring Chit Funds / Deposits (Savings) into one comprehensive view.
 */
export default function SubscriptionsScreen() {
  const { userId, theme, currency, isStealthMode, themeColors } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currSym = getCurrencySymbol(currency);
  const c = themeColors || Colors[theme];

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
  const [activeTab, setActiveTab] = useState<SubscriptionFilterTab>('all');

  // Quick Deposit modal target for Chit / Savings
  const [depositModalGoal, setDepositModalGoal] = useState<RecurringSavingsGoal | null>(null);

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
      void fetchAllRecurringData();
    }, [userId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void fetchAllRecurringData();
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
      'Delete Recurring Income?',
      `Are you sure you want to remove recurring income "${inc.source}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Inflow',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/incomes/${inc.id}/user/${userId}`, {
                method: 'DELETE',
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setRecurringIncomes((prev) => prev.filter((i) => i.id !== inc.id));
              showAlert('Deleted', 'Recurring income stream removed successfully.', undefined, 'success');
            } catch (e: any) {
              const msg = e instanceof ApiError ? e.message : 'Could not delete income stream.';
              showAlert('Delete Error', msg, undefined, 'error');
            }
          },
        },
      ],
      'destructive'
    );
  };

  /**
   * Opens the edit form for a recurring income stream.
   */
  const handleEditIncome = (inc: RecurringIncome) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: '/(tabs)/add-expense',
      params: {
        editType: 'income',
        editId: String(inc.id),
        editSource: inc.source,
        editAmount: String(inc.amount),
        editDate: inc.incomeDate || new Date().toISOString().split('T')[0],
        editDescription: inc.description || '',
        editIsRecurring: 'true',
        editFrequency: inc.frequency || 'MONTHLY',
        editIntervalDays: String(inc.intervalDays || '1'),
      },
    });
  };

  /**
   * Deletes a recurring chit plan or savings goal.
   */
  const handleDeleteSavingsGoal = (goal: RecurringSavingsGoal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    showAlert(
      'Delete Chit / Savings Plan?',
      `Are you sure you want to remove "${goal.name}"? Accumulated progress will be cleared.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Plan',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/savings/goals/${goal.id}/user/${userId}`, {
                method: 'DELETE',
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setRecurringSavings((prev) => prev.filter((g) => g.id !== goal.id));
              showAlert('Deleted', 'Chit / savings plan removed successfully.', undefined, 'success');
            } catch (e: any) {
              const msg = e instanceof ApiError ? e.message : 'Could not delete savings goal.';
              showAlert('Delete Error', msg, undefined, 'error');
            }
          },
        },
      ],
      'destructive'
    );
  };

  /**
   * Opens the edit form for a recurring chit / savings plan.
   */
  const handleEditSavingsGoal = (goal: RecurringSavingsGoal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: '/(tabs)/add-expense',
      params: {
        editType: 'savings',
        editId: String(goal.id),
        editName: goal.name,
        editTargetAmount: String(goal.targetAmount),
        editCurrentAmount: String(goal.currentAmount),
        editTargetDate: goal.targetDate || '',
        editIsRecurring: String(goal.isRecurring !== false),
        editRecurringAmount: String(goal.recurringAmount || ''),
        editFrequency: goal.frequency || 'MONTHLY',
        editIntervalDays: String(goal.intervalDays || '30'),
      },
    });
  };

  /**
   * Quick deposit towards a Chit Fund or Recurring Savings Goal.
   */
  const handleDepositSubmit = async (goal: RecurringSavingsGoal, amount: number) => {
    try {
      await apiRequest(`/savings/goals/${goal.id}/deposit/user/${userId}?amount=${amount}`, {
        method: 'POST',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert(
        'Installment Deposited',
        `Successfully contributed ${currSym}${amount.toLocaleString()} to ${goal.name}.`,
        undefined,
        'success'
      );
      setDepositModalGoal(null);
      void fetchAllRecurringData();
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : 'Could not record installment deposit.';
      showAlert('Deposit Failed', msg, undefined, 'error');
      throw e;
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
      <ImmersiveLoader
        message="Loading Commitments & Subscriptions..."
        subMessage="Projecting recurring cash flow obligations"
      />
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
              void fetchAllRecurringData();
            }}
            style={[styles.retryBtn, { backgroundColor: c.primary }]}
          >
            <Ionicons name="refresh" size={18} color={c.onPrimary} />
            <Text style={[styles.retryBtnText, { color: c.onPrimary }]}>Retry</Text>
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

      <ThemedScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 10, 48),
            maxWidth: 1100,
            width: '100%',
            alignSelf: 'center',
            paddingLeft: Math.max(isDesktopOrTV ? 36 : isLargeScreen ? 24 : 16, insets.left),
            paddingRight: Math.max(isDesktopOrTV ? 36 : isLargeScreen ? 24 : 16, insets.right),
            paddingBottom: Math.max(insets.bottom + 20, 36),
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {fetchError ? (
          <OfflineBanner
            message={`Offline mode · ${fetchError}`}
            retrying={refreshing}
            onRetry={() => {
              setRefreshing(true);
              void fetchAllRecurringData();
            }}
          />
        ) : null}

        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.pageTitle, { color: c.text }]}>Subscriptions & Recurring</Text>
            <Text style={[styles.pageSubtitle, { color: c.textMuted }]}>
              {totalCommitmentCount} active recurring commitment{totalCommitmentCount === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/(tabs)/add-expense', params: { editId: '', editType: '' } })}
              style={[styles.addBtn, { backgroundColor: c.primary }]}
              accessibilityLabel="Add Commitment"
            >
              <Ionicons name="add" size={20} color={c.onPrimary} />
              <Text style={[styles.addBtnText, { color: c.onPrimary }]}>New</Text>
            </TouchableOpacity>
            <ThemeToggleBtn />
          </View>
        </View>

        {/* Tri-Domain Recurring Run-Rate KPI Banner */}
        <SubscriptionsKpiCards
          monthlyIncomeTotal={monthlyIncomeTotal}
          monthlyExpenseTotal={monthlyExpenseTotal}
          monthlySavingsTotal={monthlySavingsTotal}
          netRecurringFlow={netRecurringFlow}
          currSym={currSym}
          isStealthMode={isStealthMode}
          colors={c}
        />

        {/* Filter Segment Tabs */}
        <SubscriptionsSegmentFilter
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          totalCount={totalCommitmentCount}
          subscriptionsCount={subscriptions.length}
          incomesCount={recurringIncomes.length}
          savingsCount={recurringSavings.length}
          colors={c}
        />

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
              <Ionicons name="add" size={18} color={c.onPrimary} />
              <Text style={[styles.emptyActionBtnText, { color: c.onPrimary }]}>
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
                <Ionicons name="arrow-down-circle" size={16} color={c.success} />
                <Text style={[styles.sectionTitle, { color: c.text }]}>Recurring Inflow Streams</Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: c.success }]}>
                {isStealthMode ? `+${currSym}••••••/mo` : `+${currSym}${monthlyIncomeTotal.toLocaleString()}/mo`}
              </Text>
            </View>

            {recurringIncomes.map((inc) => (
              <RecurringItemCard
                key={`inc-${inc.id}`}
                item={inc}
                type="income"
                currSym={currSym}
                isStealthMode={isStealthMode}
                colors={c}
                onEdit={() => handleEditIncome(inc)}
                onDelete={() => handleDeleteIncome(inc)}
              />
            ))}
          </View>
        )}

        {/* =========================================
            SECTION: RECURRING CHITS & SAVINGS GOALS
            ========================================= */}
        {showSavings && recurringSavings.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionBadgeWrap}>
                <Ionicons name="shield-checkmark" size={16} color={c.warning} />
                <Text style={[styles.sectionTitle, { color: c.text }]}>Chits & Recurring Deposits</Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: c.warning }]}>
                {isStealthMode ? `${currSym}••••••/mo` : `${currSym}${monthlySavingsTotal.toLocaleString()}/mo`}
              </Text>
            </View>

            {recurringSavings.map((goal) => (
              <RecurringItemCard
                key={`sav-${goal.id}`}
                item={goal}
                type="savings"
                currSym={currSym}
                isStealthMode={isStealthMode}
                colors={c}
                onEdit={() => handleEditSavingsGoal(goal)}
                onDelete={() => handleDeleteSavingsGoal(goal)}
                onDeposit={(g) => setDepositModalGoal(g)}
              />
            ))}
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
                {isStealthMode ? `-${currSym}••••••/mo` : `-${currSym}${monthlyExpenseTotal.toLocaleString()}/mo`}
              </Text>
            </View>

            {subscriptions.map((sub) => (
              <RecurringItemCard
                key={`sub-${sub.id}`}
                item={sub}
                type="expense"
                currSym={currSym}
                isStealthMode={isStealthMode}
                colors={c}
                onEdit={() => setEditingSub(sub)}
                onDelete={() => handleDeleteSubscription(sub)}
              />
            ))}
          </View>
        )}
      </ThemedScrollView>

      {/* Quick Deposit Modal for Chit / Savings */}
      <QuickDepositModal
        goal={depositModalGoal}
        onClose={() => setDepositModalGoal(null)}
        onDeposit={handleDepositSubmit}
        currSym={currSym}
        colors={c}
      />

      {/* Edit Subscription Modal */}
      <EditSubscriptionModal
        visible={!!editingSub}
        subscription={editingSub}
        categories={categories}
        onClose={() => setEditingSub(null)}
        onUpdated={() => void fetchAllRecurringData()}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
});
