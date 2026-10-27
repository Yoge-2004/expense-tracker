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
import { SampleReceiptsPicker } from '../SampleReceiptsPicker';
import { ParsedReceipt } from '../../services/receiptOcr';
import { formStyles as styles } from './formStyles';

import { useExpenseForm } from '../../hooks/useExpenseForm';

export interface ExpenseFormTabProps {
  colors: ThemeColors;
  theme: 'dark' | 'light';
  currSymbol: string;
  categories: { id: number; name: string }[];
  onOpenManageCategories: () => void;
  onPickDate: () => void;
  form?: ReturnType<typeof useExpenseForm>;
  description?: string;
  setDescription?: (val: string) => void;
  amount?: string;
  setAmount?: (val: string) => void;
  categoryId?: number | null;
  setCategoryId?: (val: number | null) => void;
  expenseDate?: string;
  isRecurring?: boolean;
  toggleRecurring?: (val: boolean) => void;
  frequency?: string;
  setFrequency?: (val: string) => void;
  intervalDays?: string;
  setIntervalDays?: (val: string) => void;
  aiSuggestion?: {
    category: string;
    confidence: number;
    matchedCatId?: number;
    matchedCatName?: string;
  } | null;
  isAiClassifying?: boolean;
  merchantSuggestions?: { merchant: string; similarity: number }[];
  isMatchingMerchant?: boolean;
  duplicateMatch?: { text: string; similarity: number } | null;
  isCheckingDuplicates?: boolean;
  applyMerchantSuggestion?: (merchant: string) => void;
  userOverrodeCategory?: { current: boolean };
  isScanningOcr?: boolean;
  ocrSuccessData?: ParsedReceipt | null;
  setOcrSuccessData?: (data: ParsedReceipt | null) => void;
  showSampleReceipts?: boolean;
  setShowSampleReceipts?: (show: boolean) => void;
  handlePickReceipt?: () => void;
  handlePasteBankSms?: () => void;
  handleTestSampleReceipt?: (receipt: any) => void;
  handleSmsDetectionInDesc?: (text: string) => void;
  focusedField?: string | null;
  setFocusedField?: (field: string | null) => void;
  errors?: Record<string, string>;
  setErrors?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSaveExpense?: () => void;
  isSubmitting?: boolean;
  isEditMode: boolean;
}

