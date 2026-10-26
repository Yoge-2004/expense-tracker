import { useState, useEffect, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { apiRequest, ApiError } from '../services/api';
import { notifyTransactionRecorded, parseFinancialMessage, formatNotificationAmount } from '../services/notifications';
import { parseReceiptText, scanReceiptWithOcr, SAMPLE_RECEIPTS, ParsedReceipt } from '../services/receiptOcr';

export interface Category {
  id: number;
  name: string;
}

export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const y = Number.parseInt(yearStr, 10);
  const m = Number.parseInt(monthStr, 10);
  const d = Number.parseInt(dayStr, 10);

  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  const dateObj = new Date(y, m - 1, d);
  return dateObj.getFullYear() === y && dateObj.getMonth() === m - 1 && dateObj.getDate() === d;
}

export interface UseExpenseFormOptions {
  userId: number | null;
  currSymbol: string;
  categories: Category[];
  isEditMode: boolean;
  editId?: string;
  initialParams?: {
    description?: string;
    amount?: string;
    categoryId?: string;
    date?: string;
  };
  onSuccess: () => void;
  showAlert: (title: string, message: string, buttons?: any[], type?: any) => void;
}

export function useExpenseForm({
  userId,
  currSymbol,
  categories,
  isEditMode,
  editId,
  initialParams,
  onSuccess,
  showAlert,
}: UseExpenseFormOptions) {
  const [description, setDescription] = useState(initialParams?.description || '');
  const [amount, setAmount] = useState(initialParams?.amount || '');
  const [categoryId, setCategoryId] = useState<number | null>(
    initialParams?.categoryId ? Number(initialParams.categoryId) : null
  );
  const [expenseDate, setExpenseDate] = useState(
    initialParams?.date || new Date().toISOString().split('T')[0]
  );
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('MONTHLY');
  const [intervalDays, setIntervalDays] = useState('30');

  const [aiSuggestion, setAiSuggestion] = useState<{
    category: string;
    confidence: number;
    matchedCatId?: number;
    matchedCatName?: string;
  } | null>(null);
  const [isAiClassifying, setIsAiClassifying] = useState(false);
  const userOverrodeCategory = useRef(false);

  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrSuccessData, setOcrSuccessData] = useState<ParsedReceipt | null>(null);
  const [showSampleReceipts, setShowSampleReceipts] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync default category if empty
  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Sync initial params on edit or prefill change
  useEffect(() => {
    if (initialParams) {
      if (initialParams.description !== undefined) setDescription(initialParams.description);
      if (initialParams.amount !== undefined) setAmount(initialParams.amount);
      if (initialParams.categoryId !== undefined) {
        setCategoryId(Number(initialParams.categoryId));
      }
      if (initialParams.date !== undefined) setExpenseDate(initialParams.date);
    }
  }, [initialParams?.description, initialParams?.amount, initialParams?.categoryId, initialParams?.date]);

  // AI Classification Debounce
  useEffect(() => {
    if (isEditMode) return;
    const cleanDesc = description.trim();
    if (cleanDesc.length < 3) {
      setAiSuggestion(null);
      setIsAiClassifying(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsAiClassifying(true);
      try {
        const res = await apiRequest('/ml/classify', {
          method: 'POST',
          body: JSON.stringify({ description: cleanDesc, top_n: 3 }),
        });
        if (res && res.category) {
          const canonical = String(res.category);
          const conf = Number(res.confidence) || 0;
          const normCanonical = canonical.toLowerCase().replace(/[_-]/g, ' ');

          const matched = categories.find((cat) => {
            const name = (cat.name || '').toLowerCase().replace(/[_-]/g, ' ');
            return name === normCanonical || name.includes(normCanonical) || normCanonical.includes(name);
          });

          setAiSuggestion({
            category: canonical,
            confidence: conf,
            matchedCatId: matched?.id,
            matchedCatName: matched?.name,
          });

          if (!userOverrodeCategory.current && matched?.id && conf >= 0.65) {
            setCategoryId(matched.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }
      } catch (_) {
        // Silently skip if network or ML unavailable
      } finally {
        setIsAiClassifying(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [description, categories, isEditMode]);

  const toggleRecurring = useCallback((val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsRecurring(val);
  }, []);

  const applyReceiptData = useCallback(
    (parsed: ParsedReceipt) => {
      if (parsed.merchant && parsed.merchant !== 'Receipt Purchase') {
        setDescription(parsed.merchant);
      } else if (!description) {
        setDescription('Receipt Expense');
      }
      if (parsed.amount > 0) {
        setAmount(String(parsed.amount));
      }
      if (parsed.date) {
        setExpenseDate(parsed.date);
      }
      if (parsed.category && categories.length > 0) {
        const matched = categories.find(
          (c) => c.name.toLowerCase() === parsed.category.toLowerCase()
        );
        if (matched) {
          setCategoryId(matched.id);
        }
      }
      setOcrSuccessData(parsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert(
        'Receipt Scanned!',
        `Extracted: ${parsed.merchant} · ${currSymbol}${parsed.amount} (${parsed.confidence}% OCR confidence)`,
        undefined,
        'success'
      );
    },
    [description, categories, currSymbol, showAlert]
  );

  const handlePickReceipt = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const file = res.assets[0];
      setIsScanningOcr(true);
      const parsed = await scanReceiptWithOcr(file.uri, file.name, file.mimeType || 'image/png');
      applyReceiptData(parsed);
    } catch (err: any) {
      showAlert('OCR Scan Failed', err?.message || 'Unable to scan receipt document.');
    } finally {
      setIsScanningOcr(false);
    }
  }, [applyReceiptData, showAlert]);

  const handleTestSampleReceipt = useCallback(
    (idx: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setShowSampleReceipts(false);
      setIsScanningOcr(true);
      setTimeout(() => {
        const sample = SAMPLE_RECEIPTS[idx] || SAMPLE_RECEIPTS[0];
        const parsed = parseReceiptText(sample.text);
        applyReceiptData(parsed);
        setIsScanningOcr(false);
      }, 400);
    },
    [applyReceiptData]
  );

  const handlePasteBankSms = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const hasStr = await Clipboard.hasStringAsync();
      if (hasStr) {
        const text = await Clipboard.getStringAsync();
        if (text && text.trim().length > 0) {
          const parsed = parseFinancialMessage(text);
          if (parsed.isFinancial && parsed.amount && parsed.amount > 0) {
            if (parsed.direction === 'DEBIT') {
              setAmount(String(parsed.amount));
              const desc = parsed.merchant
                ? `${parsed.merchant}${parsed.accountTail ? ` (A/c xx${parsed.accountTail})` : ''}`
                : `Bank Debit${parsed.accountTail ? ` (A/c xx${parsed.accountTail})` : ''}`;
              setDescription(desc);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              const formattedParsedAmt = formatNotificationAmount(parsed.amount, parsed.currency, 2);
              showAlert(
                'Bank SMS Parsed! ⚡',
                `Pre-filled ${formattedParsedAmt} at ${parsed.merchant || 'Merchant'}.`,
                undefined,
                'success'
              );
              return;
            }
          }
        }
      }
      showAlert(
        'Paste Bank SMS',
        'Copy a bank SMS alert from your SMS app or notification drawer, then tap here to auto-fill amount, merchant, and details.',
        undefined,
        'info'
      );
    } catch (err: any) {
      showAlert('Could Not Read SMS', err?.message || 'Please check clipboard permissions.');
    }
  }, [showAlert]);

  const handleSmsDetectionInDesc = useCallback(
    (v: string) => {
      if (
        v.length > 25 &&
        (v.toLowerCase().includes('debited') ||
          v.toLowerCase().includes('spent') ||
          v.toLowerCase().includes('paid') ||
          v.toLowerCase().includes('inr') ||
          v.toLowerCase().includes('rs'))
      ) {
        const parsed = parseFinancialMessage(v);
        if (parsed && parsed.amount != null && parsed.amount > 0) {
          setDescription(parsed.merchant || 'Expense');
          setAmount(String(parsed.amount));
          if (parsed.timestamp) {
            setExpenseDate(new Date(parsed.timestamp).toISOString().split('T')[0]);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          showAlert(
            'SMS Auto-Detected!',
            `Extracted ${currSymbol}${parsed.amount} for ${parsed.merchant || 'Expense'}.`,
            undefined,
            'success'
          );
          return;
        }
      }
      setDescription(v);
      if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
    },
    [currSymbol, errors.description, showAlert]
  );

  const resetForm = useCallback(() => {
    setDescription('');
    setAmount('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setIsRecurring(false);
    setAiSuggestion(null);
    userOverrodeCategory.current = false;
    setErrors({});
  }, []);

  const handleSaveExpense = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const fieldErrors: Record<string, string> = {};

    const cleanDesc = description.trim();
    if (!cleanDesc) {
      fieldErrors.description = 'Description is required.';
    } else if (cleanDesc.length > 255) {
      fieldErrors.description = 'Description cannot exceed 255 characters.';
    }

    const cleanAmount = amount.trim();
    if (!cleanAmount) {
      fieldErrors.amount = 'Amount is required.';
    } else {
      const numAmount = Number.parseFloat(cleanAmount);
      if (Number.isNaN(numAmount) || numAmount <= 0) {
        fieldErrors.amount = 'Please enter a valid positive amount.';
      } else if (numAmount > 100000000) {
        fieldErrors.amount = 'Amount cannot exceed 100,000,000.';
      }
    }

    if (!categoryId) {
      fieldErrors.category = 'Please select a category.';
    }

    if (!expenseDate.trim() || !isValidDateString(expenseDate.trim())) {
      fieldErrors.date = 'Please enter a valid calendar date in YYYY-MM-DD format.';
    }

    if (isRecurring && frequency === 'CUSTOM') {
      const days = Number.parseInt(intervalDays.trim(), 10);
      if (Number.isNaN(days) || days < 1 || days > 365) {
        fieldErrors.intervalDays = 'Custom interval must be between 1 and 365 days.';
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      const firstError = Object.values(fieldErrors)[0];
      showAlert('Validation Error', firstError);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const numAmount = Number.parseFloat(cleanAmount);

      if (isEditMode && editId) {
        await apiRequest(`/expenses/${editId}/user/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({
            description: cleanDesc,
            amount: numAmount,
            categoryId,
            expenseDate: expenseDate.trim(),
          }),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert('Updated', 'Expense updated successfully.', [
          {
            text: 'OK',
            onPress: () => {
              resetForm();
              onSuccess();
            },
          },
        ]);
      } else {
        const payload: any = {
          description: cleanDesc,
          amount: numAmount,
          categoryId,
          expenseDate: expenseDate.trim(),
          isRecurring,
        };

        if (isRecurring) {
          payload.frequency = frequency;
          if (frequency === 'CUSTOM') {
            payload.intervalDays = Number.parseInt(intervalDays.trim(), 10);
          }
        }

        await apiRequest(`/expenses/user/${userId}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        notifyTransactionRecorded({
          kind: 'DEBIT',
          amount: numAmount,
          currency: currSymbol,
          label: categories.find((cat) => cat.id === categoryId)?.name ?? 'Expense',
          detail: cleanDesc,
        }).catch(() => {});

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert('🎉 Logged!', 'Transaction recorded successfully.', [
          { text: 'View Dashboard', onPress: onSuccess },
        ]);
        resetForm();
      }
    } catch (e: any) {
      const isApiErr = e instanceof ApiError;
      const msg = isApiErr ? e.message : 'Could not save expense transaction.';
      showAlert('Save Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    description,
    amount,
    categoryId,
    expenseDate,
    isRecurring,
    frequency,
    intervalDays,
    isEditMode,
    editId,
    userId,
    currSymbol,
    categories,
    resetForm,
    onSuccess,
    showAlert,
  ]);

  return {
    description,
    setDescription,
    amount,
    setAmount,
    categoryId,
    setCategoryId,
    expenseDate,
    setExpenseDate,
    isRecurring,
    toggleRecurring,
    frequency,
    setFrequency,
    intervalDays,
    setIntervalDays,
    aiSuggestion,
    isAiClassifying,
    userOverrodeCategory,
    isScanningOcr,
    ocrSuccessData,
    setOcrSuccessData,
    showSampleReceipts,
    setShowSampleReceipts,
    focusedField,
    setFocusedField,
    errors,
    setErrors,
    isSubmitting,
    applyReceiptData,
    handlePickReceipt,
    handleTestSampleReceipt,
    handlePasteBankSms,
    handleSmsDetectionInDesc,
    handleSaveExpense,
    resetForm,
  };
}
