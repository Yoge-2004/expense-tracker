import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
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

export default function SubscriptionsScreen() {
  const { userId, theme } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isLight = theme === 'light';

  // Dynamic Theme Colors configuration
  const getThemeColors = () => {
    if (theme === 'light') {
      return {
        bg: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E2E8F0',
        text: '#0F172A',
        textMuted: '#64748B',
        accent: '#6366F1',
      };
    }
    return {
      bg: '#090D16',
      card: 'rgba(17, 24, 39, 0.85)',
      border: 'rgba(255, 255, 255, 0.08)',
      text: '#F8FAFC',
      textMuted: '#94A3B8',
      accent: '#6366F1',
    };
  };

  const c = getThemeColors();

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

  const handleCancelSubscription = (subId: number, name: string) => {
    Alert.alert(
      'Cancel Subscription',
      `Are you sure you want to cancel the recurring subscription for "${name}"?`,
      [
        { text: 'Keep Active', style: 'cancel' },
        { 
          text: 'Cancel Repeat', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/expenses/recurring/${subId}`, {
                method: 'DELETE',
              });
              Alert.alert('Success', 'Subscription cancelled successfully.');
              fetchSubscriptions();
            } catch (error: any) {
              Alert.alert('Failed', error.message || 'Could not cancel the subscription.');
            }
          }
        }
      ]
    );
  };

  const categoryColors: { [key: string]: string } = {
    food: '#ef4444',
    transport: '#3b82f6',
    utilities: '#f59e0b',
    entertainment: '#ec4899',
    health: '#10b981',
  };

  const getCategoryColor = (name: string) => categoryColors[name.toLowerCase()] || '#8b5cf6';

  const getCategoryIconName = (name: string): any => {
    const norm = name.toLowerCase();
    if (norm.includes('food') || norm.includes('dining')) return 'fast-food';
    if (norm.includes('transport') || norm.includes('travel') || norm.includes('fuel')) return 'car';
    if (norm.includes('utilities') || norm.includes('electricity') || norm.includes('water') || norm.includes('bill')) return 'flash';
    if (norm.includes('entertainment') || norm.includes('movie') || norm.includes('game') || norm.includes('fun')) return 'game-controller';
    if (norm.includes('health') || norm.includes('medical') || norm.includes('fitness')) return 'medical';
    return 'repeat';
  };

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color="#FF9F6E" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: c.bg }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF9F6E" />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Active Subscriptions</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>Configured monthly or repeating outgoings</Text>
      </View>

      {subscriptions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="repeat-outline" size={60} color={c.textMuted} />
          <Text style={[styles.emptyText, { color: c.text }]}>No active subscriptions found</Text>
          <Text style={[styles.emptySubtext, { color: c.textMuted }]}>
            Turn on "Repeat this expense repeatedly" when recording expenses to set them up.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {subscriptions.map((item) => (
            <View key={item.id} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.leftCol}>
                  <View style={[styles.iconCircle, { backgroundColor: getCategoryColor(item.categoryName) + '15' }]}>
                    <Ionicons name={getCategoryIconName(item.categoryName)} size={20} color={getCategoryColor(item.categoryName)} />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: c.text }]}>{item.description}</Text>
                    <Text style={[styles.cardMeta, { color: c.textMuted }]}>{item.categoryName} • {item.frequency}</Text>
                  </View>
                </View>
                <Text style={[styles.cardAmount, { color: c.text }]}>₹{Number(item.amount).toFixed(2)}</Text>
              </View>

              <View style={[styles.cardDivider, { backgroundColor: c.border }]} />

              <View style={styles.cardFooter}>
                <View style={styles.footerInfo}>
                  <Ionicons name="calendar-outline" size={14} color={c.textMuted} />
                  <Text style={[styles.footerInfoText, { color: c.textMuted }]}>Next bill: {item.nextDueDate}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => handleCancelSubscription(item.id, item.description)}
                >
                  <Text style={styles.cancelButtonText}>Cancel Repeat</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardDivider: {
    height: 1,
    marginVertical: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerInfoText: {
    fontSize: 12,
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 80, 0.2)',
  },
  cancelButtonText: {
    fontSize: 12,
    color: '#FF6B50',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
});
