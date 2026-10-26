import { useState, useEffect, useMemo, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { apiRequest, ApiError } from '../services/api';
import { notifyTransactionRecorded } from '../services/notifications';
import { IncomeKind, monthKey, monthLabel, shiftMonth } from '../utils/moneyFlow';

export interface UseIncomeFormOptions {
  userId: string | number | null;
  currSymbol: string;
  isEditMode: boolean;
  editId?: string;
  initialParams?: {
    source?: string;
    amount?: string;
    date?: string;
    description?: string;
    isRecurring?: boolean;
    frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
    intervalDays?: string;
    kind?: string;
    countsToward?: string;
    reimbursedCategoryId?: number | null;
  };
  onSuccess: () => void;
  showAlert: (title: string, message: string, buttons?: any[], type?: any) => void;
}

export function useIncomeForm({
  userId,
  currSymbol,
  isEditMode,
  editId,
  initialParams,
  onSuccess,
  showAlert,
}: UseIncomeFormOptions) {
  const [incomeSource, setIncomeSource] = useState(initialParams?.source || '');
  const [incomeAmount, setIncomeAmount] = useState(initialParams?.amount || '');
  const [incomeDate, setIncomeDate] = useState(
    initialParams?.date || new Date().toISOString().split('T')[0]
  );
  const [incomeDesc, setIncomeDesc] = useState(initialParams?.description || '');
  const [incomeIsRecurring, setIncomeIsRecurring] = useState(initialParams?.isRecurring || false);
  const [incomeFrequency, setIncomeFrequency] = useState<
    'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'
  >(initialParams?.frequency || 'MONTHLY');
  const [incomeIntervalDays, setIncomeIntervalDays] = useState(initialParams?.intervalDays || '1');
  const [incomeKind, setIncomeKind] = useState<'' | IncomeKind>(
    (initialParams?.kind as '' | IncomeKind) || ''
  );
  const [incomeCountsToward, setIncomeCountsToward] = useState(initialParams?.countsToward || '');
  const [incomeReimbursedCategoryId, setIncomeReimbursedCategoryId] = useState<number | null>(
    initialParams?.reimbursedCategoryId ?? null
  );

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialParams) {
      if (initialParams.source !== undefined) setIncomeSource(initialParams.source);
      if (initialParams.amount !== undefined) setIncomeAmount(initialParams.amount);
      if (initialParams.date !== undefined) setIncomeDate(initialParams.date);
      if (initialParams.description !== undefined) setIncomeDesc(initialParams.description);
      if (initialParams.isRecurring !== undefined) setIncomeIsRecurring(initialParams.isRecurring);
      if (initialParams.frequency !== undefined) setIncomeFrequency(initialParams.frequency);
      if (initialParams.intervalDays !== undefined) setIncomeIntervalDays(initialParams.intervalDays);
      if (initialParams.kind !== undefined) setIncomeKind((initialParams.kind as '' | IncomeKind) || '');
      if (initialParams.countsToward !== undefined) setIncomeCountsToward(initialParams.countsToward);
      if (initialParams.reimbursedCategoryId !== undefined)
        setIncomeReimbursedCategoryId(initialParams.reimbursedCategoryId);
    }
  }, [
    initialParams?.source,
    initialParams?.amount,
    initialParams?.date,
    initialParams?.description,
    initialParams?.isRecurring,
    initialParams?.frequency,
    initialParams?.intervalDays,
    initialParams?.kind,
    initialParams?.countsToward,
    initialParams?.reimbursedCategoryId,
  ]);

  const incomeMonthOptions = useMemo(() => {
    const base = monthKey(incomeDate) || monthKey(new Date());
    const next = shiftMonth(base, 1);
    const previous = shiftMonth(base, -1);
    const options = [
      { value: '', label: `Same month (${monthLabel(base)})` },
      { value: next, label: `Next month (${monthLabel(next)})` },
      { value: previous, label: `Previous month (${monthLabel(previous)})` },
    ];
    if (incomeCountsToward && !options.some((o) => o.value === incomeCountsToward)) {
      options.push({ value: incomeCountsToward, label: monthLabel(incomeCountsToward) });
    }
    return options;
  }, [incomeDate, incomeCountsToward]);

  const resetForm = useCallback(() => {
    setIncomeSource('');
    setIncomeAmount('');
    setIncomeDate(new Date().toISOString().split('T')[0]);
    setIncomeDesc('');
    setIncomeIsRecurring(false);
    setIncomeFrequency('MONTHLY');
    setIncomeIntervalDays('1');
    setIncomeKind('');
    setIncomeCountsToward('');
    setIncomeReimbursedCategoryId(null);
  }, []);

  const handleSaveIncome = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!incomeSource.trim()) {
      showAlert('Validation Error', 'Please provide the income source or payor name.');
      return;
    }
    const numAmt = Number.parseFloat(incomeAmount);
    if (Number.isNaN(numAmt) || numAmt <= 0) {
      showAlert('Validation Error', 'Please enter a valid positive income amount.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        source: incomeSource.trim(),
        amount: numAmt,
        incomeDate: incomeDate,
        description: incomeDesc.trim(),
        isRecurring: incomeKind === 'REIMBURSEMENT' ? false : incomeIsRecurring,
        frequency: incomeIsRecurring ? incomeFrequency : null,
        intervalDays:
          incomeIsRecurring && incomeFrequency === 'CUSTOM'
            ? Number.parseInt(incomeIntervalDays, 10) || 1
            : null,
        kind: incomeKind,
        countsTowardMonth: incomeCountsToward,
        reimbursedCategoryId: incomeKind === 'REIMBURSEMENT' ? incomeReimbursedCategoryId ?? 0 : 0,
      };

      if (isEditMode && editId) {
        await apiRequest(`/incomes/${editId}/user/${userId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert('Updated!', 'Income stream updated successfully.', [
          { text: 'View Dashboard', onPress: onSuccess },
        ]);
      } else {
        await apiRequest(`/incomes/user/${userId}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notifyTransactionRecorded({
          kind: 'CREDIT',
          amount: numAmt,
          currency: currSymbol,
          label: incomeSource.trim(),
          detail: incomeDesc.trim() || undefined,
        }).catch(() => {});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert('Recorded!', 'Income stream logged successfully.', [
          { text: 'View Dashboard', onPress: onSuccess },
        ]);
      }
      resetForm();
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : 'Could not save income record.';
      showAlert('Save Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    incomeSource,
    incomeAmount,
    incomeDate,
    incomeDesc,
    incomeKind,
    incomeIsRecurring,
    incomeFrequency,
    incomeIntervalDays,
    incomeCountsToward,
    incomeReimbursedCategoryId,
    isEditMode,
    editId,
    userId,
    currSymbol,
    onSuccess,
    resetForm,
    showAlert,
  ]);

  return {
    incomeSource,
    setIncomeSource,
    incomeAmount,
    setIncomeAmount,
    incomeDate,
    setIncomeDate,
    incomeDesc,
    setIncomeDesc,
    incomeKind,
    setIncomeKind,
    incomeCountsToward,
    setIncomeCountsToward,
    incomeMonthOptions,
    incomeReimbursedCategoryId,
    setIncomeReimbursedCategoryId,
    incomeIsRecurring,
    setIncomeIsRecurring,
    incomeFrequency,
    setIncomeFrequency,
    incomeIntervalDays,
    setIncomeIntervalDays,
    focusedField,
    setFocusedField,
    isSubmitting,
    handleSaveIncome,
    resetForm,
  };
}
