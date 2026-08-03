import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Animated,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

interface Subscription {
  id: number;
  description: string;
  amount: number;
  nextDueDate: string;
  frequency: string;
  categoryName: string;
}

const FREQUENCY_COLORS: Record<string, string> = {
  DAILY: '#A23E32',
  WEEKLY: '#C9932E',
  MONTHLY: '#C79A3E',
  YEARLY: '#4C7A78',
  CUSTOM: '#8B5E34',
};

const CATEGORY_COLORS: Record<string, string> = {
  food: '#A23E32',
  transport: '#4C7A78',
  utilities: '#C9932E',
  entertainment: '#B06B5C',
  health: '#5B8C5A',
};

function getCategoryColor(name: string) {
  return CATEGORY_COLORS[name.toLowerCase()] || '#6B7280';
}

function getCategoryIcon(name: string): any {
  const n = name.toLowerCase();
  if (n.includes('food') || n.includes('dining')) return 'fast-food';
  if (n.includes('transport') || n.includes('travel')) return 'car';
  if (n.includes('utilities') || n.includes('bill')) return 'flash';
  if (n.includes('entertainment') || n.includes('movie')) return 'game-controller';
  if (n.includes('health') || n.includes('medical')) return 'medical';
  return 'repeat';
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function SubscriptionsScreen() {
  const { userId, theme } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isLight = theme === 'light';

  const c = {
    bg: isLight ? '#EDEAE0' : '#10120E',
    card: isLight ? '#FFFFFF' : 'rgba(13,18,30,0.9)',
    border: isLight ? '#DAD4C1' : 'rgba(255,255,255,0.07)',
    text: isLight ? '#171A14' : '#ECE7D8',
    textMuted: isLight ? '#A8A395' : '#A8A395',
    inputBg: isLight ? '#FCFBF6' : 'rgba(10,16,30,0.7)',
    accent: '#C79A3E',
    orange: '#A23E32',
  };

  const fetchSubscriptions = async () => {
    if (!userId) return;
    try {
      const data = await apiRequest(`/expenses/recurring/user/${userId}`);
      setSubscriptions(data || []);
    } catch (e) {
      console.error('Failed to load subscriptions', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSubscriptions();
    }, [userId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubscriptions();
  };

  const handleCancel = (subId: number, name: string) => {
    Alert.alert(
      'Cancel Subscription',
      `Cancel the recurring payment for "${name}"? This cannot be undone.`,
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Cancel It',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/expenses/recurring/${subId}`, { method: 'DELETE' });
              Alert.alert('Done', 'Subscription cancelled.');
              fetchSubscriptions();
            } catch (error: any) {
              Alert.alert('Failed', error.message || 'Could not cancel.');
            }
          },
        },
      ]
    );
  };

  const totalMonthly = subscriptions.reduce((sum, s) => {
    const multipliers: Record<string, number> = {
      DAILY: 30, WEEKLY: 4.33, MONTHLY: 1, YEARLY: 1 / 12,
    };
    return sum + Number(s.amount) * (multipliers[s.frequency] ?? 1);
  }, 0);

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={[styles.loadingText, { color: c.textMuted }]}>Loading subscriptions...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
    >
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.pageTitle, { color: c.text }]}>Subscriptions</Text>
          <Text style={[styles.pageSub, { color: c.textMuted }]}>Your recurring payments</Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: c.accent + '18', borderColor: c.accent + '40' }]}>
          <Text style={[styles.countBadgeText, { color: c.accent }]}>{subscriptions.length} active</Text>
        </View>
      </View>

      {/* ── MONTHLY TOTAL CARD ── */}
      {subscriptions.length > 0 && (
        <View style={[styles.totalCard, { backgroundColor: c.card, borderColor: c.accent + '35' }]}>
          <View style={[styles.totalCardGlow, { backgroundColor: c.accent + '12' }]} />
          <View style={styles.totalCardContent}>
            <View>
              <Text style={[styles.totalCardLabel, { color: c.textMuted }]}>Monthly total</Text>
              <Text style={[styles.totalCardAmount, { color: c.text }]}>
                ₹{totalMonthly.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
              <Text style={[styles.totalCardSub, { color: c.textMuted }]}>
                across {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={[styles.totalCardIcon, { backgroundColor: c.accent + '20', borderColor: c.accent + '50' }]}>
              <Ionicons name="repeat" size={22} color={c.accent} />
            </View>
          </View>
        </View>
      )}

      {/* ── LIST ── */}
      {subscriptions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBox, { backgroundColor: c.accent + '12' }]}>
            <Ionicons name="repeat-outline" size={40} color={c.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.text }]}>No subscriptions yet</Text>
          <Text style={[styles.emptyBody, { color: c.textMuted }]}>
            When adding an expense, toggle "Repeat this expense" to create a recurring subscription here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {subscriptions.map((item, index) => {
            const col = getCategoryColor(item.categoryName);
            const freqColor = FREQUENCY_COLORS[item.frequency] || '#6B7280';
            const daysUntil = getDaysUntil(item.nextDueDate);
            const isDueSoon = daysUntil <= 3 && daysUntil >= 0;
            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: c.card,
                    borderColor: c.border,
                    borderLeftColor: col,
                    borderLeftWidth: 3,
                  },
                ]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={[styles.catIcon, { backgroundColor: col + '20' }]}>
                    <Ionicons name={getCategoryIcon(item.categoryName)} size={20} color={col} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, { color: c.text }]}>{item.description}</Text>
                    <View style={styles.cardMetaRow}>
                      <Text style={[styles.cardMeta, { color: c.textMuted }]}>{item.categoryName}</Text>
                      <View style={[styles.freqBadge, { backgroundColor: freqColor + '18', borderColor: freqColor + '40' }]}>
                        <Text style={[styles.freqBadgeText, { color: freqColor }]}>
                          {item.frequency}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.cardAmount, { color: c.text }]}>₹{Number(item.amount).toFixed(0)}</Text>
                </View>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: c.border }]} />

                {/* Card Footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.dueDateRow}>
                    <Ionicons
                      name={isDueSoon ? 'alert-circle' : 'calendar-outline'}
                      size={13}
                      color={isDueSoon ? '#A23E32' : c.textMuted}
                    />
                    <Text style={[styles.dueDateText, { color: isDueSoon ? '#A23E32' : c.textMuted }]}>
                      {isDueSoon
                        ? daysUntil === 0 ? 'Due today!' : `Due in ${daysUntil}d`
                        : `Next: ${item.nextDueDate}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleCancel(item.id, item.description)}
                  >
                    <Ionicons name="close-circle-outline" size={13} color="#A23E32" />
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingText: { fontSize: 14, fontWeight: '500' },

  /* HEADER */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  pageSub: {
    fontSize: 13,
    marginTop: 2,
  },
  countBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* TOTAL CARD */
  totalCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  totalCardGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -50,
    right: -30,
  },
  totalCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  totalCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  totalCardAmount: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  totalCardSub: {
    fontSize: 12,
    marginTop: 4,
  },
  totalCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* LIST */
  list: {
    paddingHorizontal: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardMeta: {
    fontSize: 12,
  },
  freqBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  freqBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dueDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,71,87,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.2)',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A23E32',
  },

  /* EMPTY */
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    gap: 14,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
