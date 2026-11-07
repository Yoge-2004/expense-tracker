/**
 * @file RecurringItemCard.tsx
 * @description Unified card component for recurring financial commitments:
 * - Subscriptions (outflows)
 * - Inflows (recurring income streams)
 * - Chit Funds & Recurring Deposits (savings goals)
 * Wrapped in SwipeableCard with due dates, progress bars, and accessible action buttons.
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text } from '../ThemedText';
import { SwipeableCard } from '../SwipeableCard';
import { ThemeColors, getCategoryColor, getCategoryIconName } from '../../constants/theme';
import {
  Subscription,
  RecurringIncome,
  RecurringSavingsGoal,
  getDaysUntil,
} from './subscriptionsTypes';

export type CommitmentType = 'expense' | 'income' | 'savings';

export interface RecurringItemCardProps {
  item: Subscription | RecurringIncome | RecurringSavingsGoal;
  type: CommitmentType;
  currSym: string;
  isStealthMode: boolean;
  colors: ThemeColors;
  onEdit: () => void;
  onDelete: () => void;
  onDeposit?: (goal: RecurringSavingsGoal) => void;
}

export const RecurringItemCard = memo(function RecurringItemCard({
  item,
  type,
  currSym,
  isStealthMode,
  colors: c,
  onEdit,
  onDelete,
  onDeposit,
}: RecurringItemCardProps) {
  if (type === 'income') {
    const inc = item as RecurringIncome;
    const days = getDaysUntil(inc.nextDueDate);
    const isToday = days === 0;

    return (
      <SwipeableCard onEdit={onEdit} onDelete={onDelete} editColor={c.success}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: isToday ? c.success : c.border,
            },
          ]}
        >
          <View style={styles.topRow}>
            <View style={styles.leftMeta}>
              <View style={[styles.iconBox, { backgroundColor: c.success + '18' }]}>
                <Ionicons name="cash-outline" size={18} color={c.success} />
              </View>
              <View style={styles.textMeta}>
                <Text style={[styles.title, { color: c.text }]}>{inc.source}</Text>
                <View style={styles.subRow}>
                  <Text style={[styles.catBadgeText, { color: c.success }]}>Guaranteed Inflow</Text>
                  <Text style={[styles.dot, { color: c.textMuted }]}>•</Text>
                  <Text style={[styles.freqText, { color: c.textMuted }]}>
                    {inc.frequency === 'CUSTOM' && inc.intervalDays ? `Every ${inc.intervalDays}d` : (inc.frequency || 'MONTHLY')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.rightMeta}>
              <Text style={[styles.amount, { color: c.success, fontWeight: '800' }]}>
                {isStealthMode ? `+${currSym}••••••` : `+${currSym}${Number(inc.amount || 0).toLocaleString('en-IN')}`}
              </Text>
            </View>
          </View>

          <View style={[styles.bottomRow, { borderTopColor: c.border }]}>
            <View
              style={[
                styles.dueBadge,
                { backgroundColor: isToday ? c.success + '20' : c.inputBg },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={12}
                color={isToday ? c.success : c.textMuted}
              />
              <Text
                style={[
                  styles.dueBadgeText,
                  { color: isToday ? c.success : c.textMuted },
                ]}
              >
                {days === 999
                  ? 'Active stream'
                  : days === 0
                  ? 'Landing Today!'
                  : days < 0
                  ? `Due ${Math.abs(days)}d ago`
                  : `Next: in ${days} days`}
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onEdit}
                style={[styles.actionBtn, { backgroundColor: c.inputBg }]}
                accessibilityLabel="Edit income stream"
              >
                <Ionicons name="pencil" size={14} color={c.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onDelete}
                style={[styles.actionBtn, { backgroundColor: c.inputBg }]}
                accessibilityLabel="Delete income stream"
              >
                <Ionicons name="trash-outline" size={14} color={c.accent} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SwipeableCard>
    );
  }

  if (type === 'savings') {
    const goal = item as RecurringSavingsGoal;
    const days = getDaysUntil(goal.nextDueDate);
    const isUrgent = days <= 3 && days >= 0;
    const isOverdue = days < 0;
    const target = Number(goal.targetAmount || 0);
    const current = Number(goal.currentAmount || 0);
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

    return (
      <SwipeableCard onEdit={onEdit} onDelete={onDelete} editColor={c.warning}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: isUrgent || isOverdue ? c.warning : c.border,
            },
          ]}
        >
          <View style={styles.topRow}>
            <View style={styles.leftMeta}>
              <View style={[styles.iconBox, { backgroundColor: c.warning + '18' }]}>
                <Ionicons name="file-tray-full-outline" size={18} color={c.warning} />
              </View>
              <View style={styles.textMeta}>
                <Text style={[styles.title, { color: c.text }]}>{goal.name}</Text>
                <View style={styles.subRow}>
                  <Text style={[styles.catBadgeText, { color: c.warning }]}>Chit / RD Plan</Text>
                  <Text style={[styles.dot, { color: c.textMuted }]}>•</Text>
                  <Text style={[styles.freqText, { color: c.textMuted }]}>
                    {goal.frequency === 'CUSTOM' && goal.intervalDays ? `Every ${goal.intervalDays}d` : (goal.frequency || 'MONTHLY')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.rightMeta}>
              <Text style={[styles.amount, { color: c.warning, fontWeight: '800' }]}>
                {isStealthMode ? `${currSym}••••••` : `${currSym}${Number(goal.recurringAmount || 0).toLocaleString('en-IN')}`}
                <Text style={{ fontSize: 11, fontWeight: '500', color: c.textMuted }}> / cycle</Text>
              </Text>
            </View>
          </View>

          {/* Goal Progress bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressMeta}>
              <Text style={[styles.progressVal, { color: c.textMuted }]}>
                {isStealthMode ? `Accumulated: ${currSym}••••••` : `Accumulated: ${currSym}${current.toLocaleString()} of ${currSym}${target.toLocaleString()}`}
              </Text>
              <Text style={[styles.progressPct, { color: c.warning }]}>{pct}%</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: c.inputBg }]}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: c.warning }]} />
            </View>
          </View>

          <View style={[styles.bottomRow, { borderTopColor: c.border }]}>
            <View
              style={[
                styles.dueBadge,
                { backgroundColor: isUrgent || isOverdue ? c.warning + '20' : c.inputBg },
              ]}
            >
              <Ionicons
                name={isUrgent ? 'flame' : 'alarm-outline'}
                size={12}
                color={isUrgent || isOverdue ? c.warning : c.textMuted}
              />
              <Text
                style={[
                  styles.dueBadgeText,
                  { color: isUrgent || isOverdue ? c.warning : c.textMuted },
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

            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onEdit}
                style={[styles.actionBtn, { backgroundColor: c.inputBg }]}
                accessibilityLabel="Edit chit plan"
              >
                <Ionicons name="pencil" size={14} color={c.warning} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onDelete}
                style={[styles.actionBtn, { backgroundColor: c.inputBg }]}
                accessibilityLabel="Delete chit plan"
              >
                <Ionicons name="trash-outline" size={14} color={c.accent} />
              </TouchableOpacity>
              {onDeposit && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onDeposit(goal)}
                  style={[styles.depositBtn, { backgroundColor: c.warning }]}
                  accessibilityLabel="Deposit installment"
                >
                  <Ionicons name="add-circle-outline" size={13} color={c.onWarning} />
                  <Text style={[styles.depositBtnText, { color: c.onWarning }]}>Deposit</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </SwipeableCard>
    );
  }

  // Fallback: type === 'expense' (Subscription)
  const sub = item as Subscription;
  const days = getDaysUntil(sub.nextDueDate);
  const isUrgent = days <= 3 && days >= 0;
  const isOverdue = days < 0;
  const catColor = getCategoryColor(sub.categoryName || '', undefined, c.paletteColors).color;

  return (
    <SwipeableCard onEdit={onEdit} onDelete={onDelete}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: c.card,
            borderColor: isUrgent ? c.accent : isOverdue ? c.warning : c.border,
          },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.leftMeta}>
            <View style={[styles.iconBox, { backgroundColor: catColor + '18' }]}>
              <Ionicons name={getCategoryIconName(sub.categoryName || 'General')} size={18} color={catColor} />
            </View>
            <View style={styles.textMeta}>
              <Text style={[styles.title, { color: c.text }]}>{sub.description}</Text>
              <View style={styles.subRow}>
                <Text style={[styles.catBadgeText, { color: catColor }]}>
                  {sub.categoryName || 'General'}
                </Text>
                <Text style={[styles.dot, { color: c.textMuted }]}>•</Text>
                <Text style={[styles.freqText, { color: c.textMuted }]}>
                  {sub.frequency}
                  {sub.frequency === 'CUSTOM' && sub.intervalDays ? ` (${sub.intervalDays}d)` : ''}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.rightMeta}>
            <Text style={[styles.amount, { color: c.text, fontWeight: '800' }]}>
              {isStealthMode ? `${currSym}••••••` : `${currSym}${Number(sub.amount || 0).toLocaleString('en-IN')}`}
            </Text>
          </View>
        </View>

        <View style={[styles.bottomRow, { borderTopColor: c.border }]}>
          <View
            style={[
              styles.dueBadge,
              { backgroundColor: isUrgent ? c.accent + '20' : isOverdue ? c.warning + '20' : c.inputBg },
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
                { color: isUrgent ? c.accent : isOverdue ? c.warning : c.textMuted },
              ]}
            >
              {isOverdue
                ? `Overdue by ${Math.abs(days)}d`
                : days === 0
                ? 'Due Today!'
                : `Due in ${days} days`}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onEdit}
              style={[styles.actionBtn, { backgroundColor: c.inputBg }]}
              accessibilityLabel="Edit subscription"
            >
              <Ionicons name="pencil" size={14} color={c.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onDelete}
              style={[styles.actionBtn, { backgroundColor: c.inputBg }]}
              accessibilityLabel="Delete subscription"
            >
              <Ionicons name="trash-outline" size={14} color={c.accent} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SwipeableCard>
  );
});

RecurringItemCard.displayName = 'RecurringItemCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textMeta: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dot: {
    fontSize: 11,
  },
  freqText: {
    fontSize: 11,
    fontWeight: '500',
  },
  rightMeta: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  amount: {
    fontSize: 15,
  },
  progressWrap: {
    marginTop: 10,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressVal: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressPct: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  depositBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
