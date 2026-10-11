/**
 * Notification inbox: the newest notifications, mark all read, a switch per notification kind and a
 * button to send yourself a test notification.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { apiRequest, ApiError } from '../services/api';
import { Colors } from '../constants/theme';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  route?: string | null;
  read: boolean;
  createdAt: string;
}

interface Preference {
  type: string;
  label: string;
  description: string;
  enabled: boolean;
  locked: boolean;
}

/** Where tapping a notification goes. Anything not listed is only marked as read. */
const ROUTES: Record<string, string> = {
  budgets: '/(tabs)',
  goals: '/(tabs)',
  dashboard: '/(tabs)',
  subscriptions: '/(tabs)/subscriptions',
};

function timeAgo(value: string): string {
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return '';
  const minutes = Math.round((Date.now() - then.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const { userId, theme } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = Colors[theme];

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const base = `/notifications/user/${userId}`;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [inbox, preferences] = await Promise.all([
        apiRequest(`${base}?limit=50`),
        apiRequest(`${base}/preferences`),
      ]);
      setItems(inbox?.items ?? []);
      setUnread(inbox?.unreadCount ?? 0);
      setPrefs(Array.isArray(preferences) ? preferences : []);
    } catch {
      // keep what is on screen; pull to refresh tries again
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, base]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const markRead = async (ids: number[]) => {
    try {
      await apiRequest(`${base}/read`, { method: 'POST', body: JSON.stringify({ ids }) });
    } catch {
      // the next refresh shows the truth
    }
    load();
  };

  const open = async (item: NotificationItem) => {
    if (!item.read) await markRead([item.id]);
    const target = item.route ? ROUTES[item.route] : undefined;
    if (target) router.replace(target as any);
  };

  const togglePreference = async (type: string, enabled: boolean) => {
    const next = prefs.map((p) => (p.type === type ? { ...p, enabled } : p));
    setPrefs(next);
    try {
      await apiRequest(`${base}/preferences`, {
        method: 'PUT',
        body: JSON.stringify({ disabledTypes: next.filter((p) => !p.enabled).map((p) => p.type) }),
      });
    } catch (e) {
      showAlert('Could not save', e instanceof ApiError ? e.message : 'Check your connection and try again.', undefined, 'error');
      load();
    }
  };

  const sendTest = async () => {
    try {
      await apiRequest(`${base}/test`, { method: 'POST' });
      showAlert('Test sent', 'A test notification is on its way.', undefined, 'success');
      load();
    } catch (e) {
      showAlert('Could not send', e instanceof ApiError ? e.message : 'Check your connection and try again.', undefined, 'error');
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => open(item)}
      accessibilityRole="button"
      style={[styles.item, { backgroundColor: c.card, borderColor: item.read ? c.border : c.primary }]}
    >
      <View style={styles.itemHeader}>
        <Text style={[styles.itemTitle, { color: c.text }]}>{item.title}</Text>
        {!item.read && <View style={[styles.unreadDot, { backgroundColor: c.primary }]} />}
      </View>
      <Text style={[styles.itemBody, { color: c.textMuted }]}>{item.body}</Text>
      <Text style={[styles.itemTime, { color: c.textMuted }]}>{timeAgo(item.createdAt)}</Text>
    </TouchableOpacity>
  );

  const settings = (
    <View style={styles.settings}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>Notification settings</Text>
      {prefs.map((pref) => (
        <View key={pref.type} style={[styles.prefRow, { borderBottomColor: c.border }]}>
          <View style={styles.prefText}>
            <Text style={[styles.prefLabel, { color: c.text }]}>{pref.label}</Text>
            <Text style={[styles.prefHint, { color: c.textMuted }]}>{pref.description}</Text>
          </View>
          <Switch
            value={pref.enabled}
            disabled={pref.locked}
            onValueChange={(value) => togglePreference(pref.type, value)}
            trackColor={{ false: c.border, true: c.primary }}
          />
        </View>
      ))}
      <TouchableOpacity activeOpacity={0.8} onPress={sendTest} style={[styles.testBtn, { borderColor: c.primary }]} accessibilityRole="button">
        <Ionicons name="paper-plane-outline" size={16} color={c.primary} />
        <Text style={[styles.testText, { color: c.primary }]}>Send a test notification</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={18} color={c.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>Notifications</Text>
        <TouchableOpacity onPress={() => markRead([])} disabled={unread === 0} accessibilityRole="button">
          <Text style={[styles.markAll, { color: unread === 0 ? c.textMuted : c.primary }]}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={c.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={c.primary}
            />
          }
          ListEmptyComponent={<Text style={[styles.empty, { color: c.textMuted }]}>You're all caught up.</Text>}
          ListFooterComponent={settings}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  markAll: { fontSize: 13, fontWeight: '700' },
  loader: { marginTop: 48 },
  list: { paddingHorizontal: 20, gap: 10 },
  item: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  itemBody: { fontSize: 13 },
  itemTime: { fontSize: 11 },
  empty: { textAlign: 'center', paddingVertical: 32, fontSize: 14 },
  settings: { marginTop: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  prefText: { flex: 1 },
  prefLabel: { fontSize: 14, fontWeight: '600' },
  prefHint: { fontSize: 12 },
  testBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, marginTop: 16, borderRadius: 12, borderWidth: 1.5 },
  testText: { fontSize: 13.5, fontWeight: '700' },
});
