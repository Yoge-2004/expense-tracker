/**
 * @file DeleteAccountModal.tsx
 * @description Safe permanent account deletion dialog.
 * Requires explicit typed confirmation of "DELETE" and password validation
 * to protect against accidental financial data loss.
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

export interface DeleteAccountModalProps {
  visible: boolean;
  colors: ThemeColors;
  isDeleting: boolean;
  onClose: () => void;
  onDeleteAccount: (password: string) => Promise<void>;
}

export const DeleteAccountModal = memo(function DeleteAccountModal({
  visible,
  colors: c,
  isDeleting,
  onClose,
  onDeleteAccount,
}: DeleteAccountModalProps) {
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    if (visible) {
      setDeleteConfirmText('');
      setDeletePassword('');
    }
  }, [visible]);

  const isFormValid =
    deleteConfirmText.trim() === 'DELETE' && deletePassword.trim().length > 0;

  const handleDelete = async () => {
    if (!isFormValid || isDeleting) return;
    await onDeleteAccount(deletePassword.trim());
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.deleteModalCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[styles.deleteIconBox, { backgroundColor: c.accent + '20' }]}>
            <Ionicons name="warning" size={32} color={c.accent} />
          </View>

          <Text style={[styles.deleteModalTitle, { color: c.text }]}>Permanently Delete Account?</Text>
          <Text style={[styles.deleteModalDesc, { color: c.textMuted }]}>
            This action cannot be undone. All your expenses, budgets, recurring subscriptions, and categories will be permanently erased.
          </Text>

          <Text style={[styles.deleteConfirmLabel, { color: c.text }]}>
            Enter your current account password:
          </Text>
          <TextInput
            style={[
              styles.deleteInput,
              { backgroundColor: c.inputBg, borderColor: c.border, color: c.text, marginBottom: 12 },
            ]}
            placeholder="Current Password"
            placeholderTextColor={c.textMuted}
            secureTextEntry={true}
            value={deletePassword}
            onChangeText={setDeletePassword}
          />

          <Text style={[styles.deleteConfirmLabel, { color: c.text }]}>
            To confirm, type <Text style={{ color: c.accent, fontWeight: '900' }}>DELETE</Text> below:
          </Text>
          <TextInput
            style={[
              styles.deleteInput,
              { backgroundColor: c.inputBg, borderColor: c.border, color: c.text },
            ]}
            placeholder="Type DELETE"
            placeholderTextColor={c.textMuted}
            autoCapitalize="characters"
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
          />

          <View style={styles.deleteBtnRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onClose}
              style={[styles.cancelBtn, { borderColor: c.border }]}
              accessibilityLabel="Cancel account deletion"
            >
              <Text style={[styles.cancelBtnText, { color: c.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!isFormValid || isDeleting}
              onPress={handleDelete}
              style={[
                styles.confirmDeleteBtn,
                {
                  backgroundColor: isFormValid ? c.accent : c.inputBg,
                  opacity: isFormValid ? 1 : 0.45,
                },
              ]}
              accessibilityLabel="Confirm permanent account deletion"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={c.onDanger} />
              ) : (
                <Text style={[styles.confirmDeleteBtnText, { color: c.onDanger }]}>Delete Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  deleteIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteModalDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  deleteConfirmLabel: {
    fontSize: 13,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  deleteInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  deleteBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
