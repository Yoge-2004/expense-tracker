import React, { memo } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ThemedTextInput as TextInput } from '../ThemedText';
import { ThemedText as Text } from '../ThemedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StaggeredView } from '../StaggeredView';
import { ThemeColors, getCategoryIconName } from '../../constants/theme';
import { formStyles as styles } from './formStyles';

import { useBudgetForm } from '../../hooks/useBudgetForm';

export interface BudgetFormTabProps {
  colors: ThemeColors;
  theme: 'dark' | 'light';
  currSymbol: string;
  categories: { id: number; name: string }[];
  form?: ReturnType<typeof useBudgetForm>;
  budgetCategoryId?: number | null;
  setBudgetCategoryId?: (val: number) => void;
  budgetLimit?: string;
  setBudgetLimit?: (val: string) => void;
  budgetPeriod?: string;
  setBudgetPeriod?: (val: string) => void;
  budgetIntervalDays?: string;
  setBudgetIntervalDays?: (val: string) => void;
  errors?: Record<string, string>;
  setErrors?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSaveBudget?: () => void;
  handleDeleteBudgetFromList?: (budget: any) => void;
  existingBudgets?: any[];
  isSubmitting?: boolean;
  isEditMode: boolean;
}

export const BudgetFormTab = memo(function BudgetFormTab(props: BudgetFormTabProps) {
  const { colors: c, theme, currSymbol, categories, form, isEditMode } = props;
  const isLight = theme === 'light';

  const budgetCategoryId = props.budgetCategoryId !== undefined ? props.budgetCategoryId : (form?.budgetCategoryId ?? null);
  const setBudgetCategoryId = props.setBudgetCategoryId ?? form?.setBudgetCategoryId ?? (() => {});
  const budgetLimit = props.budgetLimit ?? form?.budgetLimit ?? '';
  const setBudgetLimit = props.setBudgetLimit ?? form?.setBudgetLimit ?? (() => {});
  const budgetPeriod = props.budgetPeriod ?? form?.budgetPeriod ?? 'MONTHLY';
  const setBudgetPeriod = props.setBudgetPeriod ?? form?.setBudgetPeriod ?? (() => {});
  const budgetIntervalDays = props.budgetIntervalDays ?? form?.budgetIntervalDays ?? '30';
  const setBudgetIntervalDays = props.setBudgetIntervalDays ?? form?.setBudgetIntervalDays ?? (() => {});
  const errors = props.errors ?? form?.errors ?? {};
  const setErrors = props.setErrors ?? form?.setErrors ?? (() => {});
  const handleSaveBudget = props.handleSaveBudget ?? form?.handleSaveBudget ?? (() => {});
  const handleDeleteBudgetFromList = props.handleDeleteBudgetFromList ?? form?.handleDeleteBudgetFromList ?? (() => {});
  const existingBudgets = props.existingBudgets ?? form?.existingBudgets ?? [];
  const isSubmitting = props.isSubmitting !== undefined ? props.isSubmitting : (form?.isSubmitting ?? false);

  return (
    <StaggeredView delay={100} direction="up">
      <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
        {/* Category Selector */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Target Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChipsScroll}>
            {categories.map((cat) => {
              const isSelected = budgetCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setBudgetCategoryId(cat.id);
                    if (errors.budgetCategory) setErrors((prev) => ({ ...prev, budgetCategory: '' }));
                  }}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: isSelected ? c.primary : c.inputBg,
                      borderColor: isSelected ? c.primary : c.border,
                    },
                  ]}
                >
                  <Ionicons name={getCategoryIconName(cat.name)} size={14} color={isSelected ? (c.onPrimary) : c.primary} style={{ marginRight: 4 }} />
                  <Text
                    style={[
                      styles.catChipText,
                      {
                        color: isSelected ? (c.onPrimary) : c.text,
                        fontWeight: isSelected ? '800' : '600',
                      },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {!!errors.budgetCategory && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.budgetCategory}</Text>}
        </View>

        {/* Limit Input */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Monthly Spending Cap ({currSymbol})</Text>
          <View
            style={[
              styles.amountInputWrap,
              {
                backgroundColor: c.inputBg,
                borderColor: errors.budgetLimit ? c.accent : c.border,
              },
            ]}
          >
            <Text style={[styles.currencyPrefix, { color: c.primary }]}>{currSymbol}</Text>
            <TextInput
              style={[styles.amountInput, { color: c.text }]}
              placeholder="0.00"
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={budgetLimit}
              onChangeText={(v) => {
                setBudgetLimit(v);
                if (errors.budgetLimit) setErrors((prev) => ({ ...prev, budgetLimit: '' }));
              }}
            />
          </View>
          {!!errors.budgetLimit && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.budgetLimit}</Text>}
        </View>

        {/* Budget Period Selector */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Budget Period</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'MONTHLY', label: 'Monthly' },
              { id: 'WEEKLY', label: 'Weekly' },
              { id: 'YEARLY', label: 'Yearly' },
              { id: 'CUSTOM', label: 'Custom Interval' },
            ].map((p) => {
              const isSelected = budgetPeriod === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setBudgetPeriod(p.id);
                  }}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: isSelected ? c.primary : c.inputBg,
                      borderColor: isSelected ? c.primary : c.border,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      {
                        color: isSelected ? (c.onPrimary) : c.text,
                        fontWeight: isSelected ? '800' : '600',
                      },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Custom Number of Days */}
        {budgetPeriod === 'CUSTOM' && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Number of Days</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: c.inputBg,
                  borderColor: errors.budgetIntervalDays ? c.accent : c.border,
                  color: c.text,
                },
              ]}
              placeholder="e.g. 30"
              placeholderTextColor={c.textMuted}
              keyboardType="number-pad"
              value={budgetIntervalDays}
              onChangeText={(v) => {
                setBudgetIntervalDays(v);
                if (errors.budgetIntervalDays) setErrors((prev) => ({ ...prev, budgetIntervalDays: '' }));
              }}
            />
            {!!errors.budgetIntervalDays && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.budgetIntervalDays}</Text>}
          </View>
        )}

        {/* Submit Budget */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSaveBudget}
          disabled={isSubmitting}
          style={[
            styles.submitBtn,
            { backgroundColor: c.primary, opacity: isSubmitting ? 0.7 : 1 },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#10120E" />
          ) : (
            <View style={styles.submitBtnInner}>
              <Text style={[styles.submitBtnText, { color: c.onPrimary }]}>
                {isEditMode ? 'Update Budget Cap' : 'Establish Budget Cap'}
              </Text>
              <Ionicons name="shield-checkmark" size={20} color={c.onPrimary} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Existing Active Budgets List */}
      {existingBudgets.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: c.text, marginBottom: 12, fontSize: 16, fontWeight: '700' }}>
            Configured Category Budgets
          </Text>
          <View style={{ gap: 10 }}>
            {existingBudgets.map((b: any, idx: number) => {
              const limitVal = Number(b.limit || 0);
              const spentVal = Number(b.spent || 0);
              const pct = limitVal > 0 ? Math.min(Math.round((spentVal / limitVal) * 100), 100) : 0;
              return (
                <View
                  key={b.budgetId || b.categoryId || idx}
                  style={[
                    styles.formCard,
                    {
                      backgroundColor: c.card,
                      borderColor: c.border,
                      padding: 14,
                      marginBottom: 0,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Ionicons name={getCategoryIconName(b.categoryName)} size={18} color={c.primary} />
                      <View>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{b.categoryName}</Text>
                        <Text style={{ fontSize: 12, color: c.textMuted }}>
                          {b.period === 'CUSTOM' ? `${b.intervalDays || 30} Days` : b.period || 'Monthly'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setBudgetCategoryId(b.categoryId);
                          setBudgetLimit(String(b.limit || ''));
                          setBudgetPeriod(b.period || 'MONTHLY');
                          if (b.intervalDays) setBudgetIntervalDays(String(b.intervalDays));
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="pencil" size={16} color={c.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteBudgetFromList(b)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="trash-outline" size={16} color={c.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: c.textMuted }}>
                      {currSymbol}{Math.round(spentVal).toLocaleString()} spent
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: c.text }}>
                      {currSymbol}{Math.round(limitVal).toLocaleString()} limit ({pct}%)
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: c.inputBg, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 100 ? c.accent : pct >= 80 ? c.warning : c.primary }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </StaggeredView>
  );
});
