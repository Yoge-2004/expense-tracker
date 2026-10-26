import React, { useState, useRef, useMemo, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, getCategoryColor, getCategoryEmoji, ThemeColors } from '../../constants/theme';
import { UnifiedTxItem, TransactionRowProps } from './dashboardTypes';

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
    trough: { backgroundColor: 'rgba(18, 20, 16, 0.95)', borderColor: Colors.dark.border },
    editAction: { backgroundColor: '#C79A3E' },
    deleteAction: { backgroundColor: '#991B1B' },
    card: { backgroundColor: Colors.dark.inputBg, borderColor: Colors.dark.border },
    descText: { color: Colors.dark.text },
    mutedText: { color: Colors.dark.textMuted },
    miniBtn: { backgroundColor: Colors.dark.card },
    amountText: { color: Colors.dark.text },
  }),
  light: StyleSheet.create({
    trough: { backgroundColor: '#EAEFF5', borderColor: Colors.light.border },
    editAction: { backgroundColor: '#D4AF37' },
    deleteAction: { backgroundColor: '#BE123C' },
    card: { backgroundColor: Colors.light.inputBg, borderColor: Colors.light.border },
    descText: { color: Colors.light.text },
    mutedText: { color: Colors.light.textMuted },
    miniBtn: { backgroundColor: Colors.light.card },
    amountText: { color: Colors.light.text },
  }),
};

export const TransactionRow = memo(function TransactionRow({
  tx,
  colors,
  currSymbol,
  isStealth,
  onPress,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const isIncome = tx.type === 'income';
  const catColor = isIncome ? '#10B981' : getCategoryColor(tx.categoryOrSource || 'General').color;
  const [pan] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const isSwiping = useRef(false);

  const actionRefs = useRef({ tx, onEdit, onDelete });
  actionRefs.current = { tx, onEdit, onDelete };

  const panResponder = useMemo(
    () =>
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
    [pan]
  );

  const animatedNodes = useMemo(
    () => ({
      bgOpacity: pan.x.interpolate({
        inputRange: [-50, -10, 0, 10, 50],
        outputRange: [1, 0.2, 0, 0.2, 1],
        extrapolate: 'clamp',
      }),
      deleteOpacity: pan.x.interpolate({
        inputRange: [-80, -25, 0],
        outputRange: [1, 0.4, 0],
        extrapolate: 'clamp',
      }),
      deleteScale: pan.x.interpolate({
        inputRange: [-80, 0],
        outputRange: [1, 0.85],
        extrapolate: 'clamp',
      }),
      editOpacity: pan.x.interpolate({
        inputRange: [0, 25, 80],
        outputRange: [0, 0.4, 1],
        extrapolate: 'clamp',
      }),
      editScale: pan.x.interpolate({
        inputRange: [0, 80],
        outputRange: [0.85, 1],
        extrapolate: 'clamp',
      }),
    }),
    [pan]
  );
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
            <View style={[styles.catIconWrap, { backgroundColor: catColor + '18' }]}>
              {isIncome ? (
                <Ionicons name="arrow-down-circle" size={18} color="#10B981" />
              ) : (
                <Text style={styles.catEmojiText}>{getCategoryEmoji(tx.categoryOrSource || 'General')}</Text>
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
                  <View style={[styles.recurringBadge, { backgroundColor: (isIncome ? '#10B981' : colors.primary) + '18' }]}>
                    <Ionicons name="repeat" size={10} color={isIncome ? '#10B981' : colors.primary} />
                    <Text style={[styles.recurringBadgeText, { color: isIncome ? '#10B981' : colors.primary }]}>
                      {isIncome ? 'Recurring Inflow' : 'Sub'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.txRight}>
            <Text style={[styles.txAmount, isIncome ? { color: '#10B981', fontWeight: '800' } : tStyles.amountText, { fontWeight: '800' }]}>
              {isStealth
                ? `${isIncome ? '+' : '-'}${currSymbol}••••••`
                : `${isIncome ? '+' : '-'}${currSymbol}${Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
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
                <Ionicons name="pencil" size={12} color={isIncome ? '#10B981' : colors.primary} />
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

const styles = StyleSheet.create({
  swipeRowWrapper: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  swipeRowBg: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  swipeActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  swipeActionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  swipeActionText: {
    fontSize: 12,
    fontWeight: '800',
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
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  txRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  txMiniActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
