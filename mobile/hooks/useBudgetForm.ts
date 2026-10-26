import { useState, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { apiRequest, ApiError } from '../services/api';

export interface UseBudgetFormOptions {
  userId: string | number | null;
  categories: { id: number; name: string }[];
  isEditMode: boolean;
  editId?: string;
  initialParams?: {
    categoryId?: string;
    amount?: string;
    period?: string;
    intervalDays?: string;
  };
  onSuccess: () => void;
  showAlert: (title: string, message: string, buttons?: any[], type?: any) => void;
}

export function useBudgetForm({
  userId,
  categories,
  isEditMode,
  initialParams,
  onSuccess,
  showAlert,
}: UseBudgetFormOptions) {
  const [budgetCategoryId, setBudgetCategoryId] = useState<number | null>(
    initialParams?.categoryId ? Number(initialParams.categoryId) : null
  );
  const [budgetLimit, setBudgetLimit] = useState(initialParams?.amount || '');
  const [budgetPeriod, setBudgetPeriod] = useState<string>(initialParams?.period || 'MONTHLY');
  const [budgetIntervalDays, setBudgetIntervalDays] = useState<string>(
    initialParams?.intervalDays || '30'
  );
  const [existingBudgets, setExistingBudgets] = useState<any[]>([]);
  const [isLoadingBudgets, setIsLoadingBudgets] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default to first category if unselected
  useEffect(() => {
    if (!budgetCategoryId && categories.length > 0) {
      setBudgetCategoryId(categories[0].id);
    }
  }, [categories, budgetCategoryId]);

  const loadExistingBudgets = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoadingBudgets(true);
      const data = await apiRequest(`/expenses/budget/status/user/${userId}`);
      if (Array.isArray(data)) {
        setExistingBudgets(data);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoadingBudgets(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadExistingBudgets();
  }, [loadExistingBudgets]);

  const resetForm = useCallback(() => {
    setBudgetLimit('');
    setBudgetPeriod('MONTHLY');
    setBudgetIntervalDays('30');
    setErrors({});
  }, []);

  const handleDeleteBudgetFromList = useCallback(
    (b: any) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      showAlert(
        'Delete Category Budget?',
        `Are you sure you want to remove the spending limit for ${b.categoryName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Budget',
            style: 'destructive',
            onPress: async () => {
              try {
                if (b.budgetId) {
                  await apiRequest(`/expenses/budget/${b.budgetId}`, { method: 'DELETE' });
                } else {
                  await apiRequest(
                    `/expenses/budget/user/${userId}/category/${b.categoryId}`,
                    { method: 'DELETE' }
                  );
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                showAlert(
                  'Budget Deleted',
                  'Category spending cap removed successfully.',
                  undefined,
                  'success'
                );
                void loadExistingBudgets();
              } catch (e: any) {
                const msg = e instanceof ApiError ? e.message : 'Could not delete budget.';
                showAlert('Delete Failed', msg, undefined, 'error');
              }
            },
          },
        ],
        'destructive'
      );
    },
    [userId, loadExistingBudgets, showAlert]
  );

  const handleSaveBudget = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const fieldErrors: Record<string, string> = {};

    if (!budgetCategoryId) {
      fieldErrors.budgetCategory = 'Please select a category for this budget.';
    }

    const cleanLimit = budgetLimit.trim();
    if (!cleanLimit) {
      fieldErrors.budgetLimit = 'Budget limit amount is required.';
    } else {
      const numLimit = Number.parseFloat(cleanLimit);
      if (Number.isNaN(numLimit) || numLimit <= 0) {
        fieldErrors.budgetLimit = 'Please enter a valid positive budget amount.';
      } else if (numLimit > 100000000) {
        fieldErrors.budgetLimit = 'Budget cap cannot exceed 100,000,000.';
      }
    }

    if (budgetPeriod === 'CUSTOM') {
      const days = Number.parseInt(budgetIntervalDays.trim(), 10);
      if (Number.isNaN(days) || days <= 0) {
        fieldErrors.budgetIntervalDays = 'Please enter a valid number of days.';
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
      const numLimit = Number.parseFloat(cleanLimit);
      const customDays =
        budgetPeriod === 'CUSTOM'
          ? Number.parseInt(budgetIntervalDays.trim(), 10) || 30
          : null;
      await apiRequest(`/expenses/budget/user/${userId}`, {
        method: 'POST',
        body: JSON.stringify({
          categoryId: budgetCategoryId,
          limitAmount: numLimit,
          limit: numLimit,
          period: budgetPeriod,
          intervalDays: customDays,
        }),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert(
        isEditMode ? '🎯 Budget Updated' : '🎯 Budget Saved',
        'Category spending cap saved successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              void loadExistingBudgets();
              if (isEditMode) onSuccess();
            },
          },
        ],
        'success'
      );
      if (!isEditMode) {
        setBudgetLimit('');
      }
    } catch (e: any) {
      const isApiErr = e instanceof ApiError;
      const msg = isApiErr ? e.message : 'Could not save category budget.';
      showAlert('Budget Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    budgetCategoryId,
    budgetLimit,
    budgetPeriod,
    budgetIntervalDays,
    isEditMode,
    userId,
    loadExistingBudgets,
    onSuccess,
    showAlert,
  ]);

  return {
    budgetCategoryId,
    setBudgetCategoryId,
    budgetLimit,
    setBudgetLimit,
    budgetPeriod,
    setBudgetPeriod,
    budgetIntervalDays,
    setBudgetIntervalDays,
    existingBudgets,
    isLoadingBudgets,
    loadExistingBudgets,
    errors,
    setErrors,
    isSubmitting,
    handleSaveBudget,
    handleDeleteBudgetFromList,
    resetForm,
  };
}
