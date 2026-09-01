/**
 * @file EditSubscriptionModal.tsx
 * @description Modal dialog for updating existing recurring subscription parameters
 * including cadence (Daily, Weekly, Monthly, Yearly, Custom days), amount, and due dates.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Colors, getCategoryEmoji } from '../constants/theme';
import { apiRequest } from '../services/api';
import { getCurrencySymbol } from '../services/currency';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Category {
  id: number;
  name: string;
}

interface Subscription {
  id: number;
  description: string;
  amount: number;
  categoryId: number;
  categoryName?: string;
  frequency: string;
  intervalDays?: number;
  nextDueDate?: string;
}

interface EditSubscriptionModalProps {
  /** Controls modal display state. */
  visible: boolean;
  /** Active subscription to edit (null if none selected). */
  subscription: Subscription | null;
  /** Available user categories. */
  categories: Category[];
  /** Callback fired to close the modal. */
  onClose: () => void;
  /** Callback fired after successfully updating to trigger parent refresh. */
  onUpdated: () => void;
}

/**
 * Edit recurring subscription modal component.
 */
export const EditSubscriptionModal: React.FC<EditSubscriptionModalProps> = ({
  visible,
  subscription,
  categories,
  onClose,
  onUpdated,
}) => {
  const { userId, theme, currency } = useAuth();
  const { showAlert } = useAlert();
  const c = Colors[theme];
  const currSym = getCurrencySymbol(currency);

  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [frequency, setFrequency] = useState('MONTHLY');
  const [intervalDays, setIntervalDays] = useState('30');
  const [nextDueDate, setNextDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (subscription) {
      setDesc(subscription.description || '');
      setAmount(String(subscription.amount || ''));
      setCategoryId(subscription.categoryId || (categories[0]?.id ?? null));
      setFrequency(subscription.frequency || 'MONTHLY');
      setIntervalDays(String(subscription.intervalDays || '30'));
      setNextDueDate(subscription.nextDueDate ? subscription.nextDueDate.split('T')[0] : '');
    }
  }, [subscription, categories]);

  /**
   * Validates and submits the updated recurring subscription payload.
   */
  const handleSave = async () => {
    if (!subscription || !userId) return;
    if (!desc.trim()) {
      showAlert('Missing Info', 'Please enter a description for the subscription.');
      return;
    }
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid positive amount.');
      return;
    }
    if (!categoryId) {
      showAlert('Missing Category', 'Please select a category.');
      return;
    }

    const payload: any = {
      description: desc.trim(),
      amount: numAmt,
      categoryId,
      frequency,
      nextDueDate: nextDueDate || undefined,
    };

    if (frequency === 'CUSTOM') {
      const days = parseInt(intervalDays, 10);
      if (isNaN(days) || days < 1) {
        showAlert('Invalid Interval', 'Custom interval must be at least 1 day.');
        return;
      }
      payload.intervalDays = days;
    }

    setSaving(true);
    try {
      await apiRequest(`/expenses/recurring/${subscription.id}/user/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onUpdated();
      onClose();
    } catch (e: any) {
      showAlert('Update Failed', e.message || 'Could not update subscription.');
    } finally {
      setSaving(false);
    }
  };

  if (!subscription) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: c.text }]}>Edit Subscription</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Update recurring billing details & frequency
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: c.inputBg }]}>
              <Ionicons name="close" size={20} color={c.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {/* Description */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: c.textMuted }]}>Service / Description</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                value={desc}
                onChangeText={setDesc}
                placeholder="e.g. Netflix, Spotify, Figma"
                placeholderTextColor={c.textMuted}
              />
            </View>

            {/* Amount */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: c.textMuted }]}>Billing Amount ({currSym})</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={c.textMuted}
              />
            </View>

            {/* Category selection */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: c.textMuted }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChips}>
                {categories.map((cat) => {
                  const isSelected = categoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      activeOpacity={0.8}
                      onPress={() => setCategoryId(cat.id)}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: isSelected ? c.primary : c.inputBg,
                          borderColor: isSelected ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text style={styles.catChipEmoji}>{getCategoryEmoji(cat.name)}</Text>
                      <Text
                        style={[
                          styles.catChipText,
                          {
                            color: isSelected ? (theme === 'light' ? '#FFF' : '#10120E') : c.text,
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

            {/* Frequency Selection */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: c.textMuted }]}>Billing Frequency</Text>
              <View style={styles.freqRow}>
                {['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'].map((f) => {
                  const isSelected = frequency === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setFrequency(f)}
                      style={[
                        styles.freqBtn,
                        {
                          backgroundColor: isSelected ? c.primary : c.inputBg,
                          borderColor: isSelected ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.freqBtnText,
                          {
                            color: isSelected ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {f}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Custom Interval Days */}
            {frequency === 'CUSTOM' && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: c.textMuted }]}>Repeat Every (Days)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                  value={intervalDays}
                  onChangeText={setIntervalDays}
                  keyboardType="number-pad"
                  placeholder="e.g. 45"
                  placeholderTextColor={c.textMuted}
                />
              </View>
            )}

            {/* Next Due Date */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: c.textMuted }]}>Next Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                value={nextDueDate}
                onChangeText={setNextDueDate}
                placeholder="2026-03-31"
                placeholderTextColor={c.textMuted}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: c.primary }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#10120E" />
              ) : (
                <Text style={styles.saveBtnText}>Update Subscription</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    marginBottom: 10,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  catChips: {
    gap: 8,
    paddingVertical: 4,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  catChipEmoji: {
    fontSize: 13,
  },
  catChipText: {
    fontSize: 12,
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  freqBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  freqBtnText: {
    fontSize: 11,
  },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  saveBtnText: {
    color: '#10120E',
    fontWeight: '800',
    fontSize: 15,
  },
});
