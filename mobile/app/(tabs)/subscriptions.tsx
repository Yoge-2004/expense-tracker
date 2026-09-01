/**
 * @file subscriptions.tsx
 * @description Recurring Subscriptions & Membership Tracker screen.
 * Displays committed monthly & annual run-rates, upcoming billing countdowns,
 * instant edit modals, and one-tap cancellation confirmations with full exception handling.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
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

/**
 * Calculates remaining days until a target due date string.
 *
 * @param dateStr - ISO formatted date string.
 * @returns Number of days until due.
 */
function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  try {
    const target = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return isNaN(diff) ? 999 : diff;
  } catch {
    return 999;
  }
}

/**
 * Subscriptions & Recurring commitments management screen.
 */
export default function SubscriptionsScreen() {
  const { userId, theme, currency } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currSym = getCurrencySymbol(currency);
  const c = Colors[theme];
  const isLight = theme === 'light';

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /**
   * Fetches user subscriptions and merged category lookup options.
   */
  const fetchSubscriptionsAndCategories = async () => {
    if (!userId) return;
    try {
      const [subsData, globalCats, userCats] = await Promise.all([
        apiRequest(`/expenses/recurring/user/${userId}`),
        apiRequest(`/categories/global`),
        apiRequest(`/categories/user/${userId}`),
      ]);

      setSubscriptions(Array.isArray(subsData) ? subsData : []);
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
      console.warn('[SubscriptionsScreen] Failed to load recurring subscriptions:', e);
      const isApiErr = e instanceof ApiError;
      setFetchError(isApiErr ? e.message : 'Could not synchronize subscriptions.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSubscriptionsAndCategories();
    }, [userId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fetchSubscriptionsAndCategories();
  };

  /**
   * Deletes a recurring subscription.
   */
  const handleDelete = (sub: Subscription) => {
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
              await apiRequest(`/expenses/recurring/${sub.id}/user/${userId}`, {
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

  // Run-rate calculations with strict NaN/Infinity guards
  const monthlyTotal = subscriptions.reduce((sum, s) => {
    const amt = Math.max(0, Number(s.amount || 0));
    const freq = (s.frequency || 'MONTHLY').toUpperCase();
    if (freq === 'DAILY') return sum + amt * 30;
    if (freq === 'WEEKLY') return sum + amt * 4.33;
    if (freq === 'YEARLY') return sum + amt / 12;
    return sum + amt;
  }, 0);

  const yearlyTotal = monthlyTotal * 12;

  if (isLoading && !refreshing && subscriptions.length === 0) {
    return (
      <View style={[styles.loadingBox, { backgroundColor: c.bg }]}>
        <AmbientAura />
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  // Offline Error State
  if (!isLoading && fetchError && subscriptions.length === 0) {
    return (
      <View style={[styles.errorWrapper, { backgroundColor: c.bg }]}>
        <AmbientAura />
        <View style={styles.errorCard}>
          <View style={[styles.errorIconBox, { backgroundColor: c.accent + '20' }]}>
            <Ionicons name="cloud-offline-outline" size={38} color={c.accent} />
          </View>
          <Text style={[styles.errorTitle, { color: c.text }]}>Unable to Load Subscriptions</Text>
          <Text style={[styles.errorDesc, { color: c.textMuted }]}>{fetchError}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setIsLoading(true);
              fetchSubscriptionsAndCategories();
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

  return (
    <View style={[styles.screenWrapper, { backgroundColor: c.bg }]}>
      <AmbientAura />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top + 10, 48) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.pageTitle, { color: c.text }]}>Subscriptions</Text>
            <Text style={[styles.pageSubtitle, { color: c.textMuted }]}>
              {subscriptions.length} active recurring commitment{subscriptions.length === 1 ? '' : 's'}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/add-expense')}
            style={[styles.addBtn, { backgroundColor: c.primary }]}
            accessibilityLabel="Add Subscription"
          >
            <Ionicons name="add" size={20} color={isLight ? '#FFF' : '#10120E'} />
            <Text style={[styles.addBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Total Run-Rate KPI Cards */}
        <StaggeredView delay={100} direction="up">
          <View style={styles.kpiRow}>
            {/* Monthly Load */}
            <View style={[styles.kpiCard, { backgroundColor: c.card, borderColor: c.primary + '40' }]}>
              <View style={styles.kpiHeader}>
                <Text style={[styles.kpiLabel, { color: c.textMuted }]}>Monthly Burn</Text>
                <View style={[styles.kpiBadge, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name="repeat" size={13} color={c.primary} />
                </View>
              </View>
              <NumberTicker
                value={monthlyTotal}
                prefix={currSym}
                decimals={0}
                style={[styles.kpiValue, { color: c.primary }]}
              />
              <Text style={[styles.kpiSub, { color: c.textMuted }]}>Committed recurring</Text>
            </View>

            {/* Annual Run Rate */}
            <View style={[styles.kpiCard, { backgroundColor: c.card, borderColor: c.teal + '40' }]}>
              <View style={styles.kpiHeader}>
                <Text style={[styles.kpiLabel, { color: c.textMuted }]}>Annual Load</Text>
                <View style={[styles.kpiBadge, { backgroundColor: c.teal + '18' }]}>
                  <Ionicons name="calendar-outline" size={13} color={c.teal} />
                </View>
              </View>
              <NumberTicker
                value={yearlyTotal}
                prefix={currSym}
                decimals={0}
                style={[styles.kpiValue, { color: c.teal }]}
              />
              <Text style={[styles.kpiSub, { color: c.textMuted }]}>Projected 12m run-rate</Text>
            </View>
          </View>
        </StaggeredView>

        {/* Subscriptions List */}
        <StaggeredView delay={200} direction="up">
          {subscriptions.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.emptyIconBox, { backgroundColor: c.primary + '15' }]}>
                <Ionicons name="sparkles" size={32} color={c.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: c.text }]}>Zero Active Subscriptions</Text>
              <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
                Track Netflix, Spotify, gym memberships, and rent renewals in one intelligent view.
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/(tabs)/add-expense')}
                style={[styles.emptyActionBtn, { backgroundColor: c.primary }]}
              >
                <Ionicons name="add" size={18} color={isLight ? '#FFF' : '#10120E'} />
                <Text style={[styles.emptyActionBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>
                  Add Recurring Plan
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.subsList}>
              {subscriptions.map((sub, index) => {
                const days = getDaysUntil(sub.nextDueDate);
                const isUrgent = days <= 3 && days >= 0;
                const isOverdue = days < 0;
                const catColor = getCategoryColor(sub.categoryName || '').color;

                return (
                  <StaggeredView key={sub.id} delay={120 + Math.min(index * 60, 400)} direction="up">
                    <View
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
                      {/* Due badge */}
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

                      {/* Action buttons */}
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
                          onPress={() => handleDelete(sub)}
                          style={[styles.iconActionBtn, { backgroundColor: c.inputBg }]}
                        >
                          <Ionicons name="trash-outline" size={14} color={c.accent} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </StaggeredView>
                );
              })}
            </View>
          )}
        </StaggeredView>
      </ScrollView>

      {/* Edit Subscription Modal */}
      <EditSubscriptionModal
        visible={!!editingSub}
        subscription={editingSub}
        categories={categories}
        onClose={() => setEditingSub(null)}
        onUpdated={() => fetchSubscriptionsAndCategories()}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 10,
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    fontWeight: '800',
    fontSize: 13.5,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  kpiSub: {
    fontSize: 11,
  },
  subsList: {
    gap: 12,
  },
  subCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  subTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    fontWeight: '800',
    marginBottom: 3,
  },
  subSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subCatText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  dotText: {
    fontSize: 8,
  },
  subFreqText: {
    fontSize: 11.5,
  },
  subRight: {
    alignItems: 'flex-end',
  },
  subAmtText: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  subBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
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
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 6,
  },
  emptyActionBtnText: {
    fontWeight: '800',
    fontSize: 13.5,
  },
});
