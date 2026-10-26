import React, { memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StaggeredView } from '../StaggeredView';
import { ThemeColors } from '../../constants/theme';
import { formStyles as styles } from './formStyles';

import { useSavingsGoalForm } from '../../hooks/useSavingsGoalForm';

export interface SavingsGoalFormTabProps {
  colors: ThemeColors;
  currSymbol: string;
  onPickDate: () => void;
  form?: ReturnType<typeof useSavingsGoalForm>;
  goalName?: string;
  setGoalName?: (val: string) => void;
  goalTargetAmount?: string;
  setGoalTargetAmount?: (val: string) => void;
  goalInitialAmount?: string;
  setGoalInitialAmount?: (val: string) => void;
  goalTargetDate?: string;
  goalIsRecurring?: boolean;
  setGoalIsRecurring?: (val: boolean) => void;
  goalRecurringAmount?: string;
  setGoalRecurringAmount?: (val: string) => void;
  goalFrequency?: string;
  setGoalFrequency?: (val: string) => void;
  goalIntervalDays?: string;
  setGoalIntervalDays?: (val: string) => void;
  focusedField?: string | null;
  setFocusedField?: (field: string | null) => void;
  handleSaveSavingsGoal?: () => void;
  isSubmitting?: boolean;
  isEditMode: boolean;
  editType?: string;
}

