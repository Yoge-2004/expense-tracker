/**
 * Notification inbox: the newest notifications, mark all read, swipe gesture to clear,
 * a switch per notification kind, and a button to send yourself a test notification.
 */
import React, { useCallback, useState, useRef, useMemo } from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Platform,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { apiRequest, ApiError } from '../services/api';
import { Colors } from '../constants/theme';
import { ImmersiveLoader } from '../components/ImmersiveLoader';
import { getNotificationSoundEnabled, setNotificationSoundEnabled } from '../services/notifications';

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
const ROUTES: Record<string, string> = { budgets: '/(tabs)',
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

interface SwipeableItemProps {
  item: NotificationItem;
  theme: any;
  onOpen: (item: NotificationItem) => void;
  onClear: (id: number) => void;
}

const SwipeableNotificationItem: React.FC<SwipeableItemProps> = ({ item, theme: c, onOpen, onClear }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const isSwiping = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 12;
        },
        onPanResponderGrant: () => {
          isSwiping.current = true;
        },
        onPanResponderMove: (_, gestureState) => {
          pan.x.setValue(gestureState.dx);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > 85) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            Animated.timing(pan.x, {
              toValue: gestureState.dx > 0 ? 450 : -450,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              onClear(item.id);
            });
          } else {
            Animated.spring(pan.x, {
              toValue: 0,
              friction: 7,
              tension: 50,
              useNativeDriver: true,
            }).start(() => {
              isSwiping.current = false;
            });
          }
        },
      }),
    [item.id, onClear, pan.x]
  );

  // Background and directional actions interpolate opacity so resting card is completely opaque with ZERO clear bleeding
  const bgOpacity = pan.x.interpolate({
    inputRange: [-60, -15, 0, 15, 60],
    outputRange: [1, 0.25, 0, 0.25, 1],
    extrapolate: 'clamp',
  });

  const leftActionOpacity = pan.x.interpolate({
    inputRange: [0, 20, 65],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });

  const leftActionScale = pan.x.interpolate({
    inputRange: [0, 65],
    outputRange: [0.8, 1],
    extrapolate: 'clamp',
  });

  const rightActionOpacity = pan.x.interpolate({
    inputRange: [-65, -20, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  const rightActionScale = pan.x.interpolate({
    inputRange: [-65, 0],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeContainer}>
      {/* Background Clear / Trash Action - dynamically reveals ONLY on active swipe */}
      <Animated.View style={[styles.swipeBackground, { backgroundColor: c.accent, opacity: bgOpacity }]}>
        <Animated.View style={[styles.swipeActionLeft, { opacity: leftActionOpacity, transform: [{ scale: leftActionScale }] }]}>
          <Ionicons name="trash-outline" size={17} color="#FFFFFF" />
          <Text style={styles.swipeActionText}>Clear</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeActionRight, { opacity: rightActionOpacity, transform: [{ scale: rightActionScale }] }]}>
          <Text style={styles.swipeActionText}>Clear</Text>
          <Ionicons name="trash-outline" size={17} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>

      {/* Foreground sliding card */}
      <Animated.View
        style={[
          styles.item,
          {
            backgroundColor: c.card,
            borderColor: item.read ? c.border : c.primary,
            transform: [{ translateX: pan.x }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onOpen(item)}
          accessibilityRole="button"
        >
          <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, { color: c.text }]}>{item.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {!item.read && <View style={[styles.unreadDot, { backgroundColor: c.primary }]} />}
              <TouchableOpacity
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => onClear(item.id)}
                accessibilityLabel="Delete notification"
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={15} color={c.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.itemBody, { color: c.textMuted }]}>{item.body}</Text>
          <Text style={[styles.itemTime, { color: c.textMuted }]}>{timeAgo(item.createdAt)}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default function NotificationsScreen() {
  const { userId, theme } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = Colors[theme];

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    getNotificationSoundEnabled().then(setSoundEnabled);
  }, []);

  const handleToggleSound = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSoundEnabled(val);
    await setNotificationSoundEnabled(val);
  };
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

  const clearNotification = async (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setUnread((prev) => Math.max(0, prev - 1));
    try {
      await apiRequest(`${base}/${id}`, { method: 'DELETE' });
    } catch {
      // offline fallback
    }
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
    <SwipeableNotificationItem
      item={item}
      theme={c}
      onOpen={open}
      onClear={clearNotification}
    />
  );

  const settings = (
    <View style={styles.settings}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>Notification settings</Text>
      <View style={[styles.prefRow, { borderBottomColor: c.border }]}>
        <View style={styles.prefText}>
          <Text style={[styles.prefLabel, { color: c.text }]}>Notification Sound</Text>
          <Text style={[styles.prefHint, { color: c.textMuted }]}>Play custom chime for notifications and alerts</Text>
        </View>
        <Switch
          value={soundEnabled}
          onValueChange={handleToggleSound}
          trackColor={{ false: c.border, true: '#93C5FD' }}
          thumbColor={soundEnabled ? '#2563EB' : (Platform.OS === 'android' ? '#F4F3F4' : undefined)}
        />
      </View>
      {prefs.map((pref) => (        <View key={pref.type} style={[styles.prefRow, { borderBottomColor: c.border }]}>
          <View style={styles.prefText}>
            <Text style={[styles.prefLabel, { color: c.text }]}>{pref.label}</Text>
            <Text style={[styles.prefHint, { color: c.textMuted }]}>{pref.description}</Text>
          </View>
          <Switch
            value={pref.enabled}
            onValueChange={(value) => {
              if (pref.locked) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                showAlert(
                  'Essential Notification',
                  'Account and system security notices are mandatory and cannot be switched off.',
                  undefined,
                  'info'
                );
                return;
              }
              togglePreference(pref.type, value);
            }}
            trackColor={{ false: c.border, true: '#93C5FD' }}
            thumbColor={pref.enabled ? '#2563EB' : (Platform.OS === 'android' ? '#F4F3F4' : undefined)}
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
        <ImmersiveLoader message="Syncing Notifications..." compact />
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
  list: { paddingHorizontal: 20, gap: 10 },
  swipeContainer: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  swipeBackground: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  swipeActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swipeActionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
