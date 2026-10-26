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
import { ChoiceChips } from '../ChoiceChips';
import { ThemeColors } from '../../constants/theme';
import { IncomeKind } from '../../utils/moneyFlow';
import { formStyles as styles } from './formStyles';

import { useIncomeForm } from '../../hooks/useIncomeForm';

export interface IncomeFormTabProps {
  colors: ThemeColors;
  currSymbol: string;
  categories: { id: number; name: string }[];
  onPickDate: () => void;
  form?: ReturnType<typeof useIncomeForm>;
  incomeSource?: string;
  setIncomeSource?: (val: string) => void;
  incomeAmount?: string;
  setIncomeAmount?: (val: string) => void;
  incomeDate?: string;
  incomeDesc?: string;
  setIncomeDesc?: (val: string) => void;
  incomeKind?: '' | IncomeKind;
  setIncomeKind?: (val: '' | IncomeKind) => void;
  incomeCountsToward?: string;
  setIncomeCountsToward?: (val: string) => void;
  incomeMonthOptions?: { value: string; label: string }[];
  incomeReimbursedCategoryId?: number | null;
  setIncomeReimbursedCategoryId?: (val: number | null) => void;
  incomeIsRecurring?: boolean;
  setIncomeIsRecurring?: (val: boolean) => void;
  incomeFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  setIncomeFrequency?: (val: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM') => void;
  incomeIntervalDays?: string;
  setIncomeIntervalDays?: (val: string) => void;
  focusedField?: string | null;
  setFocusedField?: (field: string | null) => void;
  handleSaveIncome?: () => void;
  isSubmitting?: boolean;
  isEditMode: boolean;
  editType?: string;
}

export const IncomeFormTab = memo(function IncomeFormTab(props: IncomeFormTabProps) {
  const { colors: c, currSymbol, categories, onPickDate, form, isEditMode, editType } = props;

  const incomeSource = props.incomeSource ?? form?.incomeSource ?? '';
  const setIncomeSource = props.setIncomeSource ?? form?.setIncomeSource ?? (() => {});
  const incomeAmount = props.incomeAmount ?? form?.incomeAmount ?? '';
  const setIncomeAmount = props.setIncomeAmount ?? form?.setIncomeAmount ?? (() => {});
  const incomeDate = props.incomeDate ?? form?.incomeDate ?? '';
  const incomeDesc = props.incomeDesc ?? form?.incomeDesc ?? '';
  const setIncomeDesc = props.setIncomeDesc ?? form?.setIncomeDesc ?? (() => {});
  const incomeKind = props.incomeKind !== undefined ? props.incomeKind : (form?.incomeKind ?? '');
  const setIncomeKind = props.setIncomeKind ?? form?.setIncomeKind ?? (() => {});
  const incomeCountsToward = props.incomeCountsToward ?? form?.incomeCountsToward ?? '';
  const setIncomeCountsToward = props.setIncomeCountsToward ?? form?.setIncomeCountsToward ?? (() => {});
  const incomeMonthOptions = props.incomeMonthOptions ?? form?.incomeMonthOptions ?? [];
  const incomeReimbursedCategoryId = props.incomeReimbursedCategoryId !== undefined ? props.incomeReimbursedCategoryId : (form?.incomeReimbursedCategoryId ?? null);
  const setIncomeReimbursedCategoryId = props.setIncomeReimbursedCategoryId ?? form?.setIncomeReimbursedCategoryId ?? (() => {});
  const incomeIsRecurring = props.incomeIsRecurring !== undefined ? props.incomeIsRecurring : (form?.incomeIsRecurring ?? false);
  const setIncomeIsRecurring = props.setIncomeIsRecurring ?? form?.setIncomeIsRecurring ?? (() => {});
  const incomeFrequency = props.incomeFrequency ?? form?.incomeFrequency ?? 'MONTHLY';
  const setIncomeFrequency = props.setIncomeFrequency ?? form?.setIncomeFrequency ?? (() => {});
  const incomeIntervalDays = props.incomeIntervalDays ?? form?.incomeIntervalDays ?? '1';
  const setIncomeIntervalDays = props.setIncomeIntervalDays ?? form?.setIncomeIntervalDays ?? (() => {});
  const focusedField = props.focusedField !== undefined ? props.focusedField : (form?.focusedField ?? null);
  const setFocusedField = props.setFocusedField ?? form?.setFocusedField ?? (() => {});
  const handleSaveIncome = props.handleSaveIncome ?? form?.handleSaveIncome ?? (() => {});
  const isSubmitting = props.isSubmitting !== undefined ? props.isSubmitting : (form?.isSubmitting ?? false);
  return (
    <StaggeredView delay={100} direction="up">
      <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Source / Payor</Text>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: c.inputBg,
                borderColor: focusedField === 'incomeSource' ? '#10B981' : c.border,
                borderWidth: focusedField === 'incomeSource' ? 2 : 1.5,
              },
            ]}
          >
            <Ionicons name="cash-outline" size={18} color="#10B981" style={styles.inputIcon} />
            <TextInput
              style={[styles.textInput, { color: c.text }]}
              placeholder="e.g. Primary Tech Salary, Consulting"
              placeholderTextColor={c.textMuted}
              value={incomeSource}
              onChangeText={setIncomeSource}
              onFocus={() => setFocusedField('incomeSource')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Amount ({currSymbol})</Text>
          <View style={[styles.amountInputWrap, { backgroundColor: c.inputBg, borderColor: c.border }]}>
            <Text style={[styles.currencyPrefix, { color: '#10B981' }]}>{currSymbol}</Text>
            <TextInput
              style={[styles.amountInput, { color: c.text }]}
              placeholder="0.00"
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={incomeAmount}
              onChangeText={setIncomeAmount}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Date Received (Tap to Pick)</Text>
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
              <Ionicons name="calendar" size={18} color="#10B981" style={styles.inputIcon} />
              <Text style={[{ fontSize: 14, fontWeight: '700', color: c.text }]}>
                {incomeDate || 'Select Date'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Description (Optional)</Text>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: c.inputBg,
                borderColor: focusedField === 'incomeDesc' ? '#10B981' : c.border,
                borderWidth: focusedField === 'incomeDesc' ? 2 : 1,
              },
            ]}
          >
            <Ionicons name="document-text-outline" size={18} color={c.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInput, { color: c.text }]}
              placeholder="e.g. Direct deposit from employer"
              placeholderTextColor={c.textMuted}
              value={incomeDesc}
              onChangeText={setIncomeDesc}
              onFocus={() => setFocusedField('incomeDesc')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Type</Text>
          <ChoiceChips
            options={[
              { value: '', label: 'Automatic' },
              { value: 'SALARY', label: 'Salary' },
              { value: 'OTHER', label: 'Other income' },
              { value: 'REIMBURSEMENT', label: 'Money back' },
            ]}
            value={incomeKind}
            onChange={(next) => {
              setIncomeKind(next as '' | IncomeKind);
              if (next === 'REIMBURSEMENT') setIncomeIsRecurring(false);
            }}
            colors={c}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Counts toward</Text>
          <ChoiceChips
            options={incomeMonthOptions}
            value={incomeCountsToward}
            onChange={setIncomeCountsToward}
            colors={c}
          />
        </View>

        {incomeKind === 'REIMBURSEMENT' && categories.length > 0 && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Pays back spending on</Text>
            <ChoiceChips
              options={[
                { value: 0, label: 'The month as a whole' },
                ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
              ]}
              value={incomeReimbursedCategoryId ?? 0}
              onChange={(next) => setIncomeReimbursedCategoryId(next === 0 ? null : next)}
              colors={c}
            />
          </View>
        )}

        <View style={[styles.fieldGroup, incomeKind === 'REIMBURSEMENT' && styles.hiddenGroup]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setIncomeIsRecurring(!incomeIsRecurring)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Ionicons
              name={incomeIsRecurring ? 'checkbox' : 'square-outline'}
              size={22}
              color={incomeIsRecurring ? '#10B981' : c.textMuted}
            />
            <Text style={{ color: c.text, fontWeight: '600', fontSize: 13.5 }}>
              Recurring Stream (e.g. Wages / Retainer)
            </Text>
          </TouchableOpacity>
        </View>

        {incomeIsRecurring && incomeKind !== 'REIMBURSEMENT' && (
          <View style={[styles.recurringBox, { backgroundColor: c.inputBg, borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
            <Text style={[styles.recurringBoxLabel, { color: '#10B981' }]}>PAYMENT CADENCE</Text>
            <View style={styles.freqRow}>
              {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as const).map((freq) => {
                const isSelected = incomeFrequency === freq;
                return (
                  <TouchableOpacity
                    key={freq}
                    activeOpacity={0.8}
                    onPress={() => setIncomeFrequency(freq)}
                    style={[
                      styles.freqChip,
                      {
                        backgroundColor: isSelected ? '#10B981' : c.card,
                        borderColor: isSelected ? '#10B981' : c.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.freqChipText,
                        {
                          color: isSelected ? '#FFFFFF' : c.textMuted,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {freq}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {incomeFrequency === 'CUSTOM' && (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Custom Interval (Days)</Text>
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
                  keyboardType="number-pad"
                  placeholder="e.g. 14, 30, 45"
                  placeholderTextColor={c.textMuted}
                  value={incomeIntervalDays}
                  onChangeText={setIncomeIntervalDays}
                />
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSaveIncome}
          disabled={isSubmitting}
          style={[styles.submitBtn, { backgroundColor: '#10B981', opacity: isSubmitting ? 0.7 : 1 }]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <View style={styles.submitBtnInner}>
              <Text style={[styles.submitBtnText, { color: '#FFF' }]}>
                {isEditMode && editType === 'income' ? 'Update Inflow' : 'Record Inflow'}
              </Text>
              <Ionicons name="arrow-down-circle" size={20} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </StaggeredView>
  );
});