export const SavingsGoalFormTab = memo(function SavingsGoalFormTab(props: SavingsGoalFormTabProps) {
  const { colors: c, currSymbol, onPickDate, form, isEditMode, editType } = props;

  const goalName = props.goalName ?? form?.goalName ?? '';
  const setGoalName = props.setGoalName ?? form?.setGoalName ?? (() => {});
  const goalTargetAmount = props.goalTargetAmount ?? form?.goalTargetAmount ?? '';
  const setGoalTargetAmount = props.setGoalTargetAmount ?? form?.setGoalTargetAmount ?? (() => {});
  const goalInitialAmount = props.goalInitialAmount ?? form?.goalInitialAmount ?? '';
  const setGoalInitialAmount = props.setGoalInitialAmount ?? form?.setGoalInitialAmount ?? (() => {});
  const goalTargetDate = props.goalTargetDate ?? form?.goalTargetDate ?? '';
  const goalIsRecurring = props.goalIsRecurring !== undefined ? props.goalIsRecurring : (form?.goalIsRecurring ?? false);
  const setGoalIsRecurring = props.setGoalIsRecurring ?? form?.setGoalIsRecurring ?? (() => {});
  const goalRecurringAmount = props.goalRecurringAmount ?? form?.goalRecurringAmount ?? '';
  const setGoalRecurringAmount = props.setGoalRecurringAmount ?? form?.setGoalRecurringAmount ?? (() => {});
  const goalFrequency = props.goalFrequency ?? form?.goalFrequency ?? 'MONTHLY';
  const setGoalFrequency = props.setGoalFrequency ?? form?.setGoalFrequency ?? (() => {});
  const goalIntervalDays = props.goalIntervalDays ?? form?.goalIntervalDays ?? '30';
  const setGoalIntervalDays = props.setGoalIntervalDays ?? form?.setGoalIntervalDays ?? (() => {});
  const focusedField = props.focusedField !== undefined ? props.focusedField : (form?.focusedField ?? null);
  const setFocusedField = props.setFocusedField ?? form?.setFocusedField ?? (() => {});
  const handleSaveSavingsGoal = props.handleSaveSavingsGoal ?? form?.handleSaveSavingsGoal ?? (() => {});
  const isSubmitting = props.isSubmitting !== undefined ? props.isSubmitting : (form?.isSubmitting ?? false);
  return (
    <StaggeredView delay={100} direction="up">
      <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Milestone Name</Text>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: c.inputBg,
                borderColor: focusedField === 'goalName' ? '#F59E0B' : c.border,
                borderWidth: focusedField === 'goalName' ? 2 : 1.5,
              },
            ]}
          >
            <Ionicons name="flag-outline" size={18} color="#F59E0B" style={styles.inputIcon} />
            <TextInput
              style={[styles.textInput, { color: c.text }]}
              placeholder="e.g. Emergency Fund, Tesla Model Y"
              placeholderTextColor={c.textMuted}
              value={goalName}
              onChangeText={setGoalName}
              onFocus={() => setFocusedField('goalName')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Target Cap ({currSymbol})</Text>
          <View style={[styles.amountInputWrap, { backgroundColor: c.inputBg, borderColor: c.border }]}>
            <Text style={[styles.currencyPrefix, { color: '#F59E0B' }]}>{currSymbol}</Text>
            <TextInput
              style={[styles.amountInput, { color: c.text }]}
              placeholder="10000.00"
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={goalTargetAmount}
              onChangeText={setGoalTargetAmount}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Initial Balance Saved ({currSymbol})</Text>
          <View style={[styles.amountInputWrap, { backgroundColor: c.inputBg, borderColor: c.border }]}>
            <Text style={[styles.currencyPrefix, { color: c.textMuted }]}>{currSymbol}</Text>
            <TextInput
              style={[styles.amountInput, { color: c.text }]}
              placeholder="0.00"
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={goalInitialAmount}
              onChangeText={setGoalInitialAmount}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Target Due Date (Tap to Pick)</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPickDate}
            style={[
              styles.inputWrap,
              {
                backgroundColor: c.inputBg,
                borderColor: c.border,
                justifyContent: 'space-between',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Ionicons name="calendar" size={18} color="#F59E0B" style={styles.inputIcon} />
              <Text style={[{ fontSize: 14, fontWeight: '700', color: c.text }]}>
                {goalTargetDate || 'Select Date'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Recurring Chit / RD Switch */}
        <View style={[styles.recurringToggleRow, { backgroundColor: c.inputBg, borderColor: c.border }]}>
          <View style={styles.recurringToggleLeft}>
            <Ionicons name="shield-checkmark" size={20} color={goalIsRecurring ? '#F59E0B' : c.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.recurringTitle, { color: c.text }]}>Recurring Chit / Deposit</Text>
              <Text style={[styles.recurringSub, { color: c.textMuted }]}>
                Automate installment tracking for chits, RDs, or SIPs
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              const nextVal = !goalIsRecurring;
              setGoalIsRecurring(nextVal);
              if (nextVal && !goalRecurringAmount && goalTargetAmount) {
                setGoalRecurringAmount(String(Math.round(Number.parseFloat(goalTargetAmount) / 12) || ''));
              }
            }}
            style={[
              styles.togglePill,
              {
                backgroundColor: goalIsRecurring ? '#F59E0B' : c.card,
                borderColor: goalIsRecurring ? '#F59E0B' : c.border,
              },
            ]}
          >
            <View
              style={[
                styles.toggleKnob,
                {
                  backgroundColor: goalIsRecurring ? '#FFF' : c.textMuted,
                  transform: [{ translateX: goalIsRecurring ? 18 : 2 }],
                },
              ]}
            />
          </TouchableOpacity>
        </View>

        {/* Recurring Installment Configuration Panel */}
        {goalIsRecurring && (
          <View style={[styles.recurringBox, { backgroundColor: c.inputBg, borderColor: '#F59E0B40' }]}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: '#F59E0B' }]}>Installment Amount ({currSymbol})</Text>
              <View style={[styles.amountInputWrap, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.currencyPrefix, { color: '#F59E0B' }]}>{currSymbol}</Text>
                <TextInput
                  style={[styles.amountInput, { color: c.text }]}
                  placeholder="1000.00"
                  placeholderTextColor={c.textMuted}
                  keyboardType="decimal-pad"
                  value={goalRecurringAmount}
                  onChangeText={setGoalRecurringAmount}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.recurringBoxLabel, { color: c.textMuted }]}>DEPOSIT FREQUENCY</Text>
              <View style={styles.freqRow}>
                {['MONTHLY', 'WEEKLY', 'BI_WEEKLY', 'YEARLY', 'CUSTOM'].map((freq) => {
                  const isSel = goalFrequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setGoalFrequency(freq);
                      }}
                      style={[
                        styles.freqChip,
                        {
                          backgroundColor: isSel ? '#F59E0B' : c.card,
                          borderColor: isSel ? '#F59E0B' : c.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.freqChipText,
                          {
                            color: isSel ? '#FFF' : c.textMuted,
                            fontWeight: isSel ? '800' : '600',
                            fontSize: 11,
                          },
                        ]}
                      >
                        {freq.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {goalFrequency === 'CUSTOM' && (
              <View style={[styles.fieldGroup, { marginTop: 12 }]}>
                <Text style={[styles.recurringBoxLabel, { color: c.textMuted }]}>CUSTOM INTERVAL (DAYS)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.customDaysInput,
                    {
                      backgroundColor: c.card,
                      borderColor: c.border,
                      color: c.text,
                    },
                  ]}
                  placeholder="e.g. 30"
                  placeholderTextColor={c.textMuted}
                  keyboardType="number-pad"
                  value={goalIntervalDays}
                  onChangeText={setGoalIntervalDays}
                />
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSaveSavingsGoal}
          disabled={isSubmitting}
          style={[styles.submitBtn, { backgroundColor: '#F59E0B', opacity: isSubmitting ? 0.7 : 1 }]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <View style={styles.submitBtnInner}>
              <Text style={[styles.submitBtnText, { color: '#FFF' }]}>
                {isEditMode && editType === 'savings'
                  ? 'Update Milestone'
                  : goalIsRecurring
                  ? 'Activate Recurring Plan'
                  : 'Configure Milestone'}
              </Text>
              <Ionicons name="flag" size={20} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </StaggeredView>
  );
});
