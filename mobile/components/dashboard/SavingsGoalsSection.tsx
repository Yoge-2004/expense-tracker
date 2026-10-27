import React, { memo } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/theme';
import { AnimatedCard } from '../AnimatedCard';
import { AnimatedProgressBar } from '../AnimatedProgressBar';
import { StaggeredView } from '../StaggeredView';
import { dashboardStyles as styles } from './dashboardStyles';

export interface SavingsGoalItem {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  status?: string;
  isRecurring?: boolean;
  recurringAmount?: number;
  frequency?: string;
  intervalDays?: number;
}

export interface SavingsGoalsSectionProps {
  savingsGoals: SavingsGoalItem[];
  colors: ThemeColors;
  currSymbol: string;
  isStealthMode: boolean;
  isLargeScreen: boolean;
  onEditGoal: (goal: any) => void;
  onDeleteGoal: (goal: any) => void;
}

export const SavingsGoalsSection = memo(function SavingsGoalsSection({
  savingsGoals,
  colors: c,
  currSymbol,
  isStealthMode,
  isLargeScreen,
  onEditGoal,
  onDeleteGoal,
}: SavingsGoalsSectionProps) {
  if (savingsGoals.length === 0) return null;

  return (
    <StaggeredView delay={480} direction="up">
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Savings Goals</Text>
          <Text style={[styles.sectionSub, { color: c.textMuted }]}>
            Target milestones and asset accumulation
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
      >
        {savingsGoals.map((goal) => {
          const ratio =
            goal.targetAmount > 0
              ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
              : 0;
          return (
            <AnimatedCard
              key={goal.id}
              style={[
                styles.goalCard,
                { width: isLargeScreen ? 280 : 240, backgroundColor: c.card, borderColor: c.border },
              ]}
              scaleTo={0.96}
            >
              <View style={styles.goalTopRow}>
                <Text style={[styles.goalName, { color: c.text }]} numberOfLines={1}>
                  {goal.name}
                </Text>
                <Text
                  style={[
                    styles.goalPercent,
                    { color: ratio >= 100 ? c.success : c.primary },
                  ]}
                >
                  {ratio}%
                </Text>
              </View>
              <AnimatedProgressBar
                progress={ratio}
                height={7}
                backgroundColor={c.inputBg}
                fillColor={ratio >= 100 ? c.success : c.warning}
                style={{ borderRadius: 4, marginVertical: 8 }}
              />
              <View style={styles.goalBottomRow}>
                <Text style={[styles.goalSaved, { color: c.textMuted }]}>
                  {isStealthMode
                    ? `${currSymbol}•••••• / ${currSymbol}••••••`
                    : `${currSymbol}${Math.round(goal.currentAmount).toLocaleString('en-IN')} / ${currSymbol}${Math.round(goal.targetAmount).toLocaleString('en-IN')}`}
                </Text>
                <Text style={[styles.goalDate, { color: c.textMuted }]}>
                  Due: {goal.targetDate || 'Flexible'}
                </Text>
              </View>
              <View style={styles.goalActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onEditGoal(goal)}
                  style={[styles.goalMiniActionBtn, { backgroundColor: c.inputBg }]}
                  accessibilityLabel="Edit savings goal"
                >
                  <Ionicons name="pencil" size={12} color={c.warning} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onDeleteGoal(goal)}
                  style={[styles.goalMiniActionBtn, { backgroundColor: c.inputBg }]}
                  accessibilityLabel="Delete savings goal"
                >
                  <Ionicons name="trash-outline" size={12} color={c.accent} />
                </TouchableOpacity>
              </View>
            </AnimatedCard>
          );
        })}
      </ScrollView>
    </StaggeredView>
  );
});
