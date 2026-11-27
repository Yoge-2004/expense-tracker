/**
 * @file QuickDepositModal.tsx
 * @description Accessible bottom sheet modal for quickly depositing an installment
 * towards a Chit Fund, Recurring Deposit, or Savings Goal directly from the Subscriptions screen.
 */

import React, { memo, useState, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text, ThemedTextInput as TextInput } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';
import { RecurringSavingsGoal } from './subscriptionsTypes';

export interface QuickDepositModalProps {
  goal: RecurringSavingsGoal | null;
  onClose: () => void;
  onDeposit: (goal: RecurringSavingsGoal, amount: number) => Promise<void>;
  currSym: string;
  colors: ThemeColors;
}

export const QuickDepositModal = memo(function QuickDepositModal({
  goal,
  onClose,
  onDeposit,
  currSym,
  colors: c,
}: QuickDepositModalProps) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setAmount(String(goal.recurringAmount || ''));
      setBusy(false);
      setErrorMsg(null);
    }
  }, [goal]);

  if (!goal) return null;

  const handleSave = async () => {
    const num = Number.parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      setErrorMsg('Please enter an amount greater than 0.');
      return;
    }
    setErrorMsg(null);
    setBusy(true);
    try {
      await onDeposit(goal, num);
    } catch (err) {
      setErrorMsg(err instanceof Error && err.message ? err.message : 'Failed to record deposit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={!!goal}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Record Chit / RD Installment</Text>
            <TouchableOpacity
              onPress={onClose}
              disabled={busy}
              style={styles.modalCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
            >
              <Ionicons name="close" size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalSub, { color: c.textMuted }]}>
            Contributing to <Text style={{ fontWeight: '700', color: c.text }}>{goal.name}</Text>
          </Text>

          <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: errorMsg ? c.danger : c.border }]}>
            <Text style={[styles.inputPrefix, { color: c.textMuted }]}>{currSym}</Text>
            <TextInput
              style={[styles.textInput, { color: c.text }]}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={c.textMuted}
              value={amount}
              onChangeText={(val) => {
                setAmount(val);
                if (errorMsg) setErrorMsg(null);
              }}
              autoFocus
            />
          </View>
          {errorMsg && (
            <Text style={{ color: c.danger, fontSize: 12, fontWeight: '600', marginTop: -12, marginBottom: 14 }}>
              {errorMsg}
            </Text>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: c.border }]}
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel deposit"
            >
              <Text style={[styles.modalCancelText, { color: c.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: c.warning }]}
              onPress={() => { void handleSave(); }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Deposit installment"
            >
              {busy ? (
                <ActivityIndicator size="small" color={c.onWarning} />
              ) : (
                <Text style={[styles.modalSaveText, { color: c.onWarning }]}>Deposit Installment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

QuickDepositModal.displayName = 'QuickDepositModal';

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSub: {
    fontSize: 13,
    marginBottom: 16,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    gap: 8,
  },
  inputPrefix: {
    fontSize: 18,
    fontWeight: '700',
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    padding: 0,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