export const ExpenseFormTab = memo(function ExpenseFormTab(props: ExpenseFormTabProps) {
  const {
    colors: c,
    theme,
    currSymbol,
    categories,
    onOpenManageCategories,
    onPickDate,
    form,
    isEditMode,
  } = props;
  const isLight = theme === 'light';

  const description = props.description ?? form?.description ?? '';
  const setDescription = props.setDescription ?? form?.setDescription ?? (() => {});
  const amount = props.amount ?? form?.amount ?? '';
  const setAmount = props.setAmount ?? form?.setAmount ?? (() => {});
  const categoryId = props.categoryId !== undefined ? props.categoryId : (form?.categoryId ?? null);
  const setCategoryId = props.setCategoryId ?? form?.setCategoryId ?? (() => {});
  const expenseDate = props.expenseDate ?? form?.expenseDate ?? '';
  const isRecurring = props.isRecurring !== undefined ? props.isRecurring : (form?.isRecurring ?? false);
  const toggleRecurring = props.toggleRecurring ?? form?.toggleRecurring ?? (() => {});
  const frequency = props.frequency ?? form?.frequency ?? 'MONTHLY';
  const setFrequency = props.setFrequency ?? form?.setFrequency ?? (() => {});
  const intervalDays = props.intervalDays ?? form?.intervalDays ?? '30';
  const setIntervalDays = props.setIntervalDays ?? form?.setIntervalDays ?? (() => {});
  const aiSuggestion = props.aiSuggestion !== undefined ? props.aiSuggestion : (form?.aiSuggestion ?? null);
  const isAiClassifying = props.isAiClassifying !== undefined ? props.isAiClassifying : (form?.isAiClassifying ?? false);
  const merchantSuggestions = props.merchantSuggestions ?? form?.merchantSuggestions ?? [];
  const duplicateMatch = props.duplicateMatch !== undefined ? props.duplicateMatch : (form?.duplicateMatch ?? null);
  const applyMerchantSuggestion = props.applyMerchantSuggestion ?? form?.applyMerchantSuggestion ?? ((m: string) => setDescription(m));
  const userOverrodeCategory = props.userOverrodeCategory ?? form?.userOverrodeCategory ?? { current: false };
  const isScanningOcr = props.isScanningOcr !== undefined ? props.isScanningOcr : (form?.isScanningOcr ?? false);
  const ocrSuccessData = props.ocrSuccessData !== undefined ? props.ocrSuccessData : (form?.ocrSuccessData ?? null);
  const setOcrSuccessData = props.setOcrSuccessData ?? form?.setOcrSuccessData ?? (() => {});
  const showSampleReceipts = props.showSampleReceipts !== undefined ? props.showSampleReceipts : (form?.showSampleReceipts ?? false);
  const setShowSampleReceipts = props.setShowSampleReceipts ?? form?.setShowSampleReceipts ?? (() => {});
  const handlePickReceipt = props.handlePickReceipt ?? form?.handlePickReceipt ?? (() => {});
  const handlePasteBankSms = props.handlePasteBankSms ?? form?.handlePasteBankSms ?? (() => {});
  const handleTestSampleReceipt = props.handleTestSampleReceipt ?? form?.handleTestSampleReceipt ?? (() => {});
  const handleSmsDetectionInDesc = props.handleSmsDetectionInDesc ?? form?.handleSmsDetectionInDesc ?? ((v: string) => setDescription(v));
  const focusedField = props.focusedField !== undefined ? props.focusedField : (form?.focusedField ?? null);
  const setFocusedField = props.setFocusedField ?? form?.setFocusedField ?? (() => {});
  const errors = props.errors ?? form?.errors ?? {};
  const setErrors = props.setErrors ?? form?.setErrors ?? (() => {});
  const handleSaveExpense = props.handleSaveExpense ?? form?.handleSaveExpense ?? (() => {});
  const isSubmitting = props.isSubmitting !== undefined ? props.isSubmitting : (form?.isSubmitting ?? false);

  return (
    <StaggeredView delay={100} direction="up">
      <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
        {/* Receipt OCR Scanner Banner */}
        <View
          style={{
            backgroundColor: c.primary + (isLight ? '14' : '1F'),
            borderColor: c.primary + '55',
            borderWidth: 1.5,
            borderRadius: 14,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <View style={{ gap: 10, alignItems: 'stretch', width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', minWidth: 0 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: c.primary + '2E',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="scan-outline" size={20} color={c.primary} />
              </View>
              <View style={{ flex: 1, flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: c.text }}>Receipt OCR Scanner</Text>
                <Text style={{ fontSize: 11, color: c.textMuted, flexShrink: 1 }}>Scan bill photo or choose sample receipt to auto-fill</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 46, alignSelf: 'stretch' }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowSampleReceipts(!showSampleReceipts)}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 7,
                  borderRadius: 8,
                  backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: c.primary }}>Sample</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePasteBankSms}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 8,
                  backgroundColor: c.primary + '26',
                  borderWidth: 1,
                  borderColor: c.primary + '55',
                }}
              >
                <Ionicons name="flash-outline" size={14} color={c.primary} />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: c.primary }}>Paste SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePickReceipt}
                disabled={isScanningOcr}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 8,
                  backgroundColor: c.primary,
                  opacity: isScanningOcr ? 0.7 : 1,
                }}
              >
                {isScanningOcr ? (
                  <ActivityIndicator size="small" color={c.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={14} color={c.onPrimary} />
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: c.onPrimary }}>Scan Bill</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Sample Receipts Quick Selector */}
          <SampleReceiptsPicker visible={showSampleReceipts} onSelect={handleTestSampleReceipt} colors={c} />

          {/* Extracted Details & Interactive Breakdown Chips */}
          {ocrSuccessData && (
            <View
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: c.border,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="sparkles" size={12} color={c.success} />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: c.success }}>{ocrSuccessData.merchant} · {currSymbol}{ocrSuccessData.amount} ({ocrSuccessData.confidence}% confidence)</Text>
                </View>
                <TouchableOpacity onPress={() => setOcrSuccessData(null)}>
                  <Ionicons name="close" size={14} color={c.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Breakdown Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {ocrSuccessData.breakdown.grandTotal ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setAmount(String(ocrSuccessData.breakdown.grandTotal))}
                    style={{
                      backgroundColor: amount === String(ocrSuccessData.breakdown.grandTotal) ? c.primary : c.inputBg,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: '700',
                        color: amount === String(ocrSuccessData.breakdown.grandTotal) ? (isLight ? '#FFF' : '#000') : c.text,
                      }}
                    >
                      Total: {currSymbol}{ocrSuccessData.breakdown.grandTotal}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {ocrSuccessData.breakdown.subtotal ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setAmount(String(ocrSuccessData.breakdown.subtotal))}
                    style={{
                      backgroundColor: amount === String(ocrSuccessData.breakdown.subtotal) ? c.primary : c.inputBg,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: '700',
                        color: amount === String(ocrSuccessData.breakdown.subtotal) ? (isLight ? '#FFF' : '#000') : c.text,
                      }}
                    >
                      Subtotal: {currSymbol}{ocrSuccessData.breakdown.subtotal}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {ocrSuccessData.breakdown.totalTax ? (
                  <View
                    style={{
                      backgroundColor: c.inputBg,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <Text style={{ fontSize: 10.5, color: c.textMuted }}>
                      Tax/GST: {currSymbol}{ocrSuccessData.breakdown.totalTax}
                    </Text>
                  </View>
                ) : null}

                {ocrSuccessData.breakdown.discount ? (
                  <View
                    style={{
                      backgroundColor: c.inputBg,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <Text style={{ fontSize: 10.5, color: c.success }}>
                      Discount: -{currSymbol}{ocrSuccessData.breakdown.discount}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Description Input */}
        <View style={styles.fieldGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.fieldLabel, { color: c.textMuted, marginBottom: 0 }]}>Description / Merchant</Text>
            {isAiClassifying ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ActivityIndicator size="small" color={c.primary} />
                <Text style={{ fontSize: 10.5, color: c.textMuted, fontWeight: '600' }}>AI Classifying...</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="flash" size={11} color={c.primary} /><Text style={{ fontSize: 10.5, color: c.primary, fontWeight: '700' }}>AI Categorizer</Text></View>
            )}
          </View>
          <View
            style={[
              styles.inputWrap,
              {
backgroundColor: c.inputBg,
                borderColor: errors.description ? c.accent : c.primary,
                borderWidth: focusedField === 'expenseDesc' ? 2 : 1.5,
              },
            ]}
          >
            <Ionicons
              name="pencil-outline"
              size={18}
              color={errors.description ? c.accent : c.primary}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: c.text }]}
              placeholder="e.g. Blue Tokai Coffee, Figma Plan"
              placeholderTextColor={c.textMuted}
              value={description}
              maxLength={255}
              onChangeText={(v) => {
                handleSmsDetectionInDesc(v);
              }}
              onFocus={() => setFocusedField('expenseDesc')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {!!errors.description && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.description}</Text>}

          {/* Model 2: Vector Merchant Matcher Suggestions */}
          {merchantSuggestions && merchantSuggestions.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
                <Text style={{ fontSize: 10.5, color: c.textMuted, fontWeight: '600' }}>Matched:</Text>
                {merchantSuggestions.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.75}
                    onPress={() => applyMerchantSuggestion(item.merchant)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: c.primary + '1F',
                      borderColor: c.primary + '55',
                      borderWidth: 1,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={12} color={c.primary} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: c.text }}>{item.merchant}</Text>
                    <Text style={{ fontSize: 9.5, color: c.primary, fontWeight: '800' }}>{Math.round(item.similarity * 100)}%</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Model 1: Classifier Suggestion Pill */}
          {aiSuggestion && (
            <View
              style={{
                backgroundColor: c.primary + '1A',
                borderColor: c.primary + '4D',
                borderWidth: 1,
                borderRadius: 12,
                padding: 10,
                marginTop: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                  <Ionicons name="flash" size={13} color={c.primary} />
                  <Text style={[styles.fieldLabel, { color: c.textMuted, marginBottom: 0 }]}>AI Suggestion:</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.primary }}>
                    <Ionicons name={getCategoryIconName(aiSuggestion.matchedCatName || aiSuggestion.category)} size={13} color={c.primary} style={{ marginRight: 4 }} />
                    {aiSuggestion.matchedCatName ||
                      aiSuggestion.category.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
                  </Text>
                  <View
                    style={{
                      backgroundColor: isLight ? '#E0EDDC' : 'rgba(91, 140, 90, 0.2)',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#5B8C5A' }}>
                      {Math.round(aiSuggestion.confidence * 100)}% match
                    </Text>
                  </View>
                </View>
                {aiSuggestion.matchedCatId && categoryId !== aiSuggestion.matchedCatId && (
                  <TouchableOpacity
                    onPress={() => {
                      if (aiSuggestion.matchedCatId) {
                        setCategoryId(aiSuggestion.matchedCatId);
                        userOverrodeCategory.current = false;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      }
                    }}
                    style={{
                      backgroundColor: c.primary,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: c.onPrimary }}>Apply</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Model 3: Duplicate Transaction Similarity Alert */}
          {duplicateMatch && (
            <View
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                borderColor: 'rgba(245, 158, 11, 0.35)',
                borderWidth: 1,
                borderRadius: 10,
                padding: 10,
                marginTop: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="warning-outline" size={18} color={c.warning} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: c.warning }}>
                  Similar Transaction Detected ({Math.round(duplicateMatch.similarity * 100)}% Match)
                </Text>
                <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>
                  "{duplicateMatch.text}" recorded recently with matching amount.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Amount Input */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Amount ({currSymbol})</Text>
          <View
            style={[
              styles.amountInputWrap,
              {
                backgroundColor: c.inputBg,
                borderColor: errors.amount ? c.accent : c.border,
              },
            ]}
          >
            <Text style={[styles.currencyPrefix, { color: c.primary }]}>{currSymbol}</Text>
            <TextInput
              style={[styles.amountInput, { color: c.text }]}
              placeholder="0.00"
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(v) => {
                setAmount(v);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
              }}
            />
          </View>
          {!!errors.amount && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.amount}</Text>}
        </View>

        {/* Category Selector */}
        <View style={styles.fieldGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.fieldLabel, { color: c.textMuted, marginBottom: 0 }]}>Category</Text>
            <TouchableOpacity onPress={onOpenManageCategories} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="settings-outline" size={13} color={c.primary} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: c.primary }}>Manage</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChipsScroll}>
            {categories.map((cat) => {
              const isSelected = categoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    userOverrodeCategory.current = true;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setCategoryId(cat.id);
                    if (errors.category) setErrors((prev) => ({ ...prev, category: '' }));
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
        </View>

        {/* Date Input */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Date (Tap to Pick)</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPickDate}
            style={[
              styles.inputWrap,
              {
                backgroundColor: c.inputBg,
                borderColor: errors.date ? c.accent : c.border,
                justifyContent: 'space-between',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Ionicons name="calendar" size={18} color={c.primary} style={styles.inputIcon} />
              <Text style={[{ fontSize: 14, fontWeight: '700', color: c.text }]}>
                {expenseDate || 'Select Date'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </TouchableOpacity>
          {!!errors.date && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.date}</Text>}
        </View>

        {/* Recurring Switch */}
        {!isEditMode && (
          <View style={[styles.recurringToggleRow, { backgroundColor: c.inputBg, borderColor: c.border }]}>
            <View style={styles.recurringToggleLeft}>
              <Ionicons name="repeat" size={20} color={isRecurring ? c.primary : c.textMuted} />
              <View>
                <Text style={[styles.recurringTitle, { color: c.text }]}>Recurring Commitment</Text>
                <Text style={[styles.recurringSub, { color: c.textMuted }]}>Auto-generate subscription run-rate</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                toggleRecurring(!isRecurring);
              }}
              style={[
                styles.togglePill,
                {
                  backgroundColor: isRecurring ? c.primary : c.card,
                  borderColor: isRecurring ? c.primary : c.border,
                },
              ]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  {
                    backgroundColor: isRecurring ? (c.onPrimary) : c.textMuted,
                    transform: [{ translateX: isRecurring ? 18 : 2 }],
                  },
                ]}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Recurring Interval Configuration Panel */}
        {isRecurring && !isEditMode && (
          <View style={[styles.recurringBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
            <Text style={[styles.recurringBoxLabel, { color: c.textMuted }]}>BILLING FREQUENCY</Text>
            <View style={styles.freqRow}>
              {['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'].map((freq) => {
                const isSelected = frequency === freq;
                return (
                  <TouchableOpacity
                    key={freq}
                    activeOpacity={0.8}
                    onPress={() => setFrequency(freq)}
                    style={[
                      styles.freqChip,
                      {
                        backgroundColor: isSelected ? c.primary : c.card,
                        borderColor: isSelected ? c.primary : c.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.freqChipText,
                        {
                          color: isSelected ? (c.onPrimary) : c.textMuted,
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

            {frequency === 'CUSTOM' && (
<View style={{ marginTop: 10 }}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Custom Cycle (in Days)</Text>
                <TextInput
                  style={[
                    styles.customDaysInput,
                    {
                      backgroundColor: c.card,
                      borderColor: errors.intervalDays ? c.accent : c.border,
                      color: c.text,
                    },
                  ]}
                  keyboardType="number-pad"
                  placeholder="e.g. 14, 45, 90"
                  placeholderTextColor={c.textMuted}
                  value={intervalDays}
                  onChangeText={(v) => {
                    setIntervalDays(v);
                    if (errors.intervalDays) setErrors((prev) => ({ ...prev, intervalDays: '' }));
                  }}
                />
                {!!errors.intervalDays && <Text style={[styles.errorMsg, { color: c.accent }]}>{errors.intervalDays}</Text>}
              </View>
            )}
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSaveExpense}
          disabled={isSubmitting}
          style={[styles.submitBtn, { backgroundColor: c.primary, opacity: isSubmitting ? 0.7 : 1 }]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#10120E" />
          ) : (
            <View style={styles.submitBtnInner}>
              <Text style={[styles.submitBtnText, { color: c.onPrimary }]}>
                {isEditMode ? 'Update Expense' : 'Log Transaction'}
              </Text>
              <Ionicons
                name={isEditMode ? 'checkmark-circle' : 'add-circle'}
                size={20}
                color={c.onPrimary}
              />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </StaggeredView>
  );
});
