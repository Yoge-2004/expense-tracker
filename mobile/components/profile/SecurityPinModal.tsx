import { AlertButton, AlertType } from '../../context/AlertContext';
/**
 * @file SecurityPinModal.tsx
 * @description Accessible 6-digit numeric recovery PIN configuration modal.
 */

import React, { memo, useState, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text, ThemedTextInput as TextInput } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';

export interface SecurityPinModalProps {
  visible: boolean;
  colors: ThemeColors;
  onClose: () => void;
  onSavePin: (pin: string) => Promise<void>;
  showAlert: (title: string, message: string, buttons?: AlertButton[], type?: AlertType) => void;
}

export const SecurityPinModal = memo(function SecurityPinModal({
  visible,
  colors: c,
  onClose,
  onSavePin,
  showAlert,
}: SecurityPinModalProps) {
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  useEffect(() => {
    if (visible) {
      setNewPin('');
      setConfirmPin('');
      setIsSavingPin(false);
    }
  }, [visible]);

  const handleSave = async () => {
    if (!/^[0-9]{6}$/.test(newPin.trim())) {
      showAlert('Invalid PIN', 'PIN must be exactly 6 numeric digits.', undefined, 'warning');
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      showAlert('Mismatch', 'PIN entries do not match.', undefined, 'warning');
      return;
    }
    setIsSavingPin(true);
    try {
      await onSavePin(newPin.trim());
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%', maxWidth: 420 }}
        >
          <View style={[styles.pinModalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.pinHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={20} color={c.primary} />
                <Text style={[styles.pinModalTitle, { color: c.text }]}>Security PIN Setup</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[styles.pinCloseBtn, { backgroundColor: c.inputBg }]}
                accessibilityLabel="Close security PIN setup"
              >
                <Ionicons name="close" size={18} color={c.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.pinModalDesc, { color: c.textMuted }]}>
              Configure a 6-digit numeric PIN for instant zero-email account recovery. You can reset your password anytime even if email OTP is unavailable.
            </Text>

            {/* New PIN Input Field */}
            <View style={styles.pinFieldWrap}>
              <Text style={[styles.pinFieldLabel, { color: c.textMuted }]}>NEW 6-DIGIT PIN</Text>
              <TextInput
                style={[
                  styles.pinTextInput,
                  {
                    backgroundColor: c.inputBg,
                    borderColor: c.border,
                    color: c.text,
                    letterSpacing: newPin.length > 0 ? 4 : 0,
                  },
                ]}
                placeholder="Enter 6-digit PIN"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                value={newPin}
                onChangeText={setNewPin}
              />
            </View>

            {/* Confirm PIN Input Field */}
            <View style={styles.pinFieldWrap}>
              <Text style={[styles.pinFieldLabel, { color: c.textMuted }]}>CONFIRM 6-DIGIT PIN</Text>
              <TextInput
                style={[
                  styles.pinTextInput,
                  {
                    backgroundColor: c.inputBg,
                    borderColor: c.border,
                    color: c.text,
                    letterSpacing: confirmPin.length > 0 ? 4 : 0,
                  },
                ]}
                placeholder="Confirm 6-digit PIN"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                value={confirmPin}
                onChangeText={setConfirmPin}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={isSavingPin}
              style={[
                styles.savePinBtn,
                { backgroundColor: c.primary, opacity: isSavingPin ? 0.7 : 1 },
              ]}
            >
              {isSavingPin ? (
                <ActivityIndicator size="small" color={c.onPrimary} />
              ) : (
                <Text style={[styles.savePinBtnText, { color: c.onPrimary }]}>
                  Save Security PIN
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  pinModalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  pinHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pinModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  pinCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinModalDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  pinFieldWrap: {
    marginBottom: 14,
  },
  pinFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pinTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  savePinBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  savePinBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
