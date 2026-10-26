import { useState, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { apiRequest, ApiError } from '../services/api';

export interface UseSavingsGoalFormOptions {
  userId: number | null;
  currSymbol: string;
  isEditMode: boolean;
  editId?: string;
  initialParams?: {
    name?: string;
    targetAmount?: string;
    currentAmount?: string;
    targetDate?: string;
    isRecurring?: boolean;
    recurringAmount?: string;
    frequency?: string;
    intervalDays?: string;
  };
  onSuccess: () => void;
  showAlert: (title: string, message: string, buttons?: any[], type?: any) => void;
}

export function useSavingsGoalForm({
  userId,
  isEditMode,
  editId,
  initialParams,
  onSuccess,
  showAlert,
}: UseSavingsGoalFormOptions) {
  const defaultTargetDate = new Date();
  defaultTargetDate.setMonth(defaultTargetDate.getMonth() + 6);

  const [goalName, setGoalName] = useState(initialParams?.name || '');
  const [goalTargetAmount, setGoalTargetAmount] = useState(initialParams?.targetAmount || '');
  const [goalInitialAmount, setGoalInitialAmount] = useState(initialParams?.currentAmount || '');
  const [goalTargetDate, setGoalTargetDate] = useState(
    initialParams?.targetDate || defaultTargetDate.toISOString().split('T')[0]
  );
  const [goalIsRecurring, setGoalIsRecurring] = useState(initialParams?.isRecurring || false);
  const [goalRecurringAmount, setGoalRecurringAmount] = useState(initialParams?.recurringAmount || '');
  const [goalFrequency, setGoalFrequency] = useState(initialParams?.frequency || 'MONTHLY');
  const [goalIntervalDays, setGoalIntervalDays] = useState(initialParams?.intervalDays || '30');

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialParams) {
      if (initialParams.name !== undefined) setGoalName(initialParams.name);
      if (initialParams.targetAmount !== undefined) setGoalTargetAmount(initialParams.targetAmount);
      if (initialParams.currentAmount !== undefined) setGoalInitialAmount(initialParams.currentAmount);
      if (initialParams.targetDate !== undefined) setGoalTargetDate(initialParams.targetDate);
      if (initialParams.isRecurring !== undefined) setGoalIsRecurring(initialParams.isRecurring);
      if (initialParams.recurringAmount !== undefined)
        setGoalRecurringAmount(initialParams.recurringAmount);
      if (initialParams.frequency !== undefined) setGoalFrequency(initialParams.frequency);
      if (initialParams.intervalDays !== undefined) setGoalIntervalDays(initialParams.intervalDays);
    }
  }, [
    initialParams?.name,
    initialParams?.targetAmount,
    initialParams?.currentAmount,
    initialParams?.targetDate,
    initialParams?.isRecurring,
    initialParams?.recurringAmount,
    initialParams?.frequency,
    initialParams?.intervalDays,
  ]);

  const resetForm = useCallback(() => {
    setGoalName('');
    setGoalTargetAmount('');
    setGoalInitialAmount('');
    const newTarget = new Date();
    newTarget.setMonth(newTarget.getMonth() + 6);
    setGoalTargetDate(newTarget.toISOString().split('T')[0]);
    setGoalIsRecurring(false);
    setGoalRecurringAmount('');
    setGoalFrequency('MONTHLY');
    setGoalIntervalDays('30');
  }, []);

  const handleSaveSavingsGoal = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!goalName.trim()) {
      showAlert('Validation Error', 'Please provide a name for this savings milestone.');
      return;
    }
    const numTarget = Number.parseFloat(goalTargetAmount);
    if (Number.isNaN(numTarget) || numTarget <= 0) {
      showAlert('Validation Error', 'Please enter a valid positive target amount.');
      return;
    }
    const numCurrent = Number.parseFloat(goalInitialAmount || '0') || 0;
    const numRecurring = goalIsRecurring ? Number.parseFloat(goalRecurringAmount || '0') || 0 : 0;
    if (goalIsRecurring && numRecurring <= 0) {
      showAlert('Validation Error', 'Please specify a valid positive installment amount for your Chit/RD.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: goalName.trim(),
        targetAmount: numTarget,
        currentAmount: numCurrent,
        targetDate: goalTargetDate,
        isRecurring: goalIsRecurring,
        recurringAmount: goalIsRecurring ? numRecurring : null,
        frequency: goalIsRecurring ? goalFrequency : null,
        intervalDays:
          goalIsRecurring && goalFrequency === 'CUSTOM'
            ? Number.parseInt(goalIntervalDays, 10) || 30
            : null,
        nextDueDate: goalIsRecurring ? new Date().toISOString().split('T')[0] : null,
      };

      if (isEditMode && editId) {
        await apiRequest(`/savings/goals/${editId}/user/${userId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert('Goal Updated!', 'Savings milestone updated successfully.', [
          { text: 'View Dashboard', onPress: onSuccess },
        ]);
      } else {
        await apiRequest(`/savings/goals/user/${userId}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAlert(
          'Goal Configured!',
          goalIsRecurring
            ? 'Recurring Chit / RD plan activated successfully.'
            : 'Savings milestone configured successfully.',
          [{ text: 'View Dashboard', onPress: onSuccess }]
        );
      }
      resetForm();
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : 'Could not save savings goal.';
      showAlert('Save Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    goalName,
    goalTargetAmount,
    goalInitialAmount,
    goalIsRecurring,
    goalRecurringAmount,
    goalTargetDate,
    goalFrequency,
    goalIntervalDays,
    isEditMode,
    editId,
    userId,
    onSuccess,
    resetForm,
    showAlert,
  ]);

  return {
    goalName,
    setGoalName,
    goalTargetAmount,
    setGoalTargetAmount,
    goalInitialAmount,
    setGoalInitialAmount,
    goalTargetDate,
    setGoalTargetDate,
    goalIsRecurring,
    setGoalIsRecurring,
    goalRecurringAmount,
    setGoalRecurringAmount,
    goalFrequency,
    setGoalFrequency,
    goalIntervalDays,
    setGoalIntervalDays,
    focusedField,
    setFocusedField,
    isSubmitting,
    handleSaveSavingsGoal,
    resetForm,
  };
}
