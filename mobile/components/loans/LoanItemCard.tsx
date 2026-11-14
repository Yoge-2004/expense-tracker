/**
 * @file LoanItemCard.tsx
 * @description Dedicated card component for a single peer loan / adjustment.
 * Adheres to Single Responsibility Principle (SRP) and provides rich accessibility.
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/theme';
import { LoanAdjustment } from '../../types/domain';
import { loansStyles as styles } from './loansStyles';

interface LoanItemCardProps {
  loan: LoanAdjustment;
  colors: ThemeColors;
  currSymbol: string;
  isLight: boolean;
  isStealthMode: boolean;
  onToggleSettle: (loan: LoanAdjustment) => void;
  onEdit: (loan: LoanAdjustment) => void;
  onDelete: (loan: LoanAdjustment) => void;
}

export const LoanItemCard: React.FC<LoanItemCardProps> = React.memo(({
  loan,
  colors: c,
  currSymbol,
  isLight,
  isStealthMode,
  onToggleSettle,
  onEdit,
  onDelete,
}) => {
  const isLent = loan.type === 'LENT';
  const typeColor = isLent ? c.success : c.danger;

  const formatAmount = (val: number, prefix: string = '') => {
    if (isStealthMode) return `${prefix}${currSymbol}••••••`;
    return `${prefix}${currSymbol}${Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <View
      style={[
        styles.loanItemCard,
        {
          backgroundColor: c.inputBg,
          borderColor: c.border,
          opacity: loan.isSettled ? 0.72 : 1,
        },
      ]}
    >
      {/* Left: Avatar + Details */}
      <View style={styles.loanItemLeft}>
        <View
          style={[
            styles.avatarBadge,
            {
              backgroundColor: (isLent ? c.success : c.danger) + '18',
            },
          ]}
        >
          <Ionicons
            name={isLent ? 'arrow-down-outline' : 'arrow-up-outline'}
            size={18}
            color={typeColor}
          />
        </View>
        <View style={styles.loanItemDetails}>
          <View style={styles.nameRow}>
            <Text style={[styles.counterpartyName, { color: c.text }]} numberOfLines={1}>
              {loan.counterparty}
            </Text>
            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor: (isLent ? c.success : c.danger) + '18',
                },
              ]}
            >
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                {isLent ? 'Lent' : 'Borrowed'}
              </Text>
            </View>
          </View>
          <View style={styles.subInfoRow}>
            <Text style={[styles.loanDateText, { color: c.textMuted }]}>
              {loan.adjustmentDate}
            </Text>
            {loan.dueDate ? (
              <>
                <Text style={[styles.dotSep, { color: c.textMuted }]}>•</Text>
                <Text style={[styles.loanDateText, { color: c.warning }]}>
                  Due: {loan.dueDate}
                </Text>
              </>
            ) : null}
            {loan.notes ? (
              <>
                <Text style={[styles.dotSep, { color: c.textMuted }]}>•</Text>
                <Text
                  style={[styles.loanNotesText, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {loan.notes}
                </Text>
              </>
            ) : null}
          </View>

          {/* Linked Expense Badge */}
          {loan.expenseId ? (
            <View style={[styles.linkedBadgeWrap, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="link-outline" size={11} color={c.primary} />
              <Text style={[styles.linkedBadgeText, { color: c.text }]} numberOfLines={1}>
                {loan.expenseDescription || 'Expense'} ({currSymbol}{loan.expenseAmount || ''})
              </Text>
            </View>
          ) : null}

          {/* Reminder Status Badge */}
          {loan.reminderEnabled && !loan.isSettled ? (
            <View style={[styles.reminderBadgeWrap, { backgroundColor: c.card, borderColor: c.primary + '40' }]}>
              <Ionicons name="notifications-outline" size={11} color={c.primary} />
              <Text style={[styles.reminderBadgeText, { color: c.primary }]} numberOfLines={1}>
                Remind {loan.reminderFrequency || 'Once'} at {loan.reminderTime || '10:00'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Right: Amount + Status + Actions */}
      <View style={styles.loanItemRight}>
        <Text style={[styles.loanAmountText, { color: typeColor }]}>
          {formatAmount(loan.amount, isLent ? '+' : '-')}
        </Text>

        <View style={styles.itemActionsRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={loan.isSettled ? 'Reopen loan' : 'Mark settled'}
            onPress={() => onToggleSettle(loan)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.settleBtn,
              {
                backgroundColor: loan.isSettled
                  ? isLight
                    ? '#E2E8F0'
                    : 'rgba(255,255,255,0.08)'
                  : isLight
                  ? '#D1FAE5'
                  : 'rgba(16, 185, 129, 0.2)',
                borderColor: loan.isSettled ? c.border : c.success,
              },
            ]}
          >
            <Ionicons
              name={loan.isSettled ? 'reload-outline' : 'checkmark'}
              size={12}
              color={loan.isSettled ? c.textMuted : c.success}
            />
            <Text
              style={[
                styles.settleBtnText,
                { color: loan.isSettled ? c.textMuted : c.success },
              ]}
            >
              {loan.isSettled ? 'Settled' : 'Settle'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Edit loan adjustment with ${loan.counterparty}`}
            onPress={() => onEdit(loan)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.iconActionBtn, { backgroundColor: c.card }]}
          >
            <Ionicons name="pencil" size={13} color={c.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Delete loan adjustment with ${loan.counterparty}`}
            onPress={() => onDelete(loan)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.iconActionBtn, { backgroundColor: c.card }]}
          >
            <Ionicons name="trash-outline" size={13} color={c.accent} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

LoanItemCard.displayName = 'LoanItemCard';
